#!/usr/bin/env node

/**
 * Conditional Fetch Script
 * 
 * This script checks if places data needs to be fetched based on the
 * lastUpdated timestamp. If data is older than 1 month or doesn't exist,
 * it fetches new data. Otherwise, it skips the fetch to conserve API tokens.
 * 
 * Storage is checked first when local data is absent – this avoids
 * unnecessary Google Places API calls after a fresh deploy.
 * 
 * Usage:
 *   node conditional-fetch.js          # Fetch only if data is stale
 *   node conditional-fetch.js --force  # Force fetch regardless of age
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const storage = require('../storage');
const { main: fetchData, CONFIG: FETCH_CONFIG } = require('./fetch-places-data.js');

// Configuration
const DATA_FILE = path.join(__dirname, '../data/places-data.json');
const SAMPLE_FILE = path.join(__dirname, '../data/sample-places-data.json');
const PHOTOS_DIR = path.join(__dirname, '../assets/place-photos');
const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

/**
 * Try to restore places data and images from storage.
 * Returns true when data was successfully restored (so a Google API call is unnecessary).
 */
async function restoreFromStorage() {
  if (!storage.isConfigured()) return false;

  console.log('☁️  Checking storage for cached places data...\n');
  try {
    const data = await storage.downloadJSON(storage.PUBLIC_IDS.PLACES_DATA);
    if (!data || !data.lastUpdated) return false;

    const lastUpdated = new Date(data.lastUpdated);
    const ageDays = Math.floor((Date.now() - lastUpdated) / (24 * 60 * 60 * 1000));

    if (Date.now() - lastUpdated > ONE_MONTH_MS) {
      console.log(`   ☁️  Stored data is stale (${ageDays} days) — will re-fetch from Google.\n`);
      return false;
    }

    console.log(`   ☁️  Stored data is fresh (${ageDays} days old) — restoring locally.\n`);

    // Write to local files so the server and conditional checks use this data
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const jsonOutput = JSON.stringify(data, null, 2);
    fs.writeFileSync(DATA_FILE, jsonOutput, 'utf8');
    fs.writeFileSync(SAMPLE_FILE, jsonOutput, 'utf8');

    console.log('✅ Places data restored from storage.\n');
    return true;
  } catch (e) {
    console.warn('⚠️  Could not restore places data from storage:', e.message, '\n');
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
 * Compute approximate distance (in meters) between two lat/lng points
 * using the equirectangular approximation. Fast and accurate enough at
 * small distances (< 50 km).
 */
function approxDistanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371e3; // Earth radius in meters
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLng = (lng2 - lng1) * toRad * Math.cos(((lat1 + lat2) / 2) * toRad);
  return R * Math.sqrt(dLat * dLat + dLng * dLng);
}

/**
 * Filter places-data.json to only include places within the current
 * SEARCH_RADIUS of the center point.
 *
 * Reads the FULL dataset from sample-places-data.json (which always holds
 * the complete set of fetched places regardless of radius changes) and
 * writes the filtered result to places-data.json.
 *
 * This allows the radius to be fine-tuned without re-fetching from the API:
 *   - Shrinking the radius removes distant places immediately.
 *   - Enlarging the radius restores places that were previously outside,
 *     as long as they were in the original fetch.
 */
function filterPlacesByRadius() {
  // Read from sample (the unfiltered source of truth)
  const sourceFile = fs.existsSync(SAMPLE_FILE) ? SAMPLE_FILE : DATA_FILE;
  if (!fs.existsSync(sourceFile)) return;

  try {
    const data = JSON.parse(fs.readFileSync(sourceFile, 'utf8'));
    const centerLat = FETCH_CONFIG.CENTER_LAT;
    const centerLng = FETCH_CONFIG.CENTER_LNG;
    const radius = FETCH_CONFIG.SEARCH_RADIUS;

    const categories = ['locations', 'restaurants', 'accommodations'];
    let totalBefore = 0;
    let totalAfter = 0;

    for (const cat of categories) {
      if (!Array.isArray(data[cat])) continue;
      const before = data[cat].length;
      totalBefore += before;
      data[cat] = data[cat].filter(place => {
        if (!place.coordinates) return true; // keep places without coords
        const dist = approxDistanceMeters(
          centerLat, centerLng,
          place.coordinates.lat, place.coordinates.lng
        );
        return dist <= radius;
      });
      totalAfter += data[cat].length;
    }

    const removed = totalBefore - totalAfter;
    if (removed > 0) {
      console.log(`📏 Radius filter (${radius}m): kept ${totalAfter}/${totalBefore} places (removed ${removed} outside radius)\n`);
    } else {
      console.log(`📏 Radius filter (${radius}m): all ${totalBefore} places are within radius\n`);
    }

    // Write the filtered data to the working file
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.warn('⚠️  Could not filter places by radius:', error.message);
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
    // Before hitting the Google Places API, check whether storage already
    // has up-to-date data from a previous run (e.g. after a fresh deploy).
    if (!forceFlag) {
      const restored = await restoreFromStorage();
      if (restored) {
        // If images are still missing after restoring data, they will be
        // downloaded on-demand by the server photo proxy route.
        console.log('💡 Tip: Use --force flag to fetch fresh data from Google regardless of cache.\n');
        syncSampleData();
        filterPlacesByRadius();
        return;
      }
    }

    // Fetch new data (fetch-places-data.js writes both places-data.json and
    // sample, and downloads images when the photos folder is missing).
    await fetchData();
    // After a fresh fetch, filter to the current radius
    filterPlacesByRadius();
  } else {
    // Data is fresh and images are present - skip API calls entirely.
    console.log('💡 Tip: Use --force flag to fetch regardless of cache age.\n');
    syncSampleData();
    // Apply radius filter from full sample data so radius changes take effect
    // without a re-fetch
    filterPlacesByRadius();
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
