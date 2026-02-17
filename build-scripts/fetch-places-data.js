#!/usr/bin/env node

/**
 * Google Places Data Fetcher
 * 
 * This script fetches tourist attractions, restaurants, and accommodations
 * near Rasnov, Romania using Google Places API. Data is saved to a JSON file
 * for build-time integration (no runtime API calls).
 * 
 * Features:
 * - Nearby Search API integration
 * - Photo fetching with Google Places Photo API
 * - Unsplash fallback for higher quality images
 * - Error handling and retry logic
 * - Rate limiting to stay within free tier
 * - Progress indicators
 */

require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  CENTER_LAT: 45.5889,
  CENTER_LNG: 25.4631,
  SEARCH_RADIUS: 10000, // 10km in meters
  GOOGLE_API_KEY: process.env.GOOGLE_PLACES_API_KEY,
  UNSPLASH_API_KEY: process.env.UNSPLASH_ACCESS_KEY,
  OUTPUT_FILE: path.join(__dirname, '../data/places-data.json'),
  MAX_PHOTOS_PER_PLACE: 3,
  MAX_RESULTS_PER_TYPE: 20,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 2000, // 2 seconds
  RATE_LIMIT_DELAY: 100, // 100ms between requests
};

// Place types to search for
const PLACE_TYPES = {
  locations: 'tourist_attraction',
  restaurants: 'restaurant',
  accommodations: 'lodging',
};

/**
 * Sleep utility for rate limiting
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry wrapper for API calls
 */
async function retryRequest(fn, retries = CONFIG.RETRY_ATTEMPTS) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === retries - 1) throw error;
      console.log(`  ⚠️  Attempt ${i + 1} failed, retrying in ${CONFIG.RETRY_DELAY}ms...`);
      await sleep(CONFIG.RETRY_DELAY);
    }
  }
}

/**
 * Fetch places using Google Places API Nearby Search
 */
async function fetchPlaces(type, typeName) {
  console.log(`\n📍 Fetching ${typeName}...`);
  
  const url = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json';
  const params = {
    location: `${CONFIG.CENTER_LAT},${CONFIG.CENTER_LNG}`,
    radius: CONFIG.SEARCH_RADIUS,
    type: type,
    key: CONFIG.GOOGLE_API_KEY,
  };

  try {
    const response = await retryRequest(() => axios.get(url, { params }));
    
    if (response.data.status === 'OK') {
      const places = response.data.results.slice(0, CONFIG.MAX_RESULTS_PER_TYPE);
      console.log(`  ✅ Found ${places.length} ${typeName}`);
      return places;
    } else if (response.data.status === 'ZERO_RESULTS') {
      console.log(`  ℹ️  No ${typeName} found in the area`);
      return [];
    } else {
      throw new Error(`API returned status: ${response.data.status}`);
    }
  } catch (error) {
    console.error(`  ❌ Error fetching ${typeName}:`, error.message);
    return [];
  }
}

/**
 * Fetch place details for additional information
 */
async function fetchPlaceDetails(placeId) {
  const url = 'https://maps.googleapis.com/maps/api/place/details/json';
  const params = {
    place_id: placeId,
    fields: 'formatted_phone_number,opening_hours,website,reviews',
    key: CONFIG.GOOGLE_API_KEY,
  };

  try {
    const response = await retryRequest(() => axios.get(url, { params }));
    await sleep(CONFIG.RATE_LIMIT_DELAY);
    
    if (response.data.status === 'OK') {
      return response.data.result;
    }
    return null;
  } catch (error) {
    console.error(`    ⚠️  Could not fetch details for ${placeId}`);
    return null;
  }
}

/**
 * Get photo URL from Google Places Photo API
 */
