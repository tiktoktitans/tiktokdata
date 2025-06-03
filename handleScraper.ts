// ─────────────────────────────────────────────────────────────────────────────
// File: handleScraper.ts
//
// TikTok handle-based scraper with smart activity tracking and auto-removal
// Scrapes user profiles for shop videos, tracks posting frequency, and removes
// inactive handles automatically
// ─────────────────────────────────────────────────────────────────────────────

import axios, { AxiosError } from 'axios';
import dotenv from 'dotenv';
import { supabase } from './supabaseClient';
import { extractVideos } from './extractor';

dotenv.config();

// ─────────────────────────────────────────────────────────────────────────────
// Configuration constants
// ─────────────────────────────────────────────────────────────────────────────
const COUNT = 20;
const RATE_LIMIT_DELAY = 800;
const MAX_PAGES_PER_HANDLE = 50;
const HANDLE_SCRAPE_INTERVAL = 2 * 60 * 60 * 1000; // 2 hours between handle cycles
const INACTIVE_DAYS_THRESHOLD = 7; // Remove if no posts for 7 days
const NO_SHOP_DAYS_THRESHOLD = 14; // Remove if no shop content for 14 days
const MIN_SHOP_RATIO = 0.1; // Minimum 10% shop content ratio

// Error handling constants
const MAX_RETRIES_PER_PAGE = 3; // Retry failed API calls
const RETRY_DELAY_MIN = 1000; // Min delay between retries (ms)
const RETRY_DELAY_MAX = 5000; // Max delay between retries (ms)
const RATE_LIMIT_BACKOFF = 30000; // 30 seconds backoff for 429 errors
const MAX_CONSECUTIVE_FAILURES = 5; // Mark handle as inactive after 5 failures

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface TikTokHandle {
  username: string;
  last_scraped_at: string | null;
  total_videos_found: number;
  shop_videos_found: number;
  shop_ratio: number;
  consecutive_days_no_shop: number;
  consecutive_days_no_posts: number;
  status: 'active' | 'inactive' | 'removed';
  discovery_source: 'hashtag' | 'manual' | 'video_mention';
  created_at: string;
}

