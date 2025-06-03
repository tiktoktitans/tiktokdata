// ─────────────────────────────────────────────────────────────────────────────
// File: parallelHandleScraper.ts
//
// High-performance parallel handle scraper with rate limiting and queue management
// Processes multiple handles concurrently while respecting API rate limits
// ─────────────────────────────────────────────────────────────────────────────

import axios, { AxiosError } from 'axios';
import dotenv from 'dotenv';
import { supabase } from './supabaseClient';
import { extractVideos } from './extractor';

dotenv.config();

// ─────────────────────────────────────────────────────────────────────────────
// High-performance configuration based on 900 requests/minute = 15 RPS
// ─────────────────────────────────────────────────────────────────────────────
const COUNT = 20;
const MAX_PAGES_PER_HANDLE = 30; // Reduced for faster processing
const HANDLE_SCRAPE_INTERVAL = 1 * 60 * 60 * 1000; // 1 hour between cycles

// Rate limiting configuration for 900 requests/minute = 15 RPS
const REQUESTS_PER_MINUTE = 900;
const REQUESTS_PER_SECOND = REQUESTS_PER_MINUTE / 60; // 15 RPS
const CONCURRENT_HANDLES = 10; // Process 10 handles simultaneously
const REQUEST_INTERVAL = 1000 / REQUESTS_PER_SECOND; // ~67ms between requests
const BATCH_SIZE = 100; // Process handles in batches

// Priority system
const PRIORITY_HIGH_RATIO = 0.3; // 30%+ shop ratio = high priority
const PRIORITY_MEDIUM_RATIO = 0.1; // 10%+ shop ratio = medium priority

// Error handling
const MAX_RETRIES_PER_PAGE = 2;
const RETRY_DELAY = 2000;
const RATE_LIMIT_BACKOFF = 30000;

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

interface QueuedRequest {
  handle: TikTokHandle;
  offset: number;
  pageNum: number;
  resolve: (result: any) => void;
  reject: (error: any) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Rate-limited request queue
// ─────────────────────────────────────────────────────────────────────────────
class RateLimitedQueue {
  private queue: QueuedRequest[] = [];
  private processing = false;
  private lastRequestTime = 0;

