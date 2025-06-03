// ─────────────────────────────────────────────────────────────────────────────
// File: parallelEnricher.ts
//
// High-speed parallel product enricher - processes 10 products simultaneously
// For manual runs when you need to enrich products quickly
// ─────────────────────────────────────────────────────────────────────────────

import axios, { AxiosError } from 'axios';
import dotenv from 'dotenv';
import { supabase } from './supabaseClient';

dotenv.config();

// ─────────────────────────────────────────────────────────────────────────────
// Parallel configuration
// ─────────────────────────────────────────────────────────────────────────────
const CONCURRENT_PRODUCTS = 10; // Process 10 products at once
const BATCH_SIZE = 100; // Fetch 100 products per database query
const REQUEST_INTERVAL = 1000 / 15; // 67ms between requests (15 RPS)
const MAX_RETRIES = 10; // Increased to 10 retries for flaky API
const RETRY_DELAY_MIN = 300;
const RETRY_DELAY_MAX = 500;
const RATE_LIMIT_BACKOFF = 30000;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface QueuedProduct {
  productId: string;
  resolve: (result: any) => void;
  reject: (error: any) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Rate-limited request queue for product enrichment
// ─────────────────────────────────────────────────────────────────────────────
class ProductEnrichmentQueue {
  private queue: QueuedProduct[] = [];
  private processing = false;
  private lastRequestTime = 0;
  private requestCount = 0;

  async addProduct(productId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.queue.push({ productId, resolve, reject });
      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;

    while (this.queue.length > 0) {
      const request = this.queue.shift()!;
      
      // Rate limiting
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;
      if (timeSinceLastRequest < REQUEST_INTERVAL) {
        await this.sleep(REQUEST_INTERVAL - timeSinceLastRequest);
      }

      try {
        const result = await this.fetchProductDetails(request.productId);
        request.resolve(result);
        this.requestCount++;
        
        if (this.requestCount % 100 === 0) {
          console.log(`📊 Progress: ${this.requestCount} products enriched`);
        }
      } catch (error) {
        request.reject(error);
      }

      this.lastRequestTime = Date.now();
    }

    this.processing = false;
  }

  private async fetchProductDetails(productId: string): Promise<any> {
    const url = `https://tokapi-mobile-version.p.rapidapi.com/v1/shop/product/${productId}?region=US`;
    
    let retries = 0;
    while (retries < MAX_RETRIES) {
      try {
        const res = await axios.get(url, {
          headers: {
            'X-RapidAPI-Key': process.env.RAPIDAPI_KEY!,
            'X-RapidAPI-Host': 'tokapi-mobile-version.p.rapidapi.com',
          },
          timeout: 8000,
        });

        if (res.status === 200 && res.data) {
          return res.data;
        }
        throw new Error(`Received status ${res.status}`);
      } catch (err) {
        const error = err as AxiosError;
        const status = error.response?.status;
        
        if (status === 429) {
          console.warn(`⚠️ Rate limited for product ${productId}, backing off ${RATE_LIMIT_BACKOFF/1000}s...`);
          await this.sleep(RATE_LIMIT_BACKOFF);
          continue;
        }
        
        retries++;
        if (retries < MAX_RETRIES) {
          console.warn(`⚠️ Retry ${retries}/${MAX_RETRIES} for product ${productId}`);
          const delay = RETRY_DELAY_MIN + Math.random() * (RETRY_DELAY_MAX - RETRY_DELAY_MIN);
          await this.sleep(delay);
        } else {
          console.error(`❌ Failed to fetch product ${productId} after ${MAX_RETRIES} attempts`);
          return null;
        }
      }
    }
    return null;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Parallel product enrichment
// ─────────────────────────────────────────────────────────────────────────────
async function enrichProductParallel(productId: string, queue: ProductEnrichmentQueue): Promise<void> {
  try {
    // Check if already in cache
    const { data: cacheRows, error: cacheErr } = await supabase
      .from('shop_products')
      .select('product_name')
      .eq('product_id', productId)
      .limit(1);

    if (cacheErr) {
      console.error(`[Enricher] Cache check error for ${productId}:`, cacheErr.message);
      return;
    }

    if (cacheRows && cacheRows.length > 0) {
      // Already cached, skip
      return;
    }

    // Fetch product details
    const detailData = await queue.addProduct(productId);

    if (!detailData) {
      // API fetch failed, delete videos and blacklist
      console.warn(`[Parallel] Blacklisting product ${productId} - API failed`);
      
      await supabase
        .from('shop_videos')
        .delete()
        .eq('product_id', productId);

      await supabase
        .from('blacklisted_products')
        .insert({ product_id: productId });
      
      return;
    }

    // Extract product data
    const productsArray = (detailData as any).data?.products;
    if (!Array.isArray(productsArray) || productsArray.length === 0) {
      console.warn(`[Parallel] No products array for ${productId}, blacklisting`);
      
      await supabase
        .from('shop_videos')
        .delete()
        .eq('product_id', productId);

      await supabase
        .from('blacklisted_products')
        .insert({ product_id: productId });
      
      return;
    }

    const firstProduct = productsArray[0];
    const productBase = firstProduct.product_base ?? {};
    const sellerObj = firstProduct.seller ?? {};

    // Extract fields
    let product_name = productBase.title ?? null;
    let product_image = null;
    
    if (
      Array.isArray(productBase.images) &&
      productBase.images.length > 0 &&
      Array.isArray(productBase.images[0].url_list) &&
      productBase.images[0].url_list.length > 0
    ) {
      product_image = productBase.images[0].url_list[0];
    }

    const priceObj = productBase.price ?? {};
    let rawPrice = null;
    
    if (
      priceObj.original_price !== undefined &&
      typeof priceObj.original_price === 'string' &&
      priceObj.original_price.trim() !== ''
    ) {
      rawPrice = priceObj.original_price;
    } else if (priceObj.real_price !== undefined && priceObj.real_price !== null) {
      rawPrice = priceObj.real_price;
    }
    
    let price = null;
    if (rawPrice && typeof rawPrice === 'string') {
      const priceMatch = rawPrice.match(/[\d.]+/);
      if (priceMatch) {
        const numericPrice = parseFloat(priceMatch[0]);
        if (!isNaN(numericPrice)) {
          price = numericPrice.toString();
        }
      }
    } else if (typeof rawPrice === 'number') {
      price = rawPrice.toString();
    }

    const shop_name = sellerObj.name ?? null;

    // Insert to cache
    await supabase
      .from('shop_products')
      .insert({
        product_id: productId,
        product_name,
        product_image,
        price,
        shop_name,
      });

    // Update all shop_videos
    await supabase
      .from('shop_videos')
      .update({
        product_name,
        product_image,
        price,
        shop_name,
      })
      .eq('product_id', productId);

    // Mark as processed
    await supabase
      .from('blacklisted_products')
      .insert({ product_id: productId });

    console.log(`✅ Enriched product ${productId}`);

  } catch (err) {
    console.error(`❌ Error enriching product ${productId}:`, err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Direct parallel fetch without queue (true parallel processing)
// ─────────────────────────────────────────────────────────────────────────────
async function fetchProductDetailsDirectly(productId: string): Promise<any> {
  const url = `https://tokapi-mobile-version.p.rapidapi.com/v1/shop/product/${productId}?region=US`;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await axios.get(url, {
        headers: {
          'X-RapidAPI-Key': process.env.RAPIDAPI_KEY!,
          'X-RapidAPI-Host': 'tokapi-mobile-version.p.rapidapi.com',
        },
        timeout: 10000,
      });

      if (res.status === 200 && res.data) {
        return res.data;
      }
      throw new Error(`Received status ${res.status}`);
    } catch (err) {
      const error = err as AxiosError;
      const status = error.response?.status;
      
      console.warn(`⚠️ [Product ${productId}] Attempt ${attempt}/${MAX_RETRIES} failed (status ${status})`);
      
      if (status === 429 && attempt < MAX_RETRIES) {
        console.warn(`⚠️ Rate limited, waiting ${RATE_LIMIT_BACKOFF/1000}s...`);
        await sleep(RATE_LIMIT_BACKOFF);
        continue;
      }
      
      if (attempt < MAX_RETRIES) {
        const delay = RETRY_DELAY_MIN + Math.random() * (RETRY_DELAY_MAX - RETRY_DELAY_MIN);
        await sleep(delay);
      }
    }
  }
  
  console.error(`❌ Product ${productId}: Failed after ${MAX_RETRIES} attempts`);
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Process single product with direct fetch
// ─────────────────────────────────────────────────────────────────────────────
async function enrichProductDirect(productId: string): Promise<boolean> {
  try {
    // Check cache first
    const { data: cacheRows } = await supabase
      .from('shop_products')
      .select('product_name, product_image, price, shop_name')
      .eq('product_id', productId)
      .limit(1);

    if (cacheRows && cacheRows.length > 0) {
      // Already cached - update shop_videos from cache
      const cached = cacheRows[0];
      console.log(`📋 Cache hit for ${productId}: name="${cached.product_name}", price="${cached.price}"`);
      
      const { error: updateError, count } = await supabase.from('shop_videos').update({
        product_name: cached.product_name,
        product_image: cached.product_image,
        price: cached.price,
        shop_name: cached.shop_name,
      }).eq('product_id', productId);
      
      if (updateError) {
        console.error(`❌ Update failed for ${productId}:`, updateError);
        return false;
      }
      
      if (count === 0) {
        console.warn(`⚠️ No videos updated for ${productId} - videos might not exist!`);
      }
      
      return true;
    }

    // Fetch product details
    console.log(`🔍 Fetching product ${productId}...`);
    const detailData = await fetchProductDetailsDirectly(productId);

    if (!detailData) {
      // Failed after 10 retries - delete from shop_videos
      console.log(`🗑️ Deleting product ${productId} - API failed after 10 retries`);
      await supabase.from('shop_videos').delete().eq('product_id', productId);
      return false;
    }

    // Extract product data
    const productsArray = (detailData as any).data?.products;
    if (!Array.isArray(productsArray) || productsArray.length === 0) {
      console.log(`🗑️ Deleting product ${productId} - No products array in response`);
      await supabase.from('shop_videos').delete().eq('product_id', productId);
      return false;
    }

    const firstProduct = productsArray[0];
    const productBase = firstProduct.product_base ?? {};
    const sellerObj = firstProduct.seller ?? {};

    // Extract fields
    let product_name = productBase.title ?? null;
    let product_image = null;
    
    if (
      Array.isArray(productBase.images) &&
      productBase.images.length > 0 &&
      Array.isArray(productBase.images[0].url_list) &&
      productBase.images[0].url_list.length > 0
    ) {
      product_image = productBase.images[0].url_list[0];
    }

    const priceObj = productBase.price ?? {};
    let price = null;
    
    if (priceObj.original_price !== undefined && typeof priceObj.original_price === 'string') {
      const match = priceObj.original_price.match(/[\d.]+/);
      if (match) price = match[0];
    } else if (typeof priceObj.real_price === 'number') {
      price = priceObj.real_price.toString();
    }

    const shop_name = sellerObj.name ?? null;

    // Cache product
    await supabase.from('shop_products').insert({
      product_id: productId,
      product_name,
      product_image,
      price,
      shop_name,
    });

    // Update videos
    const { error: updateError, count } = await supabase.from('shop_videos').update({
      product_name: product_name || 'Unknown Product',
      product_image: product_image || null,
      price: price || '0',
      shop_name: shop_name || 'Unknown Shop',
    }).eq('product_id', productId);

    if (updateError) {
      console.error(`❌ Failed to update videos for product ${productId}:`, updateError);
      return false;
    }

    console.log(`✅ Enriched product ${productId} (updated ${count} videos)`);
    return true;

  } catch (err) {
    console.error(`❌ Error enriching product ${productId}:`, err);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main parallel enrichment loop (TRUE PARALLEL)
// ─────────────────────────────────────────────────────────────────────────────
async function runParallelEnrichment() {
  console.log('🚀 Starting TRUE PARALLEL product enrichment (10 concurrent requests)...\n');
  console.log('⚠️  Note: Running at full speed - monitor for rate limits!\n');
  
  let totalProcessed = 0;
  let totalSuccess = 0;
  let hasMore = true;

  while (hasMore) {
    // Fetch products needing enrichment
    const { data: missingRows, error: missingErr } = await supabase
      .from('shop_videos')
      .select('product_id')
      .not('product_id', 'is', null)
      .or('product_name.is.null,product_image.is.null,shop_name.is.null')
      .limit(BATCH_SIZE);

    if (missingErr) {
      console.error('[Parallel] Error querying:', missingErr.message);
      await sleep(5000);
      continue;
    }

    if (!missingRows || missingRows.length === 0) {
      console.log('[Parallel] ✅ No more products to enrich!');
      hasMore = false;
      break;
    }

    // Deduplicate
    const uniqueProductIds = Array.from(
      new Set(missingRows.map((r: any) => r.product_id as string))
    );

    console.log(`\n📦 Processing batch of ${uniqueProductIds.length} products...`);
    
    // Log first few product IDs to debug
    if (uniqueProductIds.length > 0) {
      console.log(`🔍 Sample product IDs: ${uniqueProductIds.slice(0, 5).join(', ')}...`);
    }

    // Process in true parallel chunks of 10
    for (let i = 0; i < uniqueProductIds.length; i += CONCURRENT_PRODUCTS) {
      const chunk = uniqueProductIds.slice(i, i + CONCURRENT_PRODUCTS);
      const chunkStart = Date.now();
      
      console.log(`🚀 Launching ${chunk.length} parallel requests...`);
      
      // Launch all requests at once (TRUE PARALLEL)
      const promises = chunk.map(productId => enrichProductDirect(productId));
      const results = await Promise.allSettled(promises);
      
      const successCount = results.filter(r => r.status === 'fulfilled' && r.value === true).length;
      totalSuccess += successCount;
      totalProcessed += chunk.length;
      
      const chunkTime = ((Date.now() - chunkStart) / 1000).toFixed(1);
      console.log(`✅ Chunk complete in ${chunkTime}s: ${successCount}/${chunk.length} successful`);
      console.log(`📊 Overall progress: ${totalProcessed} processed, ${totalSuccess} successful\n`);
      
      // Small delay between chunks to avoid overwhelming the API
      if (i + CONCURRENT_PRODUCTS < uniqueProductIds.length) {
        await sleep(100);
      }
    }
  }

  const successRate = totalProcessed > 0 ? ((totalSuccess / totalProcessed) * 100).toFixed(1) : 0;
  console.log(`\n🎉 Parallel enrichment complete!`);
  console.log(`📊 Final stats: ${totalSuccess}/${totalProcessed} successful (${successRate}%)`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper function
// ─────────────────────────────────────────────────────────────────────────────
function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─────────────────────────────────────────────────────────────────────────────
// Run enricher
// ─────────────────────────────────────────────────────────────────────────────
runParallelEnrichment().catch(console.error);