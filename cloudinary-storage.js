/**
 * Cloudinary Storage Module
 *
 * Provides persistent cloud storage for data files and images using Cloudinary.
 * Configured via the CLOUDINARY_URL environment variable (set automatically by Cloudinary
 * add-ons or manually in format: cloudinary://api_key:api_secret@cloud_name).
 *
 * Public ID conventions:
 *   - leaderboard JSON : rasnov-data/leaderboard  (resource_type: raw)
 *   - places data JSON : rasnov-data/places-data  (resource_type: raw)
 *   - place photos     : rasnov-photos/<name>      (resource_type: image)
 */

const { v2: cloudinary } = require('cloudinary');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');

// Public ID constants
const PUBLIC_IDS = {
  LEADERBOARD: 'rasnov-data/leaderboard',
  PLACES_DATA: 'rasnov-data/places-data',
  photoId: (name) => `rasnov-photos/${name}`,
};

// The Cloudinary SDK reads CLOUDINARY_URL automatically when it is present in
// the environment, so no explicit configuration call is needed.

/** Returns true when CLOUDINARY_URL is present in the environment. */
function isConfigured() {
  return !!process.env.CLOUDINARY_URL;
}

// ---------------------------------------------------------------------------
// JSON helpers
// ---------------------------------------------------------------------------

/**
 * Upload a JSON-serialisable object to Cloudinary as a raw file.
 * @param {string} publicId  Cloudinary public ID (e.g. "rasnov-data/leaderboard")
 * @param {object} data      Data to serialise and upload
 * @returns {object|null} Cloudinary upload result, or null when not configured
 */
async function uploadJSON(publicId, data) {
  if (!isConfigured()) return null;
  const jsonString = JSON.stringify(data, null, 2);
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { public_id: publicId, resource_type: 'raw', overwrite: true, invalidate: true },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    Readable.from(Buffer.from(jsonString)).pipe(uploadStream);
  });
}

/**
 * Download a raw JSON file from Cloudinary.
 * @param {string} publicId  Cloudinary public ID
 * @returns {object|null} Parsed JSON, or null when not found / not configured
 */
async function downloadJSON(publicId) {
  if (!isConfigured()) return null;
  try {
    const resource = await cloudinary.api.resource(publicId, { resource_type: 'raw' });
    const response = await axios.get(resource.secure_url, { timeout: 15000 });
    return response.data;
  } catch (e) {
    // 404 from Cloudinary API means the resource does not exist yet
    if (e.error && e.error.http_code === 404) return null;
    if (e.response && e.response.status === 404) return null;
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Image helpers
// ---------------------------------------------------------------------------

/**
 * Upload an image file to Cloudinary.
 * @param {string} publicId  Cloudinary public ID (without extension)
 * @param {string} filepath  Absolute local path to the image file
 * @returns {object|null} Cloudinary upload result, or null when not configured
 */
async function uploadImage(publicId, filepath) {
  if (!isConfigured()) return null;
  return cloudinary.uploader.upload(filepath, {
    public_id: publicId,
    resource_type: 'image',
    overwrite: true,
    invalidate: true,
  });
}

/**
 * Upload an in-memory image buffer to Cloudinary.
 * @param {string} publicId    Cloudinary public ID (without extension)
 * @param {Buffer} buffer      Raw image bytes
 * @returns {object|null} Cloudinary upload result, or null when not configured
 */
async function uploadImageBuffer(publicId, buffer) {
  if (!isConfigured()) return null;
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { public_id: publicId, resource_type: 'image', overwrite: true, invalidate: true },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    Readable.from(buffer).pipe(uploadStream);
  });
}

/**
 * Download an image from Cloudinary and save it to a local path.
 * @param {string} publicId   Cloudinary public ID (without extension)
 * @param {string} localPath  Absolute local path to save the file
 * @param {string} [format]   Image format, e.g. "jpg" or "png" (default: "jpg")
 * @returns {boolean} true on success, false when the image does not exist
 */
async function downloadImage(publicId, localPath) {
  if (!isConfigured()) return false;
  try {
    const resource = await cloudinary.api.resource(publicId, { resource_type: 'image' });
    const response = await axios.get(resource.secure_url, { responseType: 'arraybuffer', timeout: 15000 });
    const dir = path.dirname(localPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(localPath, Buffer.from(response.data));
    return true;
  } catch (e) {
    if (e.error && e.error.http_code === 404) return false;
    if (e.response && (e.response.status === 404 || e.response.status === 400)) return false;
    throw e;
  }
}

module.exports = {
  isConfigured,
  PUBLIC_IDS,
  uploadJSON,
  downloadJSON,
  uploadImage,
  uploadImageBuffer,
  downloadImage,
};
