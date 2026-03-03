#!/usr/bin/env node

/**
 * Place Photos Downloader
 *
 * Reads places-data.json (or sample-places-data.json as fallback) and
 * downloads every photo whose photoReference is stored but whose local
 * cache file is missing.  Run once, then commit assets/place-photos/.
 *
 * Usage:
 *   npm run download-photos            # skip already-cached images
 *   npm run download-photos -- --force # re-download every image
 */

require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const PHOTOS_DIR = path.join(__dirname, '../assets/place-photos');
const DATA_FILE = path.join(__dirname, '../data/places-data.json');
const SAMPLE_FILE = path.join(__dirname, '../data/sample-places-data.json');
const RATE_LIMIT_DELAY = 150; // ms between requests
const RETRY_ATTEMPTS = 3;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function retryRequest(fn) {
  for (let i = 0; i < RETRY_ATTEMPTS; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === RETRY_ATTEMPTS - 1) throw err;
      console.log(`  ⚠️  Attempt ${i + 1} failed, retrying…`);
      await sleep(2000);
    }
  }
}

function loadPlacesData() {
  for (const file of [DATA_FILE, SAMPLE_FILE]) {
    if (fs.existsSync(file)) {
      try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
      } catch (e) {
        console.warn(`Could not parse ${file}:`, e.message);
      }
    }
  }
  return null;
}

async function downloadPhoto(photoReference, filepath) {
  const url = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${encodeURIComponent(photoReference)}&key=${GOOGLE_API_KEY}`;
  const response = await retryRequest(() =>
    axios.get(url, { responseType: 'arraybuffer' })
  );
  const contentType = (response.headers['content-type'] || 'image/jpeg').split(';')[0].trim();
  const ext = contentType === 'image/png' ? 'png' : 'jpg';
  // Use the correct extension (rename file if needed)
  const finalPath = filepath.replace(/\.(jpg|png)$/i, `.${ext}`);
  fs.writeFileSync(finalPath, Buffer.from(response.data));
  // Write sidecar .ref file so the server can detect stale caches
  const refPath = finalPath.replace(/\.(jpg|png)$/i, '.ref');
  fs.writeFileSync(refPath, photoReference);
  return finalPath;
}

async function main() {
  const force = process.argv.includes('--force');

  if (!GOOGLE_API_KEY || GOOGLE_API_KEY.startsWith('your_')) {
    console.error('❌  GOOGLE_PLACES_API_KEY is not set in .env');
    process.exit(1);
  }

  const data = loadPlacesData();
  if (!data) {
    console.error('❌  No places-data.json or sample-places-data.json found.');
    process.exit(1);
  }

  if (!fs.existsSync(PHOTOS_DIR)) {
    fs.mkdirSync(PHOTOS_DIR, { recursive: true });
  }

  const allPlaces = [
    ...(data.locations || []),
    ...(data.restaurants || []),
    ...(data.accommodations || []),
  ];

  // Collect work items
  const toDownload = [];
  for (const place of allPlaces) {
    for (let i = 0; i < (place.photos || []).length; i++) {
      const photo = place.photos[i];
      if (!photo.photoReference) continue;
      const expectedPath = path.join(PHOTOS_DIR, `${place.id}_${i}.jpg`);
      const expectedPathPng = path.join(PHOTOS_DIR, `${place.id}_${i}.png`);
      const alreadyCached = fs.existsSync(expectedPath) || fs.existsSync(expectedPathPng);
      if (!force && alreadyCached) continue;
      toDownload.push({ place, index: i, photo, expectedPath });
    }
  }

  if (toDownload.length === 0) {
    console.log('✅  All photos are already cached. Use --force to re-download.');
    return;
  }

  console.log(`📸  Downloading ${toDownload.length} photo(s) to assets/place-photos/…\n`);

  let ok = 0;
  let fail = 0;
  for (const { place, index, photo, expectedPath } of toDownload) {
    const label = `${place.name} [${index}]`;
    try {
      const saved = await downloadPhoto(photo.photoReference, expectedPath);
      console.log(`  ✅  ${label} → ${path.basename(saved)}`);
      ok++;
    } catch (err) {
      console.error(`  ❌  ${label}: ${err.message}`);
      fail++;
    }
    await sleep(RATE_LIMIT_DELAY);
  }

  console.log(`\n📊  Done — ${ok} downloaded, ${fail} failed.`);
  if (ok > 0) {
    console.log('💡  Commit assets/place-photos/ to git to persist the cache.');
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
