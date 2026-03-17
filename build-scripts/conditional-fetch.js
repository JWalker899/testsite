#!/usr/bin/env node

/**
 * Conditional Fetch Script
 * 
 * This script checks if places data needs to be fetched based on the
 * lastUpdated timestamp. If data is older than 1 month or doesn't exist,
 * it fetches new data. Otherwise, it skips the fetch to conserve API tokens.
 * 
 * Cloudinary is checked first when local data is absent – this avoids
 * unnecessary Google Places API calls after a fresh deploy.
 * 
 * Usage:
 *   node conditional-fetch.js          # Fetch only if data is stale
 *   node conditional-fetch.js --force  # Force fetch regardless of age
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const cloudinaryStorage = require('../cloudinary-storage');
const { main: fetchData } = require('./fetch-places-data.js');

// Configuration
const DATA_FILE = path.join(__dirname, '../data/places-data.json');
const SAMPLE_FILE = path.join(__dirname, '../data/sample-places-data.json');
const PHOTOS_DIR = path.join(__dirname, '../assets/place-photos');
const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

/**
 * Try to restore places data and images from Cloudinary.
 * Returns true when data was successfully restored (so a Google API call is unnecessary).
 */
async function restoreFromCloudinary() {
  if (!cloudinaryStorage.isConfigured()) return false;

  console.log('☁️  Checking Cloudinary for cached places data...\n');
  try {
    const data = await cloudinaryStorage.downloadJSON(cloudinaryStorage.PUBLIC_IDS.PLACES_DATA);
    if (!data || !data.lastUpdated) return false;

    const lastUpdated = new Date(data.lastUpdated);
    const ageDays = Math.floor((Date.now() - lastUpdated) / (24 * 60 * 60 * 1000));

    if (Date.now() - lastUpdated > ONE_MONTH_MS) {
      console.log(`   ☁️  Cloudinary data is stale (${ageDays} days) — will re-fetch from Google.\n`);
      return false;
    }

    console.log(`   ☁️  Cloudinary data is fresh (${ageDays} days old) — restoring locally.\n`);

    // Write to local files so the server and conditional checks use this data
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const jsonOutput = JSON.stringify(data, null, 2);
    fs.writeFileSync(DATA_FILE, jsonOutput, 'utf8');
    fs.writeFileSync(SAMPLE_FILE, jsonOutput, 'utf8');

    console.log('✅ Places data restored from Cloudinary.\n');
    return true;
  } catch (e) {
    console.warn('⚠️  Could not restore places data from Cloudinary:', e.message, '\n');
    return false;
  }
}

/**
 * Check if data file exists and is recent enough
 */
function shouldFetchData(forceFlag) {
  // If force flag is set, always fetch
  if (forceFlag) {
    console.log('🔄 Force flag detected - fetching fresh data...\n');
    return true;
  }

  // Determine which file to check for the timestamp
  let fileToCheck = null;
  if (fs.existsSync(DATA_FILE)) {
    fileToCheck = DATA_FILE;
  } else if (fs.existsSync(SAMPLE_FILE)) {
    // places-data.json may have been lost after a rebuild; check sample data
    // (sample data is overwritten with real data on each successful fetch)
    fileToCheck = SAMPLE_FILE;
    console.log('📋 places-data.json not found - checking sample data for a recent fetch timestamp...\n');
  } else {
    console.log('📭 No existing data found - fetching fresh data...\n');
    return true;
  }

  try {
    // Read existing data
    const data = JSON.parse(fs.readFileSync(fileToCheck, 'utf8'));
    
    // Check if lastUpdated field exists
    if (!data.lastUpdated) {
      console.log('⚠️  Data file missing lastUpdated timestamp - fetching fresh data...\n');
      return true;
    }

    // Calculate age of data
    const lastUpdated = new Date(data.lastUpdated);
    const now = new Date();
    const ageMs = now - lastUpdated;
    const ageDays = Math.floor(ageMs / (24 * 60 * 60 * 1000));

    console.log(`📊 Existing data status:`);
    console.log(`   - Last updated: ${lastUpdated.toLocaleString()}`);
    console.log(`   - Age: ${ageDays} days`);

    // Check if data is older than 1 month
    if (ageMs > ONE_MONTH_MS) {
      console.log(`   - Status: ⏰ Stale (> 30 days)\n`);
      console.log('🔄 Fetching fresh data...\n');
      return true;
    } else {
      console.log(`   - Status: ✅ Fresh (< 30 days)\n`);
      console.log('✨ Using cached data - skipping fetch to conserve API tokens.\n');
      return false;
    }
  } catch (error) {
    console.error('❌ Error reading existing data:', error.message);
    console.log('🔄 Fetching fresh data...\n');
    return true;
  }
}

/**
 * Sync places-data.json to sample-places-data.json if they are out of sync.
 * This ensures the sample file always holds the latest real data so it can
 * serve as a persistent fallback when places-data.json is missing.
 */
function syncSampleData() {
  if (!fs.existsSync(DATA_FILE)) return;

  try {
    const placesContent = fs.readFileSync(DATA_FILE, 'utf8');
    const placesData = JSON.parse(placesContent);

    // Only overwrite when the timestamps differ (sample is stale or missing)
    let sampleData = null;
    if (fs.existsSync(SAMPLE_FILE)) {
      sampleData = JSON.parse(fs.readFileSync(SAMPLE_FILE, 'utf8'));
    }

    if (!sampleData || sampleData.lastUpdated !== placesData.lastUpdated) {
      console.log('🔄 Syncing real data to sample file for persistence...\n');
      fs.writeFileSync(SAMPLE_FILE, placesContent, 'utf8');
      console.log('✅ Sample file updated.\n');
    }
  } catch (error) {
    console.warn('⚠️  Could not sync sample data:', error.message);
  }
}

/**
 * Main function
 */
async function main() {
  // Check for force flag
  const forceFlag = process.argv.includes('--force');

  console.log('🔍 Checking if data fetch is needed...\n');

  // The 30-day recency check applies only to place data (reviews, info, etc.)
  const needsData = shouldFetchData(forceFlag);

  // Images must always be checked independently of data freshness:
  // if the photos folder is absent, we must download images via the API.
  const needsImages = !fs.existsSync(PHOTOS_DIR);
  if (needsImages && !needsData) {
    console.log('📸 Images folder not found - fetching data to download images...\n');
  }

  if (needsData || needsImages) {
    // Before hitting the Google Places API, check whether Cloudinary already
    // has up-to-date data from a previous run (e.g. after a fresh deploy).
    if (!forceFlag) {
      const restored = await restoreFromCloudinary();
      if (restored) {
        // If images are still missing after restoring data, they will be
        // downloaded on-demand by the server photo proxy route.
        console.log('💡 Tip: Use --force flag to fetch fresh data from Google regardless of cache.\n');
        syncSampleData();
        return;
      }
    }

    // Fetch new data (fetch-places-data.js writes both places-data.json and
    // sample, and downloads images when the photos folder is missing).
    await fetchData();
  } else {
    // Data is fresh and images are present - skip API calls entirely.
    console.log('💡 Tip: Use --force flag to fetch regardless of cache age.\n');
    syncSampleData();
  }
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { main };