function getGooglePhotoUrl(photoReference, maxWidth = 800) {
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photo_reference=${photoReference}&key=${CONFIG.GOOGLE_API_KEY}`;
}

/**
 * Fetch Unsplash photos as fallback
 */
async function fetchUnsplashPhoto(query) {
  // Check if Unsplash API key is configured (not placeholder)
  if (!CONFIG.UNSPLASH_API_KEY || 
      CONFIG.UNSPLASH_API_KEY === 'your_unsplash_access_key_here' ||
      CONFIG.UNSPLASH_API_KEY.startsWith('your_')) {
    return null;
  }

  try {
    const response = await axios.get('https://api.unsplash.com/search/photos', {
      params: {
        query: query,
        per_page: 1,
        orientation: 'landscape',
      },
      headers: {
        'Authorization': `Client-ID ${CONFIG.UNSPLASH_API_KEY}`,
      },
    });

    await sleep(CONFIG.RATE_LIMIT_DELAY);

    if (response.data.results && response.data.results.length > 0) {
      const photo = response.data.results[0];
      return {
        url: photo.urls.regular,
        attribution: `Photo by ${photo.user.name} on Unsplash`,
      };
    }
  } catch (error) {
    console.error(`    ⚠️  Could not fetch Unsplash photo for "${query}"`);
  }

  return null;
}

/**
 * Process and format a single place
 */
async function processPlace(place, index, total) {
  console.log(`  Processing [${index + 1}/${total}] ${place.name}...`);

  const processedPlace = {
    id: place.place_id,
    name: place.name,
    coordinates: {
      lat: place.geometry.location.lat,
      lng: place.geometry.location.lng,
    },
    rating: place.rating || null,
    userRatingsTotal: place.user_ratings_total || 0,
    priceLevel: place.price_level || null,
    address: place.vicinity || place.formatted_address || null,
    photos: [],
  };

  // Fetch place details for additional info
  const details = await fetchPlaceDetails(place.place_id);
  if (details) {
    processedPlace.phone = details.formatted_phone_number || null;
    processedPlace.website = details.website || null;
    
    if (details.opening_hours) {
      processedPlace.openingHours = {
        openNow: details.opening_hours.open_now || false,
        weekdayText: details.opening_hours.weekday_text || [],
      };
    }
  }

  // Process photos
  if (place.photos && place.photos.length > 0) {
    const photoCount = Math.min(place.photos.length, CONFIG.MAX_PHOTOS_PER_PLACE);
    for (let i = 0; i < photoCount; i++) {
      const photo = place.photos[i];
      processedPlace.photos.push({
        url: getGooglePhotoUrl(photo.photo_reference),
        attribution: photo.html_attributions ? photo.html_attributions[0] : 'Google Places',
      });
    }
  } else {
    // Try Unsplash as fallback
    const unsplashPhoto = await fetchUnsplashPhoto(`${place.name} Rasnov Romania`);
    if (unsplashPhoto) {
      processedPlace.photos.push(unsplashPhoto);
    }
  }

  return processedPlace;
}

/**
 * Main function to fetch all data
 */
async function main() {
  console.log('🚀 Starting Google Places data fetch...');
  console.log(`📍 Center: ${CONFIG.CENTER_LAT}, ${CONFIG.CENTER_LNG}`);
  console.log(`📏 Radius: ${CONFIG.SEARCH_RADIUS}m`);

  // Validate API key
  if (!CONFIG.GOOGLE_API_KEY || 
      CONFIG.GOOGLE_API_KEY === 'your_google_places_api_key_here' ||
      CONFIG.GOOGLE_API_KEY.startsWith('your_')) {
    console.error('\n❌ ERROR: GOOGLE_PLACES_API_KEY not set in .env file');
    console.error('Please create a .env file based on .env.example and add your API key.');
    process.exit(1);
  }

  const result = {
    lastUpdated: new Date().toISOString(),
    center: {
      lat: CONFIG.CENTER_LAT,
      lng: CONFIG.CENTER_LNG,
    },
    locations: [],
    restaurants: [],
    accommodations: [],
  };

  // Fetch each place type
  for (const [key, type] of Object.entries(PLACE_TYPES)) {
    const places = await fetchPlaces(type, key);
    
    // Process each place
    for (let i = 0; i < places.length; i++) {
      try {
        const processedPlace = await processPlace(places[i], i, places.length);
        result[key].push(processedPlace);
        await sleep(CONFIG.RATE_LIMIT_DELAY); // Rate limiting
      } catch (error) {
        console.error(`    ❌ Error processing ${places[i].name}:`, error.message);
      }
    }
  }

  // Save to file
  console.log(`\n💾 Saving data to ${CONFIG.OUTPUT_FILE}...`);
  
  // Ensure data directory exists
  const dataDir = path.dirname(CONFIG.OUTPUT_FILE);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  fs.writeFileSync(
    CONFIG.OUTPUT_FILE,
    JSON.stringify(result, null, 2),
    'utf8'
  );

  // Print summary
  console.log('\n✅ Data fetch complete!');
  console.log(`📊 Summary:`);
  console.log(`   - Locations: ${result.locations.length}`);
  console.log(`   - Restaurants: ${result.restaurants.length}`);
  console.log(`   - Accommodations: ${result.accommodations.length}`);
  console.log(`   - Total: ${result.locations.length + result.restaurants.length + result.accommodations.length}`);
  console.log(`   - Last updated: ${result.lastUpdated}`);
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { main };
