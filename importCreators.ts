// ─────────────────────────────────────────────────────────────────────────────
// File: importCreators.ts
// 
// Bulk import script for TikTok creator handles
// Supports CSV files, arrays, or API data sources
// ─────────────────────────────────────────────────────────────────────────────

import fs from 'fs';
import path from 'path';
import { supabase } from './supabaseClient';

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────
const BATCH_SIZE = 1000; // Insert 1000 handles per batch to avoid timeouts
const CSV_FILE_PATH = './creators.csv'; // Path to your CSV file

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Clean and validate username
// ─────────────────────────────────────────────────────────────────────────────
function cleanUsername(username: string): string | null {
  if (!username) return null;
  
  // Remove @ symbol, whitespace, and convert to lowercase
  const cleaned = username.trim().toLowerCase().replace(/^@/, '');
  
  // Basic validation - alphanumeric, underscores, dots
  if (!/^[a-zA-Z0-9._]+$/.test(cleaned)) return null;
  if (cleaned.length < 1 || cleaned.length > 50) return null;
  
  return cleaned;
}

// ─────────────────────────────────────────────────────────────────────────────
// Method 1: Import from CSV file
// ─────────────────────────────────────────────────────────────────────────────
export async function importFromCSV(filePath: string = CSV_FILE_PATH): Promise<void> {
  console.log(`📁 Reading CSV file: ${filePath}`);
  
  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    return;
  }

  const csvContent = fs.readFileSync(filePath, 'utf-8');
  const lines = csvContent.split('\n');
  
  // Skip header row and extract usernames
  const usernames: string[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Handle CSV with commas or just plain usernames
    const username = line.includes(',') ? line.split(',')[0] : line;
    const cleaned = cleanUsername(username);
    
    if (cleaned && !usernames.includes(cleaned)) {
      usernames.push(cleaned);
    }
  }

  console.log(`📊 Found ${usernames.length} unique usernames in CSV`);
  await bulkInsertHandles(usernames);
}

// ─────────────────────────────────────────────────────────────────────────────
// Method 2: Import from array (for programmatic use)
// ─────────────────────────────────────────────────────────────────────────────
export async function importFromArray(usernames: string[]): Promise<void> {
  console.log(`📊 Processing ${usernames.length} usernames from array`);
  
  const cleanedUsernames = usernames
    .map(cleanUsername)
    .filter((u): u is string => u !== null)
    .filter((u, i, arr) => arr.indexOf(u) === i); // Remove duplicates

  console.log(`📊 ${cleanedUsernames.length} valid usernames after cleaning`);
  await bulkInsertHandles(cleanedUsernames);
}

// ─────────────────────────────────────────────────────────────────────────────
// Core bulk insert function with batching
// ─────────────────────────────────────────────────────────────────────────────
async function bulkInsertHandles(usernames: string[]): Promise<void> {
  console.log(`🚀 Starting bulk insert of ${usernames.length} handles...`);
  
  let totalInserted = 0;
  let totalSkipped = 0;
  
  // Process in batches to avoid database timeouts
  for (let i = 0; i < usernames.length; i += BATCH_SIZE) {
    const batch = usernames.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(usernames.length / BATCH_SIZE);
    
    console.log(`📦 Processing batch ${batchNum}/${totalBatches} (${batch.length} handles)`);
    
    try {
      // Check which handles already exist
      const { data: existingHandles, error: checkError } = await supabase
        .from('tiktok_handles')
        .select('username')
        .in('username', batch);

      if (checkError) {
        console.error(`❌ Error checking existing handles:`, checkError.message);
        continue;
      }

      const existingUsernames = new Set((existingHandles || []).map(h => h.username));
      const newHandles = batch
        .filter(username => !existingUsernames.has(username))
        .map(username => ({
          username,
          discovery_source: 'manual' as const,
          status: 'active' as const,
          total_videos_found: 0,
          shop_videos_found: 0,
          shop_ratio: 0,
          consecutive_days_no_shop: 0,
          consecutive_days_no_posts: 0
        }));

      if (newHandles.length === 0) {
        console.log(`⏭️ Batch ${batchNum}: All handles already exist, skipping`);
        totalSkipped += batch.length;
        continue;
      }

      // Insert new handles
      const { error: insertError } = await supabase
        .from('tiktok_handles')
        .insert(newHandles);

      if (insertError) {
        console.error(`❌ Batch ${batchNum} failed:`, insertError.message);
        continue;
      }

      const inserted = newHandles.length;
      const skipped = batch.length - inserted;
      
      totalInserted += inserted;
      totalSkipped += skipped;
      
      console.log(`✅ Batch ${batchNum}: Inserted ${inserted}, skipped ${skipped} (already existed)`);
      
      // Small delay to avoid rate limits
      if (i + BATCH_SIZE < usernames.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
    } catch (error) {
      console.error(`❌ Batch ${batchNum} error:`, error);
    }
  }
  
  console.log(`\n🎉 Bulk import completed!`);
  console.log(`   📝 Total inserted: ${totalInserted}`);
  console.log(`   ⏭️ Total skipped: ${totalSkipped}`);
  console.log(`   📊 Total processed: ${totalInserted + totalSkipped}`);
  
  // Show final stats
  await showImportStats();
}

// ─────────────────────────────────────────────────────────────────────────────
// Show import statistics
// ─────────────────────────────────────────────────────────────────────────────
async function showImportStats(): Promise<void> {
  const { data, error } = await supabase
    .from('tiktok_handles')
    .select('discovery_source, status')
    .eq('discovery_source', 'manual');

  if (error) {
    console.error('❌ Error fetching stats:', error.message);
    return;
  }

  const totalManual = data?.length || 0;
  const activeManual = data?.filter(h => h.status === 'active').length || 0;
  
  console.log(`\n📈 Import Statistics:`);
  console.log(`   📝 Total manual handles: ${totalManual}`);
  console.log(`   ✅ Active manual handles: ${activeManual}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI interface
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  switch (command) {
    case 'csv':
      const csvPath = args[1] || CSV_FILE_PATH;
      await importFromCSV(csvPath);
      break;
      
    case 'test':
      // Test with a small array
      const testUsernames = ['tiktokmademebuyit', 'shopwithkennedi', 'tiktokfinds'];
      await importFromArray(testUsernames);
      break;
      
    case 'stats':
      await showImportStats();
      break;
      
    default:
      console.log(`
🔧 TikTok Creator Import Tool

Usage:
  npm run import csv [file.csv]    - Import from CSV file
  npm run import test              - Test with sample usernames
  npm run import stats             - Show current import statistics

Examples:
  npm run import csv creators.csv
  npm run import csv
  npm run import test
      `);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}