  async addRequest(handle: TikTokHandle, offset: number, pageNum: number): Promise<any> {
    return new Promise((resolve, reject) => {
      this.queue.push({ handle, offset, pageNum, resolve, reject });
      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;

    while (this.queue.length > 0) {
      const request = this.queue.shift()!;
      
      // Rate limiting: ensure minimum interval between requests
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;
      if (timeSinceLastRequest < REQUEST_INTERVAL) {
        await this.sleep(REQUEST_INTERVAL - timeSinceLastRequest);
      }

      try {
        const result = await this.makeRequest(request);
        request.resolve(result);
      } catch (error) {
        request.reject(error);
      }

      this.lastRequestTime = Date.now();
    }

    this.processing = false;
  }

  private async makeRequest(request: QueuedRequest): Promise<any> {
    const { handle, offset } = request;
    
    let retries = 0;
    while (retries < MAX_RETRIES_PER_PAGE) {
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
            timeout: 8000,
          }
        );

        return res.data;
      } catch (err) {
        const error = err as AxiosError;
        const status = error.response?.status;

        if (status === 429) {
          console.warn(`⚠️ Rate limited, backing off for ${RATE_LIMIT_BACKOFF/1000}s...`);
          await this.sleep(RATE_LIMIT_BACKOFF);
          continue; // Don't increment retries for rate limits
        }

        retries++;
        if (retries < MAX_RETRIES_PER_PAGE) {
          await this.sleep(RETRY_DELAY);
        } else {
          throw error;
        }
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Global rate-limited queue
const requestQueue = new RateLimitedQueue();

// ─────────────────────────────────────────────────────────────────────────────
// Helper functions
// ─────────────────────────────────────────────────────────────────────────────
function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─────────────────────────────────────────────────────────────────────────────
// Fetch handles with priority ordering
// ─────────────────────────────────────────────────────────────────────────────
async function fetchPrioritizedHandles(): Promise<TikTokHandle[]> {
  const { data, error } = await supabase
    .from('tiktok_handles')
    .select('*')
    .eq('status', 'active')
    .order('shop_ratio', { ascending: false }) // High performers first
    .order('last_scraped_at', { ascending: true, nullsFirst: true }); // Oldest first

  if (error) {
    console.error('❌ Failed to fetch handles:', error.message);
    return [];
  }
  return data || [];
}

// ─────────────────────────────────────────────────────────────────────────────
// Parallel handle scraping
// ─────────────────────────────────────────────────────────────────────────────
async function scrapeHandleParallel(handle: TikTokHandle, blacklist: Set<string>): Promise<void> {
  console.log(`🔎 [Parallel] Scraping @${handle.username}...`);
  
  let totalVideosThisScrape = 0;
  let shopVideosThisScrape = 0;
  let hasRecentPosts = false;
  let pagesScraped = 0;
  let scrapeSuccess = true;
  let scrapeError: string | undefined;

  try {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

    // Process pages sequentially but use shared rate-limited queue
    for (let pageNum = 1; pageNum <= MAX_PAGES_PER_HANDLE; pageNum++) {
      const offset = (pageNum - 1) * COUNT;

      try {
        const data = await requestQueue.addRequest(handle, offset, pageNum);
        pagesScraped++;

        const awemeList = Array.isArray(data.aweme_list) ? data.aweme_list : [];
        if (awemeList.length === 0) {
          console.log(`⚠️ No more videos for @${handle.username} (page ${pageNum})`);
          break;
        }

        // Check for recent posts
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

        // Filter and batch insert shop videos
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
            console.error(`❌ DB error for @${handle.username} page ${pageNum}:`, upsertErr.message);
          }
        }

        // Check if we should continue
        const hasMore = data.has_more === 1;
        if (!hasMore) {
          console.log(`🔚 Reached end for @${handle.username} (${pagesScraped} pages)`);
          break;
        }

      } catch (err) {
        const error = err as AxiosError;
        const status = error.response?.status;

        if (status === 404) {
          console.warn(`⚠️ @${handle.username} not found (404)`);
          await updateHandleStatus(handle.username, 'removed');
          scrapeError = 'Handle not found (404)';
          scrapeSuccess = false;
          break;
        } else if (status === 403) {
          console.warn(`⚠️ @${handle.username} access forbidden (403)`);
          await updateHandleStatus(handle.username, 'inactive');
          scrapeError = 'Access forbidden (403)';
          scrapeSuccess = false;
          break;
        } else {
          console.error(`❌ Error on @${handle.username} page ${pageNum}:`, error.message);
          scrapeError = `API error: ${error.message}`;
          break;
        }
      }
    }

  } catch (err) {
    console.error(`❌ Unexpected error scraping @${handle.username}:`, err);
    scrapeError = `Unexpected error: ${err}`;
    scrapeSuccess = false;
  }

  // Log result and update stats
  await logScrapeResult({
    username: handle.username,
    success: scrapeSuccess,
    videosFound: totalVideosThisScrape,
    shopVideosFound: shopVideosThisScrape,
    pagesScraped: pagesScraped,
    error: scrapeError
  });

  if (scrapeSuccess) {
    await updateHandleStats(handle, totalVideosThisScrape, shopVideosThisScrape, hasRecentPosts);
    console.log(`✅ @${handle.username}: ${shopVideosThisScrape}/${totalVideosThisScrape} shop videos (${pagesScraped} pages)`);
  } else {
    console.log(`❌ @${handle.username}: Failed - ${scrapeError}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper functions (same as original)
// ─────────────────────────────────────────────────────────────────────────────
async function logScrapeResult(result: { username: string; success: boolean; videosFound: number; shopVideosFound: number; pagesScraped: number; error?: string }): Promise<void> {
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

async function updateHandleStatus(username: string, status: 'active' | 'inactive' | 'removed') {
  const { error } = await supabase
    .from('tiktok_handles')
    .update({ status })
    .eq('username', username);

  if (error) {
    console.error(`❌ Failed to update status for @${username}:`, error.message);
  }
}

async function updateHandleStats(handle: TikTokHandle, totalVideos: number, shopVideos: number, hasRecentPosts: boolean) {
  const newTotalVideos = handle.total_videos_found + totalVideos;
  const newShopVideos = handle.shop_videos_found + shopVideos;
  const newShopRatio = newTotalVideos > 0 ? newShopVideos / newTotalVideos : 0;
  
  let consecutiveDaysNoShop = shopVideos > 0 ? 0 : handle.consecutive_days_no_shop + 1;
  let consecutiveDaysNoPosts = hasRecentPosts ? 0 : handle.consecutive_days_no_posts + 1;
  
  const { error } = await supabase
    .from('tiktok_handles')
    .update({
      last_scraped_at: new Date().toISOString(),
      total_videos_found: newTotalVideos,
      shop_videos_found: newShopVideos,
      shop_ratio: newShopRatio,
      consecutive_days_no_shop: consecutiveDaysNoShop,
      consecutive_days_no_posts: consecutiveDaysNoPosts,
    })
    .eq('username', handle.username);

  if (error) {
    console.error(`❌ Failed to update handle stats for @${handle.username}:`, error.message);
  }
}

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
// Main parallel processing loop
// ─────────────────────────────────────────────────────────────────────────────
async function runParallelScrapeLoop() {
  console.log('🚀 Starting parallel handle scrape cycle...\n');

  const handles = await fetchPrioritizedHandles();
  if (handles.length === 0) {
    console.log('⛔ No active handles to process');
    return;
  }

  const blacklist = await fetchBlacklistedIds();
  console.log(`📋 Processing ${handles.length} handles with ${CONCURRENT_HANDLES} concurrent workers`);

  // Process handles in batches
  for (let i = 0; i < handles.length; i += BATCH_SIZE) {
    const batch = handles.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(handles.length / BATCH_SIZE);

    console.log(`📦 Processing batch ${batchNum}/${totalBatches} (${batch.length} handles)`);

    // Process handles in parallel within batch
    const promises: Promise<void>[] = [];
    for (let j = 0; j < batch.length; j += CONCURRENT_HANDLES) {
      const chunk = batch.slice(j, j + CONCURRENT_HANDLES);
      
      const chunkPromises = chunk.map(handle => 
        scrapeHandleParallel(handle, blacklist)
      );
      
      promises.push(...chunkPromises);
      
      // Wait for this chunk to complete before starting next
      await Promise.allSettled(chunkPromises);
    }

    console.log(`✅ Batch ${batchNum} completed`);
  }

  console.log('\n✅ Parallel scrape cycle completed');
}

// ─────────────────────────────────────────────────────────────────────────────
// Main runner
// ─────────────────────────────────────────────────────────────────────────────
async function run() {
  console.log('🚀 TikTok parallel handle scraper started...\n');
  
  while (true) {
    try {
      await runParallelScrapeLoop();
      
      console.log(`⏰ Waiting ${HANDLE_SCRAPE_INTERVAL / 1000 / 60} minutes until next scrape...\n`);
      await sleep(HANDLE_SCRAPE_INTERVAL);
    } catch (error) {
      console.error('❌ Error in parallel scrape cycle:', error);
      console.log('⏰ Waiting 5 minutes before retrying...\n');
      await sleep(5 * 60 * 1000);
    }
  }
}

run();