interface ScrapeResult {
  success: boolean;
  videosFound: number;
  shopVideosFound: number;
  pagesScraped: number;
  error?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: sleep for `ms` milliseconds
// ─────────────────────────────────────────────────────────────────────────────
function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─────────────────────────────────────────────────────────────────────────────
// Fetch active handles from database
// ─────────────────────────────────────────────────────────────────────────────
async function fetchActiveHandles(): Promise<TikTokHandle[]> {
  const { data, error } = await supabase
    .from('tiktok_handles')
    .select('*')
    .eq('status', 'active')
    .order('last_scraped_at', { ascending: true, nullsFirst: true });

  if (error) {
    console.error('❌ Failed to fetch handles:', error.message);
    return [];
  }
  return data || [];
}

// ─────────────────────────────────────────────────────────────────────────────
// Discover new handles from ALL shop videos (not just recent)
// ─────────────────────────────────────────────────────────────────────────────
async function discoverHandlesFromVideos(): Promise<void> {
  console.log('🔍 Discovering handles from ALL shop videos...');
  
  // Get ALL unique usernames from shop_videos table
  const { data: allVideos, error } = await supabase
    .from('shop_videos')
    .select('username')
    .not('username', 'is', null)
    .not('username', 'eq', '');

  if (error) {
    console.error('❌ Failed to fetch shop videos:', error.message);
    return;
  }

  if (!allVideos || allVideos.length === 0) {
    console.log('No shop videos found for handle discovery');
    return;
  }

  // Get unique usernames and filter out empty/null values
  const uniqueUsernames = [...new Set(allVideos.map(v => v.username).filter(Boolean))];
  console.log(`📊 Found ${uniqueUsernames.length} unique usernames in shop_videos table`);
  
  // Check which handles don't exist yet in tiktok_handles
  const { data: existingHandles } = await supabase
    .from('tiktok_handles')
    .select('username');

  const existingUsernames = new Set((existingHandles || []).map(h => h.username));
  const newUsernames = uniqueUsernames.filter(u => !existingUsernames.has(u));

  if (newUsernames.length === 0) {
    console.log('✅ All usernames from shop_videos already exist in tiktok_handles');
    return;
  }

  console.log(`🆕 Found ${newUsernames.length} new handles to add`);

  // Process in batches to avoid database timeouts
  const BATCH_SIZE = 1000;
  let totalInserted = 0;

  for (let i = 0; i < newUsernames.length; i += BATCH_SIZE) {
    const batch = newUsernames.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(newUsernames.length / BATCH_SIZE);

    console.log(`📦 Processing batch ${batchNum}/${totalBatches} (${batch.length} handles)`);

    // Insert new handles
    const newHandles = batch.map(username => ({
      username,
      total_videos_found: 0,
      shop_videos_found: 0,
      shop_ratio: 0,
      consecutive_days_no_shop: 0,
      consecutive_days_no_posts: 0,
      status: 'active',
      discovery_source: 'hashtag'
    }));

    const { error: insertError } = await supabase
      .from('tiktok_handles')
      .insert(newHandles);

    if (insertError) {
      console.error(`❌ Failed to insert batch ${batchNum}:`, insertError.message);
    } else {
      totalInserted += batch.length;
      console.log(`✅ Batch ${batchNum}: Added ${batch.length} handles`);
    }

    // Small delay between batches
    if (i + BATCH_SIZE < newUsernames.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  console.log(`🎉 Discovery complete! Added ${totalInserted} new handles from shop_videos`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Log scrape result to handle_scrape_history table
// ─────────────────────────────────────────────────────────────────────────────
async function logScrapeResult(result: ScrapeResult & { username: string }): Promise<void> {
  const { error } = await supabase
    .from('handle_scrape_history')
    .insert({
      username: result.username,
      videos_found: result.videosFound,
      shop_videos_found: result.shopVideosFound,
      pages_scraped: result.pagesScraped,
      success: result.success,
      error_message: result.error || null
    });

  if (error) {
    console.error(`❌ Failed to log scrape result for @${result.username}:`, error.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Scrape a single TikTok handle with comprehensive error handling
// ─────────────────────────────────────────────────────────────────────────────
async function scrapeHandle(handle: TikTokHandle, blacklist: Set<string>): Promise<void> {
  console.log(`🔎 Scraping @${handle.username}...`);
  
  let totalVideosThisScrape = 0;
  let shopVideosThisScrape = 0;
  let hasRecentPosts = false;
  let offset = 0;
  let pageCount = 0;
  let consecutiveFailures = 0;
  let scrapeSuccess = true;
  let scrapeError: string | undefined;

  try {
    while (pageCount < MAX_PAGES_PER_HANDLE && consecutiveFailures < MAX_CONSECUTIVE_FAILURES) {
      let pageSuccess = false;
      let retryCount = 0;

      // Retry loop for each page
      while (retryCount < MAX_RETRIES_PER_PAGE && !pageSuccess) {
        try {
          const res = await axios.get(
            `https://tokapi-mobile-version.p.rapidapi.com/v1/post/user/posts`,
            {
              params: {
                username: handle.username,
                count: COUNT,
                offset,
                region: 'US',
                with_pinned_posts: 1
              },
              headers: {
                'X-RapidAPI-Key': process.env.RAPIDAPI_KEY!,
                'X-RapidAPI-Host': 'tokapi-mobile-version.p.rapidapi.com',
              },
              timeout: 10000, // 10 second timeout
            }
          );

          const data = res.data;
          pageCount++;
          pageSuccess = true;
          consecutiveFailures = 0; // Reset on success

          const awemeList = Array.isArray(data.aweme_list) ? data.aweme_list : [];
          if (awemeList.length === 0) {
            console.log(`⚠️ No more videos for @${handle.username} (page ${pageCount})`);
            break;
          }

          // Check if any videos are from last 24 hours
          const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
          const recentVideos = awemeList.filter((v: any) => 
            v.create_time && (v.create_time * 1000) > oneDayAgo
          );
          if (recentVideos.length > 0) {
            hasRecentPosts = true;
          }

          // Extract and process videos
          const parsed = extractVideos([data]);
          totalVideosThisScrape += parsed.length;

          const shopVideos = parsed.filter(v => v.shop);
          shopVideosThisScrape += shopVideos.length;

          console.log(`📄 Page ${pageCount}: Found ${parsed.length} videos, ${shopVideos.length} shop videos`);

          // Filter and upsert shop videos
          const toInsert = shopVideos
            .filter(v => v.product_id && !blacklist.has(v.product_id))
            .map(v => ({
              aweme_id: v.aweme_id,
              username: v.username,
              caption: v.caption,
              views: v.views,
              likes: v.likes,
              shares: v.shares,
              comments: v.comments,
              video_url: v.video_url,
              thumbnail_url: v.thumbnail_url,
              video_duration: v.video_duration,
              video_ratio: v.video_ratio,
              share_url: v.share_url,
              music_title: v.music_title,
              created_at: v.created_at,
              on_screen_text: v.on_screen_text,
              spark: v.spark,
              shop: v.shop,
              product_id: v.product_id,
              product_link: v.product_link,
            }));

          if (toInsert.length > 0) {
            const { error: upsertErr } = await supabase
              .from('shop_videos')
              .upsert(toInsert, { onConflict: 'aweme_id' });

            if (upsertErr) {
              console.error(`❌ Database upsert failed for @${handle.username} page ${pageCount}:`, upsertErr.message);
              // Continue scraping even if database fails
            } else {
              console.log(`📦 Upserted ${toInsert.length} shop videos from @${handle.username} page ${pageCount}`);
            }
          }

          // Check if we should continue
          const hasMore = data.has_more === 1;
          if (!hasMore) {
            console.log(`🔚 Reached end for @${handle.username} (${pageCount} pages)`);
            break;
          }

          offset += COUNT;
          await sleep(RATE_LIMIT_DELAY);

        } catch (err) {
          const errorA = err as AxiosError;
          const status = errorA.response?.status;
          retryCount++;
          consecutiveFailures++;

          // Handle specific error types
          if (status === 404) {
            console.warn(`⚠️ Handle @${handle.username} not found (404). Marking as removed.`);
            await updateHandleStatus(handle.username, 'removed');
            scrapeError = 'Handle not found (404)';
            scrapeSuccess = false;
            break;
          } else if (status === 403) {
            console.warn(`⚠️ Handle @${handle.username} access forbidden (403). Marking as inactive.`);
            await updateHandleStatus(handle.username, 'inactive');
            scrapeError = 'Access forbidden (403)';
            scrapeSuccess = false;
            break;
          } else if (status === 429) {
            console.warn(`⚠️ Rate limited for @${handle.username}. Backing off for ${RATE_LIMIT_BACKOFF/1000}s...`);
            await sleep(RATE_LIMIT_BACKOFF);
            // Don't increment retryCount for rate limits
            retryCount--;
          } else if (status === 500 || status === 502 || status === 503) {
            console.warn(`⚠️ Server error ${status} for @${handle.username}, retry ${retryCount}/${MAX_RETRIES_PER_PAGE}`);
            if (retryCount < MAX_RETRIES_PER_PAGE) {
              const delay = RETRY_DELAY_MIN + Math.random() * (RETRY_DELAY_MAX - RETRY_DELAY_MIN);
              await sleep(delay);
            }
          } else {
            console.error(`❌ API error for @${handle.username} page ${pageCount + 1}: ${status} - ${errorA.message}`);
            if (retryCount < MAX_RETRIES_PER_PAGE) {
              const delay = RETRY_DELAY_MIN + Math.random() * (RETRY_DELAY_MAX - RETRY_DELAY_MIN);
              await sleep(delay);
            }
          }

          // Set error message for logging
          if (retryCount >= MAX_RETRIES_PER_PAGE) {
            scrapeError = `Failed after ${MAX_RETRIES_PER_PAGE} retries: ${errorA.message}`;
            console.error(`❌ Giving up on @${handle.username} page ${pageCount + 1} after ${MAX_RETRIES_PER_PAGE} retries`);
          }
        }
      }

      // If we failed to get this page after all retries, skip to next handle
      if (!pageSuccess) {
        console.warn(`⚠️ Skipping @${handle.username} due to repeated failures`);
        scrapeSuccess = false;
        break;
      }
    }

    // Check if handle hit consecutive failure limit
    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      console.warn(`⚠️ @${handle.username} hit consecutive failure limit (${MAX_CONSECUTIVE_FAILURES}). Marking as inactive.`);
      await updateHandleStatus(handle.username, 'inactive');
      scrapeError = `Too many consecutive failures (${consecutiveFailures})`;
      scrapeSuccess = false;
    }

  } catch (err) {
    console.error(`❌ Unexpected error scraping @${handle.username}:`, err);
    scrapeError = `Unexpected error: ${err}`;
    scrapeSuccess = false;
  }

  // Log scrape result to history table
  await logScrapeResult({
    username: handle.username,
    success: scrapeSuccess,
    videosFound: totalVideosThisScrape,
    shopVideosFound: shopVideosThisScrape,
    pagesScraped: pageCount,
    error: scrapeError
  });

  // Update handle statistics only if scrape was successful
  if (scrapeSuccess) {
    await updateHandleStats(handle, totalVideosThisScrape, shopVideosThisScrape, hasRecentPosts);
    console.log(`✅ @${handle.username}: ${shopVideosThisScrape}/${totalVideosThisScrape} shop videos (${pageCount} pages)`);
  } else {
    console.log(`❌ @${handle.username}: Scrape failed - ${scrapeError}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Update handle statistics and activity tracking
// ─────────────────────────────────────────────────────────────────────────────
async function updateHandleStats(
  handle: TikTokHandle, 
  totalVideos: number, 
  shopVideos: number, 
  hasRecentPosts: boolean
) {
  const newTotalVideos = handle.total_videos_found + totalVideos;
  const newShopVideos = handle.shop_videos_found + shopVideos;
  const newShopRatio = newTotalVideos > 0 ? newShopVideos / newTotalVideos : 0;
  
  // Update consecutive days counters
  let consecutiveDaysNoShop = shopVideos > 0 ? 0 : handle.consecutive_days_no_shop + 1;
  let consecutiveDaysNoPosts = hasRecentPosts ? 0 : handle.consecutive_days_no_posts + 1;
  
  // Determine if handle should be removed
  let status = handle.status;
  if (consecutiveDaysNoPosts >= INACTIVE_DAYS_THRESHOLD) {
    status = 'removed';
    console.log(`🗑️ Removing @${handle.username} - no posts for ${consecutiveDaysNoPosts} days`);
  } else if (consecutiveDaysNoShop >= NO_SHOP_DAYS_THRESHOLD) {
    status = 'removed';
    console.log(`🗑️ Removing @${handle.username} - no shop content for ${consecutiveDaysNoShop} days`);
  } else if (newShopRatio < MIN_SHOP_RATIO && newTotalVideos > 50) {
    status = 'removed';
    console.log(`🗑️ Removing @${handle.username} - shop ratio too low: ${(newShopRatio * 100).toFixed(1)}%`);
  }

  const { error } = await supabase
    .from('tiktok_handles')
    .update({
      last_scraped_at: new Date().toISOString(),
      total_videos_found: newTotalVideos,
      shop_videos_found: newShopVideos,
      shop_ratio: newShopRatio,
      consecutive_days_no_shop: consecutiveDaysNoShop,
      consecutive_days_no_posts: consecutiveDaysNoPosts,
      status
    })
    .eq('username', handle.username);

  if (error) {
    console.error(`❌ Failed to update handle stats for @${handle.username}:`, error.message);
  } else {
    console.log(`📊 Updated stats for @${handle.username}: ${shopVideos}/${totalVideos} shop videos, ratio: ${(newShopRatio * 100).toFixed(1)}%`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Update handle status
// ─────────────────────────────────────────────────────────────────────────────
async function updateHandleStatus(username: string, status: 'active' | 'inactive' | 'removed') {
  const { error } = await supabase
    .from('tiktok_handles')
    .update({ status })
    .eq('username', username);

  if (error) {
    console.error(`❌ Failed to update status for @${username}:`, error.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Fetch blacklisted product_ids
// ─────────────────────────────────────────────────────────────────────────────
async function fetchBlacklistedIds(): Promise<Set<string>> {
  const { data: rows, error } = await supabase
    .from('blacklisted_products')
    .select('product_id');

  if (error) {
    console.error('❌ Failed to load blacklist:', error.message);
    return new Set();
  }
  return new Set(rows.map((r: any) => r.product_id as string));
}

// ─────────────────────────────────────────────────────────────────────────────
// Single handle scrape cycle
// ─────────────────────────────────────────────────────────────────────────────
async function runHandleScrapeLoop() {
  console.log('🚀 Starting handle scrape cycle...\n');

  // Discover new handles first
  await discoverHandlesFromVideos();

  // Fetch active handles and blacklist
  const handles = await fetchActiveHandles();
  if (handles.length === 0) {
    console.log('⛔ No active handles to process');
    return;
  }

  const blacklist = await fetchBlacklistedIds();
  console.log(`📋 Processing ${handles.length} active handles`);

  // Scrape each handle
  for (const handle of handles) {
    await scrapeHandle(handle, blacklist);
  }

  console.log('\n✅ Handle scrape cycle completed');
}

// ─────────────────────────────────────────────────────────────────────────────
// Main runner
// ─────────────────────────────────────────────────────────────────────────────
async function run() {
  console.log('🚀 TikTok handle scraper started...\n');
  
  while (true) {
    try {
      await runHandleScrapeLoop();
      
      console.log(`⏰ Waiting ${HANDLE_SCRAPE_INTERVAL / 1000 / 60} minutes until next handle scrape...\n`);
      await sleep(HANDLE_SCRAPE_INTERVAL);
    } catch (error) {
      console.error('❌ Error in handle scrape cycle:', error);
      console.log('⏰ Waiting 5 minutes before retrying...\n');
      await sleep(5 * 60 * 1000);
    }
  }
}

run();