// ─────────────────────────────────────────────────────────────────────────────
// File: enricher.ts
//
// Background worker that checks `shop_videos` for any missing product metadata,
// then uses `shop_products` as a cache to avoid repeated API calls.
// If a product_id cannot be fetched after X retries or has no valid “products”
// array, it deletes all `shop_videos` rows for that product_id and inserts it
// into `blacklisted_products` so the scraper never re-inserts it.
// Table names:
//   • shop_videos          — contains video rows with product_id and null product fields
//   • shop_products        — cache table for product metadata (product_id primary key)
//   • blacklisted_products — holds product_ids that should never be retried
// ─────────────────────────────────────────────────────────────────────────────

import axios, { AxiosError } from 'axios';
import dotenv from 'dotenv';
import { supabase } from './supabaseClient';

dotenv.config();

// ─────────────────────────────────────────────────────────────────────────────
// Configuration constants
// ─────────────────────────────────────────────────────────────────────────────
const RETRY_DELAY_MIN     = 300;   // minimum ms between retries
const RETRY_DELAY_MAX     = 500;   // maximum ms between retries
const MAX_PRODUCT_RETRIES = 10;    // number of API attempts per product_id
const BATCH_SIZE          = 500;   // distinct product_ids to process per loop

// ─────────────────────────────────────────────────────────────────────────────
// Helper: sleep for `ms` milliseconds
// ─────────────────────────────────────────────────────────────────────────────
function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─────────────────────────────────────────────────────────────────────────────
// Fetch product details from the TokAPI endpoint, with quick retries
// ─────────────────────────────────────────────────────────────────────────────
async function fetchProductDetailsWithRetry(productId: string) {
  const url = `https://tokapi-mobile-version.p.rapidapi.com/v1/shop/product/${productId}?region=US`;

  for (let attempt = 1; attempt <= MAX_PRODUCT_RETRIES; attempt++) {
    try {
      const res = await axios.get(url, {
        headers: {
          'X-RapidAPI-Key': process.env.TOKAPI_KEY!,
          'X-RapidAPI-Host': 'tokapi-mobile-version.p.rapidapi.com',
        },
      });
      if (res.status === 200 && res.data) {
        return res.data;
      }
      throw new Error(`Received status ${res.status}`);
    } catch (err) {
      const errorA = err as AxiosError;
      const status = errorA.response?.status;
      console.warn(
        `⚠️ [Enricher] Product ${productId}: attempt ${attempt} failed (status ${status}).`
      );
      if (attempt < MAX_PRODUCT_RETRIES) {
        const delay = Math.floor(
          RETRY_DELAY_MIN + Math.random() * (RETRY_DELAY_MAX - RETRY_DELAY_MIN)
        );
        await sleep(delay);
        continue;
      }
      console.error(`❌ [Enricher] Product ${productId}: all ${MAX_PRODUCT_RETRIES} attempts failed.`);
      return null;
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Enrich a single product ID:
//  1) Check `shop_products` cache.
//  2) If cache hit, update `shop_videos` directly.
//  3) If cache miss, call API.
//     • On successful fetch, insert into `shop_products` (no fetched_at) and update `shop_videos`.
//     • If after retries or no "products" array, DELETE all rows from `shop_videos`
//       for that product_id, then insert that product_id into `blacklisted_products`.
// ─────────────────────────────────────────────────────────────────────────────
async function enrichSingleProduct(productId: string) {
  console.log(`🔍 [Enricher] Checking product metadata for ID = ${productId}`);

  // 1) Try to read from `shop_products` (cache table)
  const { data: cacheRows, error: cacheErr } = await supabase
    .from('shop_products')
    .select('product_name, product_image, price, shop_name')
    .eq('product_id', productId)
    .limit(1);

  if (cacheErr) {
    console.error(`[Enricher] Supabase error reading shop_products for ${productId}:`, cacheErr.message);
    return;
  }

  let product_name: string | null = null;
  let product_image: string | null = null;
  let price: string | null = null;
  let shop_name: string | null = null;

  if (cacheRows && cacheRows.length > 0) {
    // Cache HIT: copy values from shop_products
    const existing = cacheRows[0];
    product_name  = existing.product_name;
    product_image = existing.product_image;
    price         = existing.price;
    shop_name     = existing.shop_name;

    console.log(`[Enricher] Cache hit for ${productId}. Updating shop_videos.`);
  } else {
    // Cache MISS: attempt to call product API
    console.log(`[Enricher] Cache miss. Calling product-detail API for ${productId}`);
    const detailData = await fetchProductDetailsWithRetry(productId);

    // If fetch failed entirely, delete videos and blacklist the ID
    if (!detailData) {
      console.warn(
        `[Enricher] Could not fetch details for ${productId} after ${MAX_PRODUCT_RETRIES} attempts.`
      );
      console.warn(`[Enricher] Deleting shop_videos rows for ${productId} and blacklisting.`);

      // Delete all shop_videos rows with this product_id
      const { error: deleteErr, status: deleteStatus, statusText: deleteText } = await supabase
        .from('shop_videos')
        .delete()
        .eq('product_id', productId);

      if (deleteErr) {
        console.error(
          `[Enricher] Failed to delete shop_videos rows for ${productId}:`,
          { deleteStatus, deleteText, errorObject: deleteErr }
        );
      } else {
        console.log(`[Enricher] Deleted all shop_videos rows for ${productId}.`);
      }

      // Insert into blacklist
      const { error: blErr, status: blStatus, statusText: blText } = await supabase
        .from('blacklisted_products')
        .insert({ product_id: productId });

      if (blErr) {
        console.error(
          `[Enricher] Failed to insert into blacklisted_products for ${productId}:`,
          { blStatus, blText, errorObject: blErr }
        );
      } else {
        console.log(`[Enricher] Inserted ${productId} into blacklisted_products.`);
      }
      return;
    }

    // Debug: dump raw JSON to inspect
    console.log(`[Enricher] Received product-detail JSON for ${productId}:\n`);
    console.log(JSON.stringify(detailData, null, 2));
    console.log(`\n[Enricher] End of JSON for ${productId}\n`);

    // 2) Extract fields from detailData.data.products[0]
    const productsArray = (detailData as any).data?.products;
    if (!Array.isArray(productsArray) || productsArray.length === 0) {
      console.warn(`[Enricher] No “products” array found for ${productId}.`);
      console.warn(`[Enricher] Deleting shop_videos rows for ${productId} and blacklisting.`);

      // Delete all shop_videos rows with this product_id
      const { error: deleteErr2, status: deleteStatus2, statusText: deleteText2 } = await supabase
        .from('shop_videos')
        .delete()
        .eq('product_id', productId);

      if (deleteErr2) {
        console.error(
          `[Enricher] Failed to delete shop_videos rows for ${productId}:`,
          { deleteStatus2, deleteText2, errorObject: deleteErr2 }
        );
      } else {
        console.log(`[Enricher] Deleted all shop_videos rows for ${productId}.`);
      }

      // Insert into blacklist
      const { error: blErr2, status: blStatus2, statusText: blText2 } = await supabase
        .from('blacklisted_products')
        .insert({ product_id: productId });

      if (blErr2) {
        console.error(
          `[Enricher] Failed to insert into blacklisted_products for ${productId}:`,
          { blStatus2, blText2, errorObject: blErr2 }
        );
      } else {
        console.log(`[Enricher] Inserted ${productId} into blacklisted_products.`);
      }
      return;
    }

    const firstProduct = productsArray[0];
    const productBase  = firstProduct.product_base ?? {};
    const sellerObj    = firstProduct.seller ?? {};

    // 3) Pull out the fields:
    product_name = productBase.title ?? null;

    if (
      Array.isArray(productBase.images) &&
      productBase.images.length > 0 &&
      Array.isArray(productBase.images[0].url_list) &&
      productBase.images[0].url_list.length > 0
    ) {
      product_image = productBase.images[0].url_list[0];
    }

    const priceObj = productBase.price ?? {};
    if (
      priceObj.original_price !== undefined &&
      typeof priceObj.original_price === 'string' &&
      priceObj.original_price.trim() !== ''
    ) {
      price = priceObj.original_price;
    } else if (priceObj.real_price !== undefined && priceObj.real_price !== null) {
      price = priceObj.real_price;
    }

    shop_name = sellerObj.name ?? null;

    // 4) Insert into `shop_products` cache (no fetched_at column)
    const { error: insertErr, status: insertStatus, statusText: insertText } = await supabase
      .from('shop_products')
      .insert({
        product_id:    productId,
        product_name,
        product_image,
        price,
        shop_name,
      });

    if (insertErr) {
      console.error(
        `[Enricher] Error inserting into shop_products for ${productId}:`,
        { insertStatus, insertText, errorObject: insertErr }
      );
    } else {
      console.log(`[Enricher] Cached metadata for ${productId} into shop_products.`);
    }
  }

  // 5) Update all shop_videos rows for this product_id
  console.log(
    `[Enricher] Upserting to shop_videos → { ` +
    `product_name: ${product_name}, ` +
    `product_image: ${product_image}, ` +
    `price: ${price}, ` +
    `shop_name: ${shop_name} }`
  );

  const { error: updateErr, status: updateStatus, statusText: updateText } = await supabase
    .from('shop_videos')
    .update({
      product_name,
      product_image,
      price,
      shop_name,
    })
    .eq('product_id', productId);

  if (updateErr) {
    console.error(
      `[Enricher] Supabase UPDATE error for shop_videos ${productId}:`,
      { updateStatus, updateText, errorObject: updateErr }
    );
  } else {
    console.log(`[Enricher] Updated shop_videos for ${productId}\n`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main loop:
//   1) Find distinct product_ids in shop_videos where any of (product_name,
//      product_image, price, shop_name) is NULL.
//   2) For each, call enrichSingleProduct.
//   3) Repeat indefinitely (with brief sleeps when idle).
// ─────────────────────────────────────────────────────────────────────────────
async function runEnricher() {
  console.log('🚀 Enricher started…');

  while (true) {
    // 1) Select up to BATCH_SIZE distinct product_ids needing enrichment
    const { data: missingRows, error: missingErr } = await supabase
      .from('shop_videos')
      .select('product_id')
      .not('product_id', 'is', null)
      .or('product_name.is.null,product_image.is.null,price.is.null,shop_name.is.null')
      .limit(BATCH_SIZE);

    if (missingErr) {
      console.error('[Enricher] Error querying missing shop_videos:', missingErr.message);
      await sleep(5000);
      continue;
    }

    if (!missingRows || missingRows.length === 0) {
      console.log('[Enricher] No missing product info. Sleeping for 30s…');
      await sleep(30000);
      continue;
    }

    // Deduplicate product IDs (ensure string)
    const uniqueProductIds: string[] = Array.from(
      new Set(missingRows.map((r: any) => r.product_id as string))
    );

    console.log(`[Enricher] Found ${uniqueProductIds.length} distinct product IDs to fill`);

    // 2) Process each productId sequentially
    for (const pid of uniqueProductIds) {
      await enrichSingleProduct(pid);
    }

    // 3) Loop again immediately
    console.log('[Enricher] Batch complete. Checking for more missing IDs…\n');
  }
}

runEnricher();
