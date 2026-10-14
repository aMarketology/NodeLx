/**
 * routes/media.js
 *
 * Media upload API — auto-routes by size/type:
 *
 *   GET    /api/media/:siteId   list all media for a site (Supabase bucket)
 *   POST   /api/media/upload    upload (base64 JSON body)
 *       • small images (≤ threshold) → committed to the client repo public/uploads/
 *         via the PAT (GitHub Contents API) — instant, no external dependency.
 *       • large images / videos      → Supabase per-client bucket (media-<siteId>).
 *   DELETE /api/media           delete media by storage path
 *
 * Auth: shared NODELX_API_KEY (Bearer token), matching routes/sites.js.
 * The client site sends `Authorization: Bearer <NODELX_API_KEY>`.
 */

const express = require('express');
const { listSiteMedia, uploadMedia, deleteMedia } = require('../mediaStore');
const { getSiteById } = require('../sites');

const ALLOWED_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml',
  'video/mp4', 'video/webm', 'video/quicktime',
]);

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']);

// Small images at or below this size are committed to the repo; larger go to Supabase.
const GITHUB_THRESHOLD_BYTES = Number(process.env.MEDIA_GITHUB_THRESHOLD_BYTES || 1_048_576); // 1 MB

// Normalize a single path segment: strip extension, replace runs of
// whitespace with a hyphen, drop any character that isn't alphanumeric,
// hyphen, or dot, and re-attach a safe lowercase extension. Guarantees a
// space-free, URL-safe filename.
function sanitizeSegment(name) {
  const raw = String(name || '').trim()
  const m = /^(.*?)(\.[A-Za-z0-9]{1,5})$/.exec(raw)   // split off a real extension
  const ext = m ? m[2].toLowerCase() : ''
  const base = m ? m[1] : raw
  const cleanedBase = base
    .replace(/\s+/g, '-')              // spaces → hyphen
    .replace(/[^a-zA-Z0-9._-]+/g, '-') // anything else → hyphen
    .replace(/-{2,}/g, '-')            // collapse repeats
    .replace(/^[-.]+|[-.]+$/g, '')     // trim leading/trailing
  if (!cleanedBase) return ''
  return `${cleanedBase}${ext}`
}

// ─── API key guard (shared NODELX_API_KEY) ────────────────────────────────
const requireApiKey = (req, res, next) => {
  const configured = process.env.NODELX_API_KEY;
  const provided = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');

  if (!configured) {
    return res.status(503).json({ error: 'NODELX_API_KEY not configured on this NodeLx server' });
  }
  if (provided !== configured) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  next();
};

// Sanitize folder/filename — no traversal, no spaces, no special chars.
// Spaces in filenames make URLs fragile (require %20 encoding) and break
// across browsers/CDNs, so we normalize them to hyphens.
const sanitizePathSegment = (str) => {
  if (typeof str !== 'string') return '';
  return str
    .replace(/[^a-zA-Z0-9_\-. ]/g, '_') // Keep alphanumerics, _, ., - and space
    .replace(/ +/g, '-')                // Convert spaces to hyphens
    .replace(/--+/g, '-')               // Collapse multiple hyphens
    .replace(/^-+|-+$/g, '');           // Trim leading/trailing hyphens
};

