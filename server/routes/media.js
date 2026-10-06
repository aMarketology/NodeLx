/**
 * routes/media.js
 *
 * Supabase storage API — image listing and upload.
 *
 * GET    /api/media/:siteId   list all images for a site
 * POST   /api/media/upload    upload a new image (base64 JSON body)
 * DELETE /api/media           delete an image by storage path
 *
 * Auth: shared NODELX_API_KEY (Bearer token), matching routes/sites.js.
 * The client site sends `Authorization: Bearer <NODELX_API_KEY>`.
 */

const express = require('express');
const { listSiteMedia, uploadMedia, deleteMedia } = require('../mediaStore');

const router = express.Router();

const ALLOWED_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml',
]);

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

// ─── List images ───────────────────────────────────────────────────────────

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

// ─── Upload image ──────────────────────────────────────────────────────────

router.post('/api/media/upload', requireApiKey, async (req, res) => {
  const { siteId, folder, filename, contentType, data } = req.body || {};

  if (!siteId || !folder || !filename || !contentType || !data) {
    return res.status(400).json({ error: 'siteId, folder, filename, contentType, and data (base64) are required.' });
  }

  if (!ALLOWED_TYPES.has(contentType)) {
    return res.status(400).json({ error: 'Unsupported file type. Allowed: jpeg, png, webp, gif, svg.' });
  }

  // Sanitize all path segments — no traversal, no special chars
  const safeSite   = siteId.replace(/[^a-zA-Z0-9_-]/g, '');
  const safeFolder = folder.replace(/[^a-zA-Z0-9_\-. ]/g, '_');
  const safeName   = filename.replace(/[^a-zA-Z0-9_\-. ]/g, '_');

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

  try {
    const result = await uploadMedia(safeSite, safeFolder, safeName, buffer, contentType);
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('[Media] Upload error:', err.message);
    res.status(500).json({ error: 'Upload failed.' });
  }
});

// ─── Delete image ──────────────────────────────────────────────────────────

router.delete('/api/media', requireApiKey, async (req, res) => {
  const { path: storagePath } = req.body || {};

  if (!storagePath || typeof storagePath !== 'string') {
    return res.status(400).json({ error: 'path is required.' });
  }

  // Validate: no traversal, no leading slash
  if (/\.\./.test(storagePath) || storagePath.startsWith('/')) {
    return res.status(400).json({ error: 'Invalid path.' });
  }

  try {
    await deleteMedia(storagePath);
    res.json({ ok: true });
  } catch (err) {
    console.error('[Media] Delete error:', err.message);
    res.status(500).json({ error: 'Delete failed.' });
  }
});

module.exports = router;