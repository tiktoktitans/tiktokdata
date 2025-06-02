// ─────────────────────────────────────────────────────────────────────────────
// File: index.ts
//
// Scraper that pages through TikTok Shop videos by hashtag, extracts “shop”
// videos, and upserts to `shop_videos`. It also loads a blacklist of
// “bad” product_ids from `blacklisted_products` so it never re-inserts them.
// ─────────────────────────────────────────────────────────────────────────────

import axios, { AxiosError } from 'axios';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { supabase } from './supabaseClient';
import { extractVideos } from './extractor';

dotenv.config();

// ─────────────────────────────────────────────────────────────────────────────
// Configuration constants
// ─────────────────────────────────────────────────────────────────────────────
const COUNT            = 20;    // Videos per page
const RATE_LIMIT_DELAY = 500;   // ms between page requests
const MAX_PAGES        = 1000;  // Safety cap on pages per hashtag

// ─────────────────────────────────────────────────────────────────────────────
// Helper: sleep for `ms` milliseconds
// ─────────────────────────────────────────────────────────────────────────────
function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─────────────────────────────────────────────────────────────────────────────
// Fetch hashtag IDs from Supabase (`hashtags` table has `hashtag` column)
// ─────────────────────────────────────────────────────────────────────────────
async function fetchHashtagIDs(): Promise<{ id: string; tag: string }[]> {
  const { data, error } = await supabase
    .from('hashtags')
    .select('hashtag');

  if (error) {
    console.error('❌ Failed to fetch hashtags:', error.message);
    return [];
  }
  if (!data || data.length === 0) {
    console.warn('⚠️ No hashtags found.');
    return [];
  }
  return data.map((row: any) => ({
    id: row.hashtag.toString(),
    tag: row.hashtag.toString(),
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Fetch blacklisted product_ids from Supabase (`blacklisted_products` table)
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
// Scrape a single hashtag, page by page:
//   1) Request `hashtag/posts/{id}?count=20&offset=X&region=US`
//   2) Extract “shop” videos via `extractVideos(...)`
//   3) Filter out any whose product_id is in blacklist
//   4) Upsert remaining rows into `shop_videos`
//   5) Repeat until `has_more === 0` or MAX_PAGES reached
//   6) Save raw JSON array to `raw_<tag>.json` for inspection
// ─────────────────────────────────────────────────────────────────────────────
async function scrapeHashtag(
  id: string,
  tag: string,
  blacklist: Set<string>
) {
  console.log(`🔎 Scraping #${tag} (ID: ${id})…`);
  const allPages: any[] = [];
  let offset = 0;
  let pageCount = 0;

  while (true) {
    if (pageCount >= MAX_PAGES) {
      console.warn(`⚠️ Reached MAX_PAGES (${MAX_PAGES}) for #${tag}.`);
      break;
    }

    const params: Record<string, string | number> = {
      count: COUNT,
      offset,
      region: 'US',
    };

    let fetchedThisPage = false;
    let attempt = 0;

    // Retry loop for transient errors (429 or 500)
    while (attempt < 3 && !fetchedThisPage) {
      try {
        const res = await axios.get(
          `https://tokapi-mobile-version.p.rapidapi.com/v1/hashtag/posts/${id}`,
          {
            params,
            headers: {
              'X-RapidAPI-Key': process.env.RAPIDAPI_KEY!,
              'X-RapidAPI-Host': 'tokapi-mobile-version.p.rapidapi.com',
            },
          }
        );

        const data: any = res.data;
        allPages.push(data);
        fetchedThisPage = true;
        pageCount++;

        const hasMore = typeof data.has_more === 'number' ? data.has_more : 0;
        console.log(
          `✅ Fetched page ${pageCount} for #${tag} (offset=${offset}) → has_more = ${hasMore}`
        );

        // 1) Extract “shop” videos
        const parsed = extractVideos([data]).filter((v: any) => v.shop);

        // 2) Filter out blacklisted product_ids
        const toInsert = parsed
          .filter((v: any) => {
            if (!v.product_id) return false;
            if (blacklist.has(v.product_id)) {
              console.log(`   ↳ Skipping blacklisted product_id ${v.product_id}`);
              return false;
            }
            return true;
          })
          .map((v: any) => ({
            aweme_id:       v.aweme_id,
            username:       v.username,
            caption:        v.caption,
            views:          v.views,
            likes:          v.likes,
            shares:         v.shares,
            comments:       v.comments,
            video_url:      v.video_url,
            audio_url:      v.audio_url,
            thumbnail_url:  v.thumbnail_url,
            video_duration: v.video_duration,
            video_ratio:    v.video_ratio,
            share_url:      v.share_url,
            music_title:    v.music_title,
            created_at:     v.created_at,
            on_screen_text: v.on_screen_text,
            spark:          v.spark,
            shop:           v.shop,
            product_id:     v.product_id,
            product_link:   v.product_link,
            // product_name, product_image, price, shop_name left NULL
          }));

        if (toInsert.length > 0) {
          const { error: upsertErr, status, statusText } = await supabase
            .from('shop_videos')
            .upsert(toInsert, { onConflict: 'aweme_id' });

          if (upsertErr) {
            console.error(
              `❌ Upsert failed for page ${pageCount}, #${tag}:`,
              { status, statusText, errorObject: upsertErr }
            );
          } else {
            console.log(`📦 Upserted ${toInsert.length} shop videos (page ${pageCount})`);
          }
        } else {
          console.log(`ℹ️ No shop videos to upsert on page ${pageCount} (or all blacklisted)`);
        }

        // 3) Decide whether to continue paging
        const awemeList = Array.isArray(data.aweme_list) ? data.aweme_list : [];
        if (awemeList.length === 0) {
          console.log(`⚠️ aweme_list empty on page ${pageCount}. Stopping.`);
          break;
        }
        if (hasMore === 0) {
          console.log(`🔚 Reached last page for #${tag}.`);
          break;
        }

        // 4) Advance offset and throttle
        offset += COUNT;
        await sleep(RATE_LIMIT_DELAY);
      } catch (err) {
        const errorA = err as AxiosError;
        const status = errorA.response?.status;
        attempt++;

        if (status === 404) {
          console.warn(`⚠️ Hashtag ${id} not found (404). Skipping #${tag}.`);
          return;
        }
        if (status === 429 || status === 500) {
          console.warn(
            `⚠️ API error on page ${pageCount + 1} (offset=${offset}), status ${status}. Retry ${attempt}/3…`
          );
          await sleep(RATE_LIMIT_DELAY);
          continue;
        }
        console.error(`❌ Error on page ${pageCount + 1} (offset=${offset}):`, errorA.message);
        break;
      }
    }

    if (!fetchedThisPage) {
      console.warn(`⚠️ Skipping offset ${offset} for #${tag} after 3 failures.`);
      offset += COUNT;
      pageCount++;
      continue;
    }
  }

  // 5) Write raw JSON to disk
  try {
    const filename = `raw_${tag}.json`;
    const filepath = path.join(process.cwd(), filename);
    fs.writeFileSync(filepath, JSON.stringify(allPages, null, 2), 'utf-8');
    console.log(`💾 Saved raw JSON to ${filename}`);
  } catch (writeErr) {
    console.error('❌ Failed to write raw JSON:', writeErr);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main runner: 
//   1) Fetch hashtags
//   2) Fetch blacklist
//   3) Scrape each hashtag in turn
// ─────────────────────────────────────────────────────────────────────────────
async function run() {
  console.log('🚀 TikTok scraper started (with blacklist)…\n');

  const hashtags = await fetchHashtagIDs();
  if (hashtags.length === 0) {
    console.log('⛔ No hashtags to process. Exiting.');
    return;
  }

  // Fetch all blacklisted product_ids once at startup
  const blacklist = await fetchBlacklistedIds();

  for (const { id, tag } of hashtags) {
    await scrapeHashtag(id, tag, blacklist);
  }

  console.log('\n✅ All hashtags processed.');
}

run();
