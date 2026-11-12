/**
 * routes/speed.js — image speed tooling for a site.
 *
 *   GET   /api/speed/settings/:siteId      → current optimization settings
 *   PATCH /api/speed/settings/:siteId      → update settings
 *   POST  /api/speed/optimize              → optimize one base64 image (stats only)
 *   GET   /api/speed/audit/:siteId         → scan repo public/ for oversized images
 *   POST  /api/speed/optimize-repo/:siteId → batch-optimize oversized repo images
 *
 * Auth: developer cookie session (same as the rest of the admin UI).
 *
 * The upload path in routes/media.js already optimizes images automatically.
 * These endpoints exist so the Speed panel can preview savings, audit what is
 * already committed, and repair images that were uploaded before optimization
 * was enabled.
 */

const express = require('express');
const { getSiteById } = require('../sites');
const { requireAuth, requireRole } = require('../auth/middleware');
const { optimizeImage, resolveSettings } = require('../imageOptimizer');
const { optimizeVideo, resolveVideoSettings } = require('../videoOptimizer');

const IMAGE_EXT = /\.(jpe?g|png|webp|avif)$/i;
const VIDEO_EXT = /\.(mp4|webm|mov)$/i;
const VIDEO_MIME = {
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
};
const IMAGE_MIME = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
};

// Vercel's image optimizer refuses sources above this size.
const VERCEL_LIMIT_BYTES = 10 * 1024 * 1024;

const mimeForPath = (p) => {
  const m = /\.([A-Za-z0-9]+)$/.exec(p || '');
  if (!m) return 'application/octet-stream';
  const ext = m[1].toLowerCase();
  return IMAGE_MIME[ext] || VIDEO_MIME[ext] || 'application/octet-stream';
};

const mb = (bytes) => Math.round((bytes / 1048576) * 100) / 100;

