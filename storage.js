/**
 * Storage Abstraction Layer
 *
 * Re-exports either cloudinary-storage or local-storage depending on the
 * STORAGE_MODE setting in site.config.js.
 *
 * Default (STORAGE_MODE === 'cloudinary' or unset):
 *   → uses cloudinary-storage.js (behaviour unchanged from before this feature)
 *
 * STORAGE_MODE === 'local':
 *   → uses local-storage.js (stores files on the local filesystem)
 *
 * Every consumer that previously required('./cloudinary-storage') should now
 * require('./storage') instead.  The exported API is identical.
 */

const siteConfig = require('./site.config');

const mode = (siteConfig.STORAGE_MODE || 'cloudinary').toLowerCase();

if (mode === 'local') {
  module.exports = require('./local-storage');
} else {
  // Default – Cloudinary (original behaviour)
  module.exports = require('./cloudinary-storage');
}
