/**
 * imageOptimizer.js — server-side image optimization with sharp.
 *
 * Applied at upload time so oversized camera photos never reach the repo or
 * Supabase. Vercel's image optimizer rejects sources over 10 MB, so a 22 MB
 * camera JPEG would 500 in production; resizing here prevents that at source.
 *
 * Design rules:
 *   • Never fail an upload because optimization failed — store the original.
 *   • Never upscale. Only downscale images wider than maxWidth.
 *   • Never store a result that is larger than the original.
 *   • Skip SVG (vector, nothing to gain) and GIF (re-encoding drops animation).
 */

// Lazy-require sharp so a deployment without the native binary still boots.
let _sharp = null;
function getSharp() {
  if (_sharp) return _sharp;
  _sharp = require('sharp');
  return _sharp;
}

const DEFAULTS = {
  enabled: true,
  maxWidth: 2400,
  quality: 82,
  format: 'original', // 'original' | 'webp' | 'avif'
};

const SKIP_TYPES = new Set(['image/svg+xml', 'image/gif']);

const EXT_FOR_FORMAT = { webp: '.webp', avif: '.avif', jpeg: '.jpg' };

const CONTENT_TYPE_FOR_FORMAT = {
  webp: 'image/webp',
  avif: 'image/avif',
  jpeg: 'image/jpeg',
};

/**
 * Merge a site's `speed` settings over the defaults.
 * @param {object} site site object from sites.json
 * @returns {{enabled: boolean, maxWidth: number, quality: number, format: string}}
 */
function resolveSettings(site = {}) {
  const s = (site && site.speed) || {};
  const maxWidth = Number(s.maxWidth);
  const quality = Number(s.quality);
  return {
    enabled: s.enabled !== false,
    maxWidth: Number.isFinite(maxWidth) && maxWidth > 0 ? maxWidth : DEFAULTS.maxWidth,
    quality: Number.isFinite(quality) && quality > 0 && quality <= 100 ? quality : DEFAULTS.quality,
    format: ['original', 'webp', 'avif'].includes(s.format) ? s.format : DEFAULTS.format,
  };
}

/**
 * Optimize an image buffer.
 *
 * Returns the original buffer untouched when the image is skipped, already
 * within bounds, or when re-encoding would not save bytes. Callers should
 * check `changed` before using the returned buffer.
 *
 * @param {Buffer} buffer raw image bytes
 * @param {string} contentType e.g. "image/jpeg"
 * @param {object} settings from resolveSettings()
 * @returns {Promise<{
 *   buffer: Buffer, contentType: string, originalBytes: number, bytes: number,
 *   saved: number, changed: boolean, reason?: string, width?: number,
 *   height?: number, format?: string, error?: string
 * }>}
 */
async function optimizeImage(buffer, contentType, settings = {}) {
  const opts = { ...DEFAULTS, ...settings };
  const originalBytes = buffer.length;

  const unchanged = (reason, extra = {}) => ({
    buffer,
    contentType,
    originalBytes,
    bytes: originalBytes,
    saved: 0,
    changed: false,
    reason,
    ...extra,
  });

  if (!opts.enabled) return unchanged('disabled');
  if (SKIP_TYPES.has(contentType)) return unchanged('skipped-type');

  try {
    const sharp = getSharp();
    const image = sharp(buffer, { failOn: 'none' });
    const meta = await image.metadata();

    if (!meta.width || !meta.height) return unchanged('no-dimensions');

    const needsResize = meta.width > opts.maxWidth;
    const targetFormat = opts.format === 'original' ? null : opts.format;

    // Nothing to do: already within bounds and no format conversion requested.
    if (!needsResize && !targetFormat) return unchanged('already-optimized');

    let pipeline = image;
    if (needsResize) {
      pipeline = pipeline.resize({ width: opts.maxWidth, withoutEnlargement: true });
    }

    let outType;
    if (targetFormat === 'webp') {
      pipeline = pipeline.webp({ quality: opts.quality, effort: 4 });
      outType = CONTENT_TYPE_FOR_FORMAT.webp;
    } else if (targetFormat === 'avif') {
      pipeline = pipeline.avif({ quality: opts.quality, effort: 4 });
      outType = CONTENT_TYPE_FOR_FORMAT.avif;
    } else {
      // 'original' — keep the input format so PNG transparency survives.
      const inputFormat = meta.format;
      if (inputFormat === 'png') {
        pipeline = pipeline.png({ compressionLevel: 9 });
        outType = 'image/png';
      } else if (inputFormat === 'webp') {
        pipeline = pipeline.webp({ quality: opts.quality, effort: 4 });
        outType = CONTENT_TYPE_FOR_FORMAT.webp;
      } else if (inputFormat === 'avif') {
        pipeline = pipeline.avif({ quality: opts.quality, effort: 4 });
        outType = CONTENT_TYPE_FOR_FORMAT.avif;
      } else {
        // JPEG and anything else → JPEG. Flatten alpha onto white first,
        // otherwise sharp composites transparency onto black.
        pipeline = pipeline.flatten({ background: '#ffffff' }).jpeg({
          quality: opts.quality,
          mozjpeg: true,
        });
        outType = CONTENT_TYPE_FOR_FORMAT.jpeg;
      }
    }

    const out = await pipeline.toBuffer();

    // Re-encoding occasionally inflates an already-tiny file — keep the original.
    if (out.length >= originalBytes) return unchanged('no-gain');

    return {
      buffer: out,
      contentType: outType,
      originalBytes,
      bytes: out.length,
      saved: originalBytes - out.length,
      changed: true,
      width: needsResize ? opts.maxWidth : meta.width,
      height: needsResize
        ? Math.round(meta.height * (opts.maxWidth / meta.width))
        : meta.height,
      format: targetFormat || meta.format || 'jpeg',
    };
  } catch (err) {
    // Optimization is best-effort: a corrupt or unsupported file still uploads.
    return unchanged('error', { error: err.message });
  }
}

/**
 * Swap a filename's extension to match the optimized output format.
 * Returns the name unchanged when the format is 'original'.
 *
 * @param {string} filename e.g. "photo.JPG"
 * @param {string} format 'original' | 'webp' | 'avif' | 'jpeg'
 * @returns {string}
 */
function renameForFormat(filename, format) {
  const ext = EXT_FOR_FORMAT[format];
  if (!ext) return filename;
  const base = String(filename || '').replace(/\.[A-Za-z0-9]{1,5}$/, '');
  return `${base}${ext}`;
}

module.exports = {
  optimizeImage,
  resolveSettings,
  renameForFormat,
  DEFAULTS,
  SKIP_TYPES,
};