module.exports = function speedRouter(gitSync) {
  const router = express.Router();
  const sync = (req, res, next) => {
    req.gitSync = gitSync;
    next();
  };

  // ─── Settings ────────────────────────────────────────────────────────────

  router.get('/api/speed/settings/:siteId', requireAuth, requireRole('developer'), (req, res) => {
    const site = getSiteById(req.params.siteId);
    if (!site) return res.status(404).json({ error: `Unknown site: ${req.params.siteId}` });
    res.json({
      ok: true,
      settings: resolveSettings(site),
      videoSettings: resolveVideoSettings(site),
    });
  });

  router.patch('/api/speed/settings/:siteId', requireAuth, requireRole('developer'), (req, res) => {
    const site = getSiteById(req.params.siteId);
    if (!site) return res.status(404).json({ error: `Unknown site: ${req.params.siteId}` });

    const { updateSite } = require('../sites');
    const body = req.body || {};
    const next = { ...(site.speed || {}) };

    if (body.enabled !== undefined) next.enabled = body.enabled !== false;
    if (body.maxWidth !== undefined) {
      const w = Number(body.maxWidth);
      if (!Number.isFinite(w) || w < 320 || w > 8000) {
        return res.status(400).json({ error: 'maxWidth must be between 320 and 8000.' });
      }
      next.maxWidth = Math.round(w);
    }
    if (body.quality !== undefined) {
      const q = Number(body.quality);
      if (!Number.isFinite(q) || q < 40 || q > 100) {
        return res.status(400).json({ error: 'quality must be between 40 and 100.' });
      }
      next.quality = Math.round(q);
    }
    if (body.format !== undefined) {
      if (!['original', 'webp', 'avif'].includes(body.format)) {
        return res.status(400).json({ error: "format must be 'original', 'webp', or 'avif'." });
      }
      next.format = body.format;
    }

    const updated = updateSite(site.id, { speed: next });
    res.json({ ok: true, settings: resolveSettings(updated) });
  });

  // ─── Video settings ──────────────────────────────────────────────────────

  router.patch('/api/speed/video-settings/:siteId', requireAuth, requireRole('developer'), (req, res) => {
    const site = getSiteById(req.params.siteId);
    if (!site) return res.status(404).json({ error: `Unknown site: ${req.params.siteId}` });

    const { updateSite } = require('../sites');
    const body = req.body || {};
    const next = { ...(site.video || {}) };

    if (body.enabled !== undefined) next.enabled = body.enabled !== false;
    if (body.targetMB !== undefined) {
      const t = Number(body.targetMB);
      if (!Number.isFinite(t) || t < 1 || t > 50) {
        return res.status(400).json({ error: 'targetMB must be between 1 and 50.' });
      }
      next.targetMB = Math.round(t * 10) / 10;
    }
    if (body.maxWidth !== undefined) {
      const w = Number(body.maxWidth);
      if (!Number.isFinite(w) || w < 320 || w > 3840) {
        return res.status(400).json({ error: 'maxWidth must be between 320 and 3840.' });
      }
      next.maxWidth = Math.round(w);
    }
    if (body.audioKbps !== undefined) {
      const a = Number(body.audioKbps);
      if (!Number.isFinite(a) || a < 32 || a > 192) {
        return res.status(400).json({ error: 'audioKbps must be between 32 and 192.' });
      }
      next.audioKbps = Math.round(a);
    }
    if (body.codec !== undefined) {
      if (!['h264', 'h265'].includes(body.codec)) {
        return res.status(400).json({ error: "codec must be 'h264' or 'h265'." });
      }
      next.codec = body.codec;
    }

    const updated = updateSite(site.id, { video: next });
    res.json({ ok: true, videoSettings: resolveVideoSettings(updated) });
  });

  // ─── Preview one image ───────────────────────────────────────────────────

  router.post('/api/speed/optimize', requireAuth, requireRole('developer'), async (req, res) => {
    const { siteId, contentType, data } = req.body || {};
    if (!data) return res.status(400).json({ error: 'data (base64) is required.' });

    let buffer;
    try {
      buffer = Buffer.from(data, 'base64');
    } catch {
      return res.status(400).json({ error: 'data must be a valid base64 string.' });
    }
    if (buffer.length < 100) {
      return res.status(400).json({ error: 'File is too small to be an image.' });
    }

    const site = siteId ? getSiteById(siteId) : null;
    const settings = resolveSettings(site || {});
    const result = await optimizeImage(buffer, contentType || 'image/jpeg', settings);

    res.json({
      ok: true,
      changed: result.changed,
      reason: result.reason || null,
      error: result.error || null,
      originalBytes: result.originalBytes,
      bytes: result.bytes,
      saved: result.saved,
      savedPercent: result.originalBytes
        ? Math.round((result.saved / result.originalBytes) * 1000) / 10
        : 0,
      width: result.width || null,
      height: result.height || null,
      format: result.format || null,
      contentType: result.contentType,
      // Optimized bytes so the caller can store them without re-uploading.
      data: result.changed ? result.buffer.toString('base64') : null,
    });
  });

  // ─── Audit the repo ──────────────────────────────────────────────────────

  router.get('/api/speed/audit/:siteId', requireAuth, requireRole('developer'), sync, async (req, res) => {
    const site = getSiteById(req.params.siteId);
    if (!site) return res.status(404).json({ error: `Unknown site: ${req.params.siteId}` });

    const client = gitSync.clientFor(site);
    if (!client) {
      return res.status(503).json({ error: 'No GitHub token configured for this site.' });
    }

    try {
      const { owner, repo, branch } = gitSync.resolveTarget(site);
      const ref = await client.git.getRef({ owner, repo, ref: `heads/${branch}` });
      const head = await client.git.getCommit({ owner, repo, commit_sha: ref.data.object.sha });
      const tree = await client.git.getTree({
        owner,
        repo,
        tree_sha: head.data.tree.sha,
        recursive: 'true',
      });

      const images = (tree.data.tree || [])
        .filter((t) => t.type === 'blob' && t.path && t.path.startsWith('public/') && IMAGE_EXT.test(t.path))
        .map((t) => ({
          path: t.path,
          bytes: t.size || 0,
          mb: mb(t.size || 0),
          oversized: (t.size || 0) > VERCEL_LIMIT_BYTES,
        }))
        .sort((a, b) => b.bytes - a.bytes);

      const oversized = images.filter((i) => i.oversized);
      const totalBytes = images.reduce((sum, i) => sum + i.bytes, 0);

      res.json({
        ok: true,
        siteId: site.id,
        branch,
        settings: resolveSettings(site),
        summary: {
          imageCount: images.length,
          totalMB: mb(totalBytes),
          oversizedCount: oversized.length,
          oversizedMB: mb(oversized.reduce((sum, i) => sum + i.bytes, 0)),
          vercelLimitMB: mb(VERCEL_LIMIT_BYTES),
        },
        oversized,
        largest: images.slice(0, 25),
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Batch optimize the repo ─────────────────────────────────────────────

  router.post('/api/speed/optimize-repo/:siteId', requireAuth, requireRole('developer'), sync, async (req, res) => {
    const site = getSiteById(req.params.siteId);
    if (!site) return res.status(404).json({ error: `Unknown site: ${req.params.siteId}` });

    const client = gitSync.clientFor(site);
    if (!client) {
      return res.status(503).json({ error: 'No GitHub token configured for this site.' });
    }

    // Cap the batch so one request cannot hammer the GitHub API or time out.
    const limit = Math.min(Math.max(Number(req.body?.limit) || 10, 1), 40);
    const settings = resolveSettings(site);

    try {
      const { owner, repo, branch } = gitSync.resolveTarget(site);
      const ref = await client.git.getRef({ owner, repo, ref: `heads/${branch}` });
      const head = await client.git.getCommit({ owner, repo, commit_sha: ref.data.object.sha });
      const tree = await client.git.getTree({
        owner,
        repo,
        tree_sha: head.data.tree.sha,
        recursive: 'true',
      });

      const targets = (tree.data.tree || [])
        .filter((t) => t.type === 'blob' && t.path && t.path.startsWith('public/') && IMAGE_EXT.test(t.path))
        .filter((t) => (t.size || 0) > VERCEL_LIMIT_BYTES)
        .sort((a, b) => (b.size || 0) - (a.size || 0))
        .slice(0, limit);

      if (targets.length === 0) {
        return res.json({
          ok: true,
          siteId: site.id,
          processed: 0,
          savedBytes: 0,
          results: [],
          message: 'No images over the size limit — nothing to optimize.',
        });
      }

      const results = [];
      let savedBytes = 0;

      for (const target of targets) {
        try {
          const blob = await client.git.getBlob({ owner, repo, file_sha: target.sha });
          const original = Buffer.from(blob.data.content, 'base64');

          const result = await optimizeImage(original, mimeForPath(target.path), settings);

          if (!result.changed) {
            results.push({
              path: target.path,
              status: 'skipped',
              reason: result.reason || 'no-gain',
              originalMB: mb(original.length),
            });
            continue;
          }

          const commit = await gitSync.commitBinaryFile(
            site,
            target.path,
            result.buffer,
            `speed: optimize ${target.path.split('/').pop()} (${mb(original.length)} MB → ${mb(result.bytes)} MB)`,
          );

          savedBytes += result.saved;
          results.push({
            path: target.path,
            status: 'optimized',
            originalMB: mb(original.length),
            newMB: mb(result.bytes),
            savedMB: mb(result.saved),
            width: result.width,
            height: result.height,
            commitSha: commit.sha,
          });
        } catch (err) {
          results.push({ path: target.path, status: 'error', error: err.message });
        }
      }

      const optimized = results.filter((r) => r.status === 'optimized').length;

      res.json({
        ok: true,
        siteId: site.id,
        processed: targets.length,
        optimized,
        savedBytes,
        savedMB: mb(savedBytes),
        results,
        message: optimized
          ? `Optimized ${optimized} image${optimized === 1 ? '' : 's'}, saving ${mb(savedBytes)} MB.`
          : 'No images could be shrunk further.',
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Audit repo videos ───────────────────────────────────────────────────

  router.get('/api/speed/video-audit/:siteId', requireAuth, requireRole('developer'), sync, async (req, res) => {
    const site = getSiteById(req.params.siteId);
    if (!site) return res.status(404).json({ error: `Unknown site: ${req.params.siteId}` });

    const client = gitSync.clientFor(site);
    if (!client) {
      return res.status(503).json({ error: 'No GitHub token configured for this site.' });
    }

    const settings = resolveVideoSettings(site);
    const targetBytes = settings.targetMB * 1048576;

    try {
      const { owner, repo, branch } = gitSync.resolveTarget(site);
      const ref = await client.git.getRef({ owner, repo, ref: `heads/${branch}` });
      const head = await client.git.getCommit({ owner, repo, commit_sha: ref.data.object.sha });
      const tree = await client.git.getTree({
        owner,
        repo,
        tree_sha: head.data.tree.sha,
        recursive: 'true',
      });

      const videos = (tree.data.tree || [])
        .filter((t) => t.type === 'blob' && t.path && t.path.startsWith('public/') && VIDEO_EXT.test(t.path))
        .map((t) => ({
          path: t.path,
          bytes: t.size || 0,
          mb: mb(t.size || 0),
          oversized: (t.size || 0) > targetBytes,
        }))
        .sort((a, b) => b.bytes - a.bytes);

      const oversized = videos.filter((v) => v.oversized);

      res.json({
        ok: true,
        siteId: site.id,
        branch,
        videoSettings: settings,
        summary: {
          videoCount: videos.length,
          totalMB: mb(videos.reduce((sum, v) => sum + v.bytes, 0)),
          oversizedCount: oversized.length,
          oversizedMB: mb(oversized.reduce((sum, v) => sum + v.bytes, 0)),
          targetMB: settings.targetMB,
        },
        oversized,
        largest: videos.slice(0, 25),
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Optimize one repo video ─────────────────────────────────────────────

  router.post('/api/speed/optimize-video/:siteId', requireAuth, requireRole('developer'), sync, async (req, res) => {
    const site = getSiteById(req.params.siteId);
    if (!site) return res.status(404).json({ error: `Unknown site: ${req.params.siteId}` });

    const client = gitSync.clientFor(site);
    if (!client) {
      return res.status(503).json({ error: 'No GitHub token configured for this site.' });
    }

    const videoPath = String(req.body?.path || '').trim();
    if (!videoPath) return res.status(400).json({ error: 'path is required.' });
    if (!videoPath.startsWith('public/') || !VIDEO_EXT.test(videoPath)) {
      return res.status(400).json({ error: 'path must be a video under public/.' });
    }

    const settings = resolveVideoSettings(site);

    try {
      const { owner, repo, branch } = gitSync.resolveTarget(site);
      const ref = await client.git.getRef({ owner, repo, ref: `heads/${branch}` });
      const head = await client.git.getCommit({ owner, repo, commit_sha: ref.data.object.sha });
      const tree = await client.git.getTree({
        owner,
        repo,
        tree_sha: head.data.tree.sha,
        recursive: 'true',
      });

      const entry = (tree.data.tree || []).find((t) => t.type === 'blob' && t.path === videoPath);
      if (!entry) return res.status(404).json({ error: `Video not found in repo: ${videoPath}` });

      const blob = await client.git.getBlob({ owner, repo, file_sha: entry.sha });
      const original = Buffer.from(blob.data.content, 'base64');

      const result = await optimizeVideo(original, mimeForPath(videoPath), settings);

      if (!result.changed) {
        return res.json({
          ok: true,
          path: videoPath,
          status: 'skipped',
          reason: result.reason || 'no-gain',
          error: result.error || null,
          originalMB: mb(original.length),
        });
      }

      const commit = await gitSync.commitBinaryFile(
        site,
        videoPath,
        result.buffer,
        `speed: compress ${videoPath.split('/').pop()} (${mb(original.length)} MB → ${mb(result.bytes)} MB)`,
      );

      res.json({
        ok: true,
        path: videoPath,
        status: 'optimized',
        originalMB: mb(original.length),
        newMB: mb(result.bytes),
        savedMB: mb(result.saved),
        duration: result.duration,
        width: result.width,
        height: result.height,
        videoKbps: result.videoKbps,
        codec: result.codec,
        commitSha: commit.sha,
        message: `Compressed ${mb(original.length)} MB → ${mb(result.bytes)} MB.`,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
