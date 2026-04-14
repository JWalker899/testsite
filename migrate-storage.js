#!/usr/bin/env node

/**
 * Storage Migration Script
 *
 * Copies all data (JSON files + photos) between Cloudinary and local storage.
 *
 * Usage:
 *   node migrate-storage.js cloudinary-to-local   # download everything to local folder
 *   node migrate-storage.js local-to-cloudinary   # upload everything from local folder to Cloudinary
 *
 * Notes:
 *   - For cloudinary-to-local: CLOUDINARY_URL must be set in the environment.
 *   - For local-to-cloudinary: CLOUDINARY_URL must be set AND site.config.js
 *     LOCAL_STORAGE_PATH must point to the folder that contains the data.
 *   - This script does NOT change the STORAGE_MODE setting.  After migrating,
 *     update site.config.js manually to switch modes.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

// We deliberately require the individual modules (not storage.js) because we
// need BOTH backends available regardless of the current STORAGE_MODE.
const cloudinaryStorage = require('./cloudinary-storage');
const localStorage = require('./local-storage');

// ---------------------------------------------------------------------------
// Cloudinary → Local
// ---------------------------------------------------------------------------

async function cloudinaryToLocal() {
  if (!cloudinaryStorage.isConfigured()) {
    console.error('❌  CLOUDINARY_URL is not set — cannot read from Cloudinary.');
    process.exit(1);
  }

  const root = localStorage.getStorageRoot();
  console.log(`📂  Local storage root: ${root}\n`);

  // ── JSON data ──────────────────────────────────────────────────────────
  for (const [label, publicId] of [
    ['Leaderboard', cloudinaryStorage.PUBLIC_IDS.LEADERBOARD],
    ['Places data', cloudinaryStorage.PUBLIC_IDS.PLACES_DATA],
  ]) {
    process.stdout.write(`☁️  Downloading ${label}… `);
    try {
      const data = await cloudinaryStorage.downloadJSON(publicId);
      if (data) {
        const dest = path.join(root, publicId + '.json');
        const dir = path.dirname(dest);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(dest, JSON.stringify(data, null, 2));
        console.log('✅');
      } else {
        console.log('⏭️  (not found on Cloudinary)');
      }
    } catch (e) {
      console.log(`❌  ${e.message}`);
    }
  }

  // ── Photos ──────────────────────────────────────────────────────────────
  console.log('\n📸  Listing Cloudinary photos…');
  let photos;
  try {
    photos = await cloudinaryStorage.listImagesByPrefix('rasnov-photos/');
  } catch (e) {
    console.error(`❌  Could not list photos: ${e.message}`);
    return;
  }
  console.log(`   Found ${photos.length} photo(s).\n`);

  let ok = 0;
  let fail = 0;
  for (const publicId of photos) {
    const dest = path.join(root, publicId + '.jpg');
    process.stdout.write(`   ⬇️  ${publicId} … `);
    try {
      const downloaded = await cloudinaryStorage.downloadImage(publicId, dest);
      if (downloaded) {
        console.log('✅');
        ok++;
      } else {
        console.log('⏭️  (not found)');
      }
    } catch (e) {
      console.log(`❌  ${e.message}`);
      fail++;
    }
  }

  console.log(`\n📊  Done — ${ok} photo(s) downloaded, ${fail} failed.`);
}

// ---------------------------------------------------------------------------
// Local → Cloudinary
// ---------------------------------------------------------------------------

async function localToCloudinary() {
  if (!cloudinaryStorage.isConfigured()) {
    console.error('❌  CLOUDINARY_URL is not set — cannot upload to Cloudinary.');
    process.exit(1);
  }

  const root = localStorage.getStorageRoot();
  if (!fs.existsSync(root)) {
    console.error(`❌  Local storage folder not found: ${root}`);
    process.exit(1);
  }
  console.log(`📂  Local storage root: ${root}\n`);

  // ── JSON data ──────────────────────────────────────────────────────────
  for (const [label, publicId] of [
    ['Leaderboard', cloudinaryStorage.PUBLIC_IDS.LEADERBOARD],
    ['Places data', cloudinaryStorage.PUBLIC_IDS.PLACES_DATA],
  ]) {
    const src = path.join(root, publicId + '.json');
    if (!fs.existsSync(src)) {
      console.log(`⏭️  ${label}: local file not found, skipping.`);
      continue;
    }
    process.stdout.write(`☁️  Uploading ${label}… `);
    try {
      const data = JSON.parse(fs.readFileSync(src, 'utf8'));
      await cloudinaryStorage.uploadJSON(publicId, data);
      console.log('✅');
    } catch (e) {
      console.log(`❌  ${e.message}`);
    }
  }

  // ── Photos ──────────────────────────────────────────────────────────────
  const photosDir = path.join(root, 'rasnov-photos');
  if (!fs.existsSync(photosDir)) {
    console.log('\n⏭️  No rasnov-photos folder found locally — nothing to upload.');
    return;
  }

  const imageExts = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);
  const files = fs.readdirSync(photosDir).filter(f => imageExts.has(path.extname(f).toLowerCase()));
  console.log(`\n📸  Found ${files.length} local photo(s) to upload.\n`);

  let ok = 0;
  let fail = 0;
  for (const file of files) {
    const ext = path.extname(file);
    const baseName = path.basename(file, ext);
    const publicId = `rasnov-photos/${baseName}`;
    const filepath = path.join(photosDir, file);
    process.stdout.write(`   ⬆️  ${publicId} … `);
    try {
      await cloudinaryStorage.uploadImage(publicId, filepath);
      console.log('✅');
      ok++;
    } catch (e) {
      console.log(`❌  ${e.message}`);
      fail++;
    }
  }

  console.log(`\n📊  Done — ${ok} photo(s) uploaded, ${fail} failed.`);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const direction = process.argv[2];
if (direction === 'cloudinary-to-local') {
  cloudinaryToLocal().catch(e => { console.error('Fatal:', e); process.exit(1); });
} else if (direction === 'local-to-cloudinary') {
  localToCloudinary().catch(e => { console.error('Fatal:', e); process.exit(1); });
} else {
  console.log(`
Usage:
  node migrate-storage.js cloudinary-to-local
  node migrate-storage.js local-to-cloudinary
`);
  process.exit(1);
}
