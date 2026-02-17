#!/usr/bin/env node

/**
 * Conditional Fetch Script
 * 
 * This script checks if places data needs to be fetched based on the
 * lastUpdated timestamp. If data is older than 1 month or doesn't exist,
 * it fetches new data. Otherwise, it skips the fetch to conserve API tokens.
 * 
 * Usage:
 *   node conditional-fetch.js          # Fetch only if data is stale
 *   node conditional-fetch.js --force  # Force fetch regardless of age
 */

const fs = require('fs');
const path = require('path');
const { main: fetchData } = require('./fetch-places-data.js');

// Configuration
const DATA_FILE = path.join(__dirname, '../data/places-data.json');
const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

/**
 * Check if data file exists and is recent enough
 */
function shouldFetchData(forceFlag) {
  // If force flag is set, always fetch
  if (forceFlag) {
    console.log('🔄 Force flag detected - fetching fresh data...\n');
    return true;
  }

  // Check if data file exists
  if (!fs.existsSync(DATA_FILE)) {
    console.log('📭 No existing data found - fetching fresh data...\n');
    return true;
  }

  try {
    // Read existing data
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    
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
 * Main function
 */
async function main() {
  // Check for force flag
  const forceFlag = process.argv.includes('--force');

  console.log('🔍 Checking if data fetch is needed...\n');

  // Determine if we should fetch
  if (shouldFetchData(forceFlag)) {
    // Fetch new data
    await fetchData();
  } else {
    // Skip fetch
    console.log('💡 Tip: Use --force flag to fetch regardless of cache age.\n');
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