module.exports = function mediaRouter(gitSync) {
  const router = express.Router();

  // ─── List media ─────────────────────────────────────────────────────────

  router.get('/api/media/:siteId', requireApiKey, async (req, res) => {
    // Sanitize siteId — only alphanumeric + underscore/hyphen
    const siteId = req.params.siteId.replace(/[^a-zA-Z0-9_-]/g, '');
    if (!siteId) return res.status(400).json({ error: 'Invalid siteId.' });

    try {
      const images = await listSiteMedia(siteId);
      res.json({ ok: true, siteId, images });
    } catch (err) {
      console.error('[Media] List error:', err.message);
      res.status(500).json({ error: 'Failed to list media.' });
    }
  });

  // ─── Upload media ───────────────────────────────────────────────────────

  router.post('/api/media/upload', requireApiKey, async (req, res) => {
    const { siteId, folder, filename, contentType, data } = req.body || {};

    if (!siteId || !folder || !filename || !contentType || !data) {
      return res.status(400).json({ error: 'siteId, folder, filename, contentType, and data (base64) are required.' });
    }

    if (!ALLOWED_TYPES.has(contentType)) {
      return res.status(400).json({ error: 'Unsupported file type. Allowed: jpeg, png, webp, gif, svg, mp4, webm, quicktime.' });
    }

    // Sanitize all path segments — no traversal, no spaces, no special chars.
    // Spaces in filenames make URLs fragile (require %20 encoding) and break
    // across browsers/CDNs, so we normalize them to hyphens.
    const safeSite   = siteId.replace(/[^a-zA-Z0-9_-]/g, '');
    const safeFolder = sanitizeSegment(folder);
    const safeName   = sanitizeSegment(filename);

    if (!safeSite || !safeFolder || !safeName) {
      return res.status(400).json({ error: 'Invalid path components.' });
    }

    let buffer;
    try {
      buffer = Buffer.from(data, 'base64');
    } catch {
      return res.status(400).json({ error: 'data must be a valid base64 string.' });
    }

    // Reject suspiciously small or large buffers
    if (buffer.length < 100 || buffer.length > 52_428_800) {
      return res.status(400).json({ error: 'File size must be between 100 bytes and 50 MB.' });
    }

    // ── Routing decision ──────────────────────────────────────────────────
    // Small images → GitHub (repo public/uploads/). Large images / videos → Supabase.
    const isSmallImage = IMAGE_TYPES.has(contentType) && buffer.length <= GITHUB_THRESHOLD_BYTES;

    try {
      if (isSmallImage) {
        const site = getSiteById(safeSite);
        if (!site) return res.status(404).json({ error: 'Unknown site.' });
        if (!gitSync || !gitSync.isConfigured()) {
          return res.status(503).json({ error: 'GitHub sync not configured for this site.' });
        }

        const remotePath = `public/${safeFolder}/${safeName}`;
        const commit = await gitSync.commitBinaryFile(
          site,
          remotePath,
          buffer,
          `media: upload ${safeName}`,
        );
        return res.json({ ok: true, url: `/${safeFolder}/${safeName}`, path: remotePath, source: 'github', commitSha: commit.sha });
      }

      const result = await uploadMedia(safeSite, safeFolder, safeName, buffer, contentType);
      res.json({ ok: true, ...result, source: 'supabase' });
    } catch (err) {
      console.error('[Media] Upload error:', err.message);
      res.status(500).json({ error: 'Upload failed.' });
    }
  });

  // ─── Delete media ───────────────────────────────────────────────────────

  router.delete('/api/media', requireApiKey, async (req, res) => {
    const { siteId, path: storagePath } = req.body || {};

    if (!siteId || typeof siteId !== 'string') {
      return res.status(400).json({ error: 'siteId is required.' });
    }
    if (!storagePath || typeof storagePath !== 'string') {
      return res.status(400).json({ error: 'path is required.' });
    }

    // Validate: no traversal, no leading slash
    if (/\.\./.test(storagePath) || storagePath.startsWith('/')) {
      return res.status(400).json({ error: 'Invalid path.' });
    }

    const safeSite = siteId.replace(/[^a-zA-Z0-9_-]/g, '');
    if (!safeSite) return res.status(400).json({ error: 'Invalid siteId.' });

    try {
      await deleteMedia(safeSite, storagePath);
      res.json({ ok: true });
    } catch (err) {
      console.error('[Media] Delete error:', err.message);
      res.status(500).json({ error: 'Delete failed.' });
    }
  });

  return router;
};