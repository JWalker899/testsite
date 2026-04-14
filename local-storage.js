/**
 * Local Storage Module
 *
 * Drop-in replacement for cloudinary-storage.js that persists data files and
 * images on the local filesystem instead of Cloudinary.
 *
 * The storage root is configured via site.config.js  (LOCAL_STORAGE_PATH).
 * Within that root the same public-ID conventions are used:
 *   - rasnov-data/leaderboard.json
 *   - rasnov-data/places-data.json
 *   - rasnov-photos/<name>.<ext>
 */

const fs = require('fs');
const path = require('path');

const siteConfig = require('./site.config');

// ---------------------------------------------------------------------------
// Storage root
// ---------------------------------------------------------------------------

function getStorageRoot() {
  const configured = siteConfig.LOCAL_STORAGE_PATH || './local-storage';
  return path.isAbsolute(configured)
    ? configured
    : path.resolve(__dirname, configured);
}

// Public ID constants (same shape as cloudinary-storage.js)
const PUBLIC_IDS = {
  LEADERBOARD: 'rasnov-data/leaderboard',
  PLACES_DATA: 'rasnov-data/places-data',
  photoId: (name) => `rasnov-photos/${name}`,
};

/** Returns true when local storage mode is selected. */
function isConfigured() {
  return siteConfig.STORAGE_MODE === 'local';
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Validate that a resolved path is inside the storage root.
 * Prevents path-traversal attacks (e.g. publicId = "../../etc/passwd").
 */
function assertInsideRoot(resolvedPath) {
  const root = getStorageRoot();
  const normalizedRoot = path.resolve(root) + path.sep;
  const normalizedPath = path.resolve(resolvedPath);
  if (!normalizedPath.startsWith(normalizedRoot) && normalizedPath !== path.resolve(root)) {
    throw new Error('Path traversal detected — resolved path is outside the storage root');
  }
}

/** Turn a public ID into an absolute file path (for JSON files). */
function jsonPath(publicId) {
  const resolved = path.join(getStorageRoot(), publicId + '.json');
  assertInsideRoot(resolved);
  return resolved;
}

/** Turn an image public ID into an absolute directory + base name. */
function imageDirAndBase(publicId) {
  const dir = path.join(getStorageRoot(), path.dirname(publicId));
  const base = path.basename(publicId);
  assertInsideRoot(dir);
  return { dir, base };
}

/**
 * Find an existing image file for a public ID regardless of extension.
 * Returns the full path if found, otherwise null.
 */
function findImageFile(publicId) {
  const { dir, base } = imageDirAndBase(publicId);
  if (!fs.existsSync(dir)) return null;
  const exts = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  for (const ext of exts) {
    const candidate = path.join(dir, base + ext);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ---------------------------------------------------------------------------
// JSON helpers
// ---------------------------------------------------------------------------

/**
 * Save a JSON-serialisable object to a local file.
 * @param {string} publicId  Logical public ID (e.g. "rasnov-data/leaderboard")
 * @param {object} data      Data to serialise
 * @returns {object|null} A result-like object, or null when not configured
 */
async function uploadJSON(publicId, data) {
  if (!isConfigured()) return null;
  const dest = jsonPath(publicId);
  ensureDir(dest);
  fs.writeFileSync(dest, JSON.stringify(data, null, 2));
  return { public_id: publicId, secure_url: dest };
}

/**
 * Read a JSON file from local storage.
 * @param {string} publicId  Logical public ID
 * @returns {object|null} Parsed JSON, or null when not found / not configured
 */
async function downloadJSON(publicId) {
  if (!isConfigured()) return null;
  const src = jsonPath(publicId);
  if (!fs.existsSync(src)) return null;
  try {
    return JSON.parse(fs.readFileSync(src, 'utf8'));
  } catch (e) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Image helpers
// ---------------------------------------------------------------------------

/**
 * Copy an image file into local storage.
 * @param {string} publicId  Logical public ID (without extension)
 * @param {string} filepath  Absolute path to the source image file
 * @returns {object|null} A result-like object, or null when not configured
 */
async function uploadImage(publicId, filepath) {
  if (!isConfigured()) return null;
  const ext = path.extname(filepath) || '.jpg';
  const { dir, base } = imageDirAndBase(publicId);
  const dest = path.join(dir, base + ext);
  ensureDir(dest);
  fs.copyFileSync(filepath, dest);
  return { public_id: publicId, secure_url: dest };
}

/**
 * Save an in-memory image buffer to local storage.
 * @param {string} publicId  Logical public ID (without extension)
 * @param {Buffer} buffer    Raw image bytes
 * @returns {object|null} A result-like object, or null when not configured
 */
async function uploadImageBuffer(publicId, buffer) {
  if (!isConfigured()) return null;
  const { dir, base } = imageDirAndBase(publicId);
  // Default to .jpg; the server photo proxy always uses .jpg basenames.
  const dest = path.join(dir, base + '.jpg');
  ensureDir(dest);
  fs.writeFileSync(dest, buffer);
  return { public_id: publicId, secure_url: dest };
}

/**
 * Download (copy) an image from local storage to a given local path.
 * @param {string} publicId   Logical public ID (without extension)
 * @param {string} localPath  Absolute destination path
 * @returns {boolean} true if the file was found and copied, false otherwise
 */
async function downloadImage(publicId, localPath) {
  if (!isConfigured()) return false;
  const src = findImageFile(publicId);
  if (!src) return false;
  ensureDir(localPath);
  fs.copyFileSync(src, localPath);
  return true;
}

/**
 * Delete an image from local storage.
 * @param {string} publicId  Logical public ID (without extension)
 * @returns {object|null} A result-like object, or null when not configured
 */
async function deleteImage(publicId) {
  if (!isConfigured()) return null;
  const src = findImageFile(publicId);
  if (src) {
    fs.unlinkSync(src);
    return { result: 'ok' };
  }
  return { result: 'not found' };
}

/**
 * List all images stored under a given public ID prefix.
 * @param {string} prefix  e.g. "rasnov-photos/"
 * @returns {string[]} Array of public IDs (without extensions)
 */
async function listImagesByPrefix(prefix) {
  if (!isConfigured()) return [];
  // prefix looks like "rasnov-photos/"; map to a directory path
  const dir = path.join(getStorageRoot(), prefix);
  assertInsideRoot(dir);
  if (!fs.existsSync(dir)) return [];
  const results = [];
  const imageExts = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);
  for (const entry of fs.readdirSync(dir)) {
    const ext = path.extname(entry).toLowerCase();
    if (imageExts.has(ext)) {
      // Public ID = prefix + basename without extension
      results.push(prefix + path.basename(entry, ext));
    }
  }
  return results;
}

module.exports = {
  isConfigured,
  PUBLIC_IDS,
  uploadJSON,
  downloadJSON,
  uploadImage,
  uploadImageBuffer,
  downloadImage,
  deleteImage,
  listImagesByPrefix,
  // Exposed for the migration script
  getStorageRoot,
};
