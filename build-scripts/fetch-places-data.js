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
const cloudinaryStorage = require('../cloudinary-storage');

// Places to exclude from results regardless of what the API returns.
// Names are matched case-insensitively; partial matches are NOT used – the
// full place name must appear in this list.
const BLACKLIST = [
  'Rockstad Extrem Fest',
];
const BLACKLIST_LOWER = BLACKLIST.map(name => name.toLowerCase());

// Configuration
const CONFIG = {
  CENTER_LAT: 45.5889,
  CENTER_LNG: 25.4631,
  SEARCH_RADIUS: 5000, // 5km in meters – covers the full extent of Rasnov
  GOOGLE_API_KEY: process.env.GOOGLE_PLACES_API_KEY,
  UNSPLASH_API_KEY: process.env.UNSPLASH_ACCESS_KEY,
  OUTPUT_FILE: path.join(__dirname, '../data/places-data.json'),
  SAMPLE_FILE: path.join(__dirname, '../data/sample-places-data.json'),
  PHOTOS_DIR: path.join(__dirname, '../assets/place-photos'),
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

/** Returns the shared base name used for both local files and Cloudinary public IDs. */
const photoBaseName = (placeId, index) => `${placeId}_${index}`;

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

  // Use a keyword to anchor tourist attractions and restaurants to Rasnov.
  // Lodging listings often don't mention the city name explicitly, so omitting
  // the keyword avoids zero results for accommodations.
  if (type !== 'lodging') {
    params.keyword = 'Rasnov';
  }

  try {
    const response = await retryRequest(() => axios.get(url, { params }));
    
    if (response.data.status === 'OK') {
      const allPlaces = response.data.results;
      // Filter out blacklisted places (case-insensitive exact name match)
      const filtered = allPlaces.filter(p => !BLACKLIST_LOWER.includes((p.name || '').toLowerCase()));
      const skipped = allPlaces.length - filtered.length;
      if (skipped > 0) {
        console.log(`  🚫 Skipped ${skipped} blacklisted place(s)`);
      }
      const places = filtered.slice(0, CONFIG.MAX_RESULTS_PER_TYPE);
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
 * Fetch place name and address in Romanian using the Place Details API.
 * Returns { name, address } in Romanian, or null on failure.
 */
async function fetchPlaceDetailsRo(placeId) {
  const url = 'https://maps.googleapis.com/maps/api/place/details/json';
  const params = {
    place_id: placeId,
    fields: 'name,vicinity',
    language: 'ro',
    key: CONFIG.GOOGLE_API_KEY,
  };

  try {
    const response = await retryRequest(() => axios.get(url, { params }));
    await sleep(CONFIG.RATE_LIMIT_DELAY);

    if (response.data.status === 'OK') {
      return {
        name: response.data.result.name || null,
        address: response.data.result.vicinity || null,
      };
    }
    return null;
  } catch (error) {
    console.error(`    ⚠️  Could not fetch Romanian details for ${placeId}`);
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
 * Check whether images should be downloaded this run.
 * True when --download-images CLI flag is present, the photos directory doesn't
 * exist yet (first run), or the directory is empty (no cached images).
 */
function shouldDownloadImages() {
  if (process.argv.includes('--download-images')) return true;
  if (!fs.existsSync(CONFIG.PHOTOS_DIR)) return true;
  // Also download when the cache directory is empty
  const cached = fs.readdirSync(CONFIG.PHOTOS_DIR).filter(f => /\.(jpg|png)$/i.test(f));
  if (cached.length === 0) return true;
  return false;
}

/**
 * Download a Google Places photo and save it to the local photos folder.
 * Returns the relative URL path to the saved image, or null on failure.
 */
async function downloadPhoto(photoReference, placeId, index) {
  const remoteUrl = getGooglePhotoUrl(photoReference);
  try {
    const response = await retryRequest(() =>
      axios.get(remoteUrl, { responseType: 'arraybuffer' })
    );
    await sleep(CONFIG.RATE_LIMIT_DELAY);

    const contentType = (response.headers['content-type'] || 'image/jpeg').split(';')[0].trim();
    const ext = contentType === 'image/png' ? 'png' : 'jpg';
    const baseName = photoBaseName(placeId, index);
    const filename = `${baseName}.${ext}`;
    const filepath = path.join(CONFIG.PHOTOS_DIR, filename);

    if (!fs.existsSync(CONFIG.PHOTOS_DIR)) {
      fs.mkdirSync(CONFIG.PHOTOS_DIR, { recursive: true });
    }

    const imageData = Buffer.from(response.data);
    fs.writeFileSync(filepath, imageData);
    console.log(`    📸 Saved photo: ${filename}`);

    // Upload to Cloudinary for persistence across deploys
    if (cloudinaryStorage.isConfigured()) {
      try {
        await cloudinaryStorage.uploadImageBuffer(cloudinaryStorage.PUBLIC_IDS.photoId(baseName), imageData);
        console.log(`    ☁️  Uploaded photo to Cloudinary: ${filename}`);
      } catch (e) {
        console.warn(`    ⚠️  Could not upload photo ${filename} to Cloudinary:`, e.message);
      }
    }

    return `/assets/place-photos/${filename}`;
  } catch (error) {
    console.error(`    ⚠️  Could not download photo for ${placeId}[${index}]:`, error.message);
    return null;
  }
}

/**
 * Resolve the local path for an already-downloaded photo, or null if not present.
 */
function getLocalPhotoPath(placeId, index) {
  for (const ext of ['jpg', 'png']) {
    const filename = `${placeId}_${index}.${ext}`;
    if (fs.existsSync(path.join(CONFIG.PHOTOS_DIR, filename))) {
      return `/assets/place-photos/${filename}`;
    }
  }
  return null;
}

/**
 * Load existing places data from the output file or sample file.
 * Used to detect which places already have cached photos so we can skip
 * redundant Google Places Photo API calls.
 */
function loadExistingData() {
  for (const file of [CONFIG.OUTPUT_FILE, CONFIG.SAMPLE_FILE]) {
    if (fs.existsSync(file)) {
      try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
      } catch (e) {
        console.warn(`  ⚠️  Could not parse ${path.basename(file)}:`, e.message);
      }
    }
  }
  return null;
}

/**
 * Build a Map of placeId → photos array from existing data.
 * Only includes entries where the place has at least one photo.
 */
function buildPhotoLookup(data) {
  const lookup = new Map();
  if (!data) return lookup;
  for (const key of ['locations', 'restaurants', 'accommodations']) {
    for (const place of (data[key] || [])) {
      if (place.id && Array.isArray(place.photos) && place.photos.length > 0) {
        lookup.set(place.id, place.photos);
      }
    }
  }
  return lookup;
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
async function processPlace(place, index, total, downloadImages, existingPhotos) {
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

  // Fetch English details and Romanian name/address in parallel
  const [details, detailsRo] = await Promise.all([
    fetchPlaceDetails(place.place_id),
    fetchPlaceDetailsRo(place.place_id),
  ]);

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

  if (detailsRo) {
    if (detailsRo.name && detailsRo.name !== processedPlace.name) {
      processedPlace.name_ro = detailsRo.name;
    }
    if (detailsRo.address && detailsRo.address !== processedPlace.address) {
      processedPlace.address_ro = detailsRo.address;
    }
  }

  // Process photos — reuse cached photos when available to avoid extra API calls
  const cachedPhotos = existingPhotos.get(place.place_id);
  if (cachedPhotos && cachedPhotos.length > 0) {
    console.log(`    📸 Reusing ${cachedPhotos.length} cached photo(s)`);
    processedPlace.photos = cachedPhotos;
  } else if (place.photos && place.photos.length > 0) {
    const photoCount = Math.min(place.photos.length, CONFIG.MAX_PHOTOS_PER_PLACE);
    for (let i = 0; i < photoCount; i++) {
      const photo = place.photos[i];
      let photoUrl = null;

      if (downloadImages) {
        // Download image bytes and store locally
        photoUrl = await downloadPhoto(photo.photo_reference, place.place_id, i);
      } else {
        // Use already-downloaded local image if available; skip to avoid billable URL
        photoUrl = getLocalPhotoPath(place.place_id, i);
      }

      // Always store a reference to the photo so the server can fetch it on demand
      // Use the local path as the URL (server will proxy-download if missing)
      const localPath = photoUrl || `/assets/place-photos/${place.place_id}_${i}.jpg`;
      processedPlace.photos.push({
        url: localPath,
        photoReference: photo.photo_reference,
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
 * Remove photos (Cloudinary + local cache) that belong to place IDs no longer
 * present in the freshly-fetched data.  This keeps storage clean after places
 * rotate in/out of the search results or are blacklisted.
 */
async function cleanupOrphanedPhotos(newData) {
  const allPlaces = [
    ...newData.locations,
    ...newData.restaurants,
    ...newData.accommodations,
  ];
  const newPlaceIds = new Set(allPlaces.map(p => p.id));

  // Build the full set of photo public IDs that are expected for the new places.
  // We include all possible index slots (0..MAX_PHOTOS_PER_PLACE-1) for every
  // place so that images for current places are never accidentally deleted.
  const expectedCloudinaryIds = new Set();
  for (const place of allPlaces) {
    for (let i = 0; i < CONFIG.MAX_PHOTOS_PER_PLACE; i++) {
      expectedCloudinaryIds.add(cloudinaryStorage.PUBLIC_IDS.photoId(photoBaseName(place.id, i)));
    }
  }

  // ── Cloudinary cleanup ──────────────────────────────────────────────────
  if (cloudinaryStorage.isConfigured()) {
    try {
      console.log('\n🧹 Checking for orphaned Cloudinary photos...');
      const existing = await cloudinaryStorage.listImagesByPrefix('rasnov-photos/');
      const toDelete = existing.filter(id => !expectedCloudinaryIds.has(id));

      if (toDelete.length === 0) {
        console.log('  ✅ No orphaned Cloudinary photos found');
      } else {
        console.log(`  🗑️  Deleting ${toDelete.length} orphaned Cloudinary photo(s)...`);
        for (const publicId of toDelete) {
          try {
            await cloudinaryStorage.deleteImage(publicId);
            console.log(`    ✅ Deleted from Cloudinary: ${publicId}`);
          } catch (e) {
            console.warn(`    ⚠️  Could not delete ${publicId} from Cloudinary:`, e.message);
          }
        }
      }
    } catch (e) {
      console.warn('⚠️  Could not clean up orphaned Cloudinary photos:', e.message);
    }
  }

  // ── Local cache cleanup ─────────────────────────────────────────────────
  try {
    if (fs.existsSync(CONFIG.PHOTOS_DIR)) {
      const files = fs.readdirSync(CONFIG.PHOTOS_DIR).filter(f => /\.(jpg|png)$/i.test(f));
      const orphanFiles = files.filter(filename => {
        // filename format: {placeId}_{index}.{ext}
        const base = filename.replace(/\.(jpg|png)$/i, ''); // e.g. "ChIJ..._0"
        const lastUnderscore = base.lastIndexOf('_');
        if (lastUnderscore === -1) return false;
        const placeId = base.slice(0, lastUnderscore);
        return !newPlaceIds.has(placeId);
      });

      if (orphanFiles.length === 0) {
        console.log('  ✅ No orphaned local photos found');
      } else {
        console.log(`  🗑️  Removing ${orphanFiles.length} orphaned local photo(s)...`);
        for (const filename of orphanFiles) {
          try {
            fs.unlinkSync(path.join(CONFIG.PHOTOS_DIR, filename));
            console.log(`    ✅ Removed local file: ${filename}`);
          } catch (e) {
            console.warn(`    ⚠️  Could not remove ${filename}:`, e.message);
          }
        }
      }
    }
  } catch (e) {
    console.warn('⚠️  Could not clean up orphaned local photos:', e.message);
  }
}

/**
 * Main function to fetch all data
 */
async function main() {
  console.log('🚀 Starting Google Places data fetch...');
  console.log(`📍 Center: ${CONFIG.CENTER_LAT}, ${CONFIG.CENTER_LNG}`);
  console.log(`📏 Radius: ${CONFIG.SEARCH_RADIUS}m (keyword: Rasnov)`);
  console.log(`🚫 Blacklist: ${BLACKLIST.length} place(s) excluded`);
  // Evaluate once so the decision doesn't change mid-run as files are written
  const downloadImages = shouldDownloadImages();
  if (downloadImages) {
    const reason = process.argv.includes('--download-images')
      ? 'explicitly requested'
      : !fs.existsSync(CONFIG.PHOTOS_DIR)
        ? 'photos directory not found – downloading to cache'
        : 'photos directory is empty – downloading to cache';
    console.log(`📸 Image download mode: ON (${reason}, saving to assets/place-photos/)`);
  } else {
    console.log('📸 Image download mode: OFF (pass --download-images to download photos locally)');
  }

  // Validate API key
  if (!CONFIG.GOOGLE_API_KEY || 
      CONFIG.GOOGLE_API_KEY === 'your_google_places_api_key_here' ||
      CONFIG.GOOGLE_API_KEY.startsWith('your_')) {
    console.error('\n❌ ERROR: GOOGLE_PLACES_API_KEY not set in .env file');
    console.error('Please create a .env file based on .env.example and add your API key.');
    process.exit(1);
  }

  // Load existing data so we can reuse photos for places we've already fetched,
  // avoiding redundant Google Places Photo API calls.
  const existingData = loadExistingData();
  const existingPhotos = buildPhotoLookup(existingData);
  if (existingPhotos.size > 0) {
    console.log(`📸 Found ${existingPhotos.size} place(s) with cached photos — will reuse where possible`);
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
        const processedPlace = await processPlace(places[i], i, places.length, downloadImages, existingPhotos);
        result[key].push(processedPlace);
        await sleep(CONFIG.RATE_LIMIT_DELAY); // Rate limiting
      } catch (error) {
        console.error(`    ❌ Error processing ${places[i].name}:`, error.message);
      }
    }
  }

  // Save to file
  console.log(`\n💾 Saving data to ${CONFIG.OUTPUT_FILE}...`);
  
  // Ensure output directories exist
  const dataDir = path.dirname(CONFIG.OUTPUT_FILE);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  if (!fs.existsSync(CONFIG.PHOTOS_DIR)) {
    fs.mkdirSync(CONFIG.PHOTOS_DIR, { recursive: true });
  }

  const jsonOutput = JSON.stringify(result, null, 2);

  fs.writeFileSync(CONFIG.OUTPUT_FILE, jsonOutput, 'utf8');

  // Also overwrite sample data so real data persists across rebuilds
  console.log(`💾 Overwriting sample data at ${CONFIG.SAMPLE_FILE}...`);
  fs.writeFileSync(CONFIG.SAMPLE_FILE, jsonOutput, 'utf8');

  // Upload to Cloudinary for persistence across deploys
  if (cloudinaryStorage.isConfigured()) {
    try {
      console.log('☁️  Uploading places data to Cloudinary...');
      await cloudinaryStorage.uploadJSON(cloudinaryStorage.PUBLIC_IDS.PLACES_DATA, result);
      console.log('☁️  Places data uploaded to Cloudinary successfully');
    } catch (e) {
      console.warn('⚠️  Could not upload places data to Cloudinary:', e.message);
    }
  }

  // Remove photos that belong to places no longer in the results
  await cleanupOrphanedPhotos(result);

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
