const express = require('express');
const { getSites, getSiteById, upsertSite, updateSite, deleteSite, idFromRepo } = require('../sites');
const { setToken, removeToken, getToken } = require('../siteTokens');
const { callRevalidate } = require('../revalidate');
const { requireAuth, requireRole } = require('../auth/middleware');

const router = express.Router();

/**
 * Sites router — onboarding + per-site Git-backed publishing.
 *
 * Two API surfaces:
 *   1. Developer UI  (cookie auth)     — /api/sites, /api/sites/:id, /api/sites/:id/verify
 *   2. Client bridge (NODELX_API_KEY) — /api/sites/:id/content/:page  (called by the
 *      Next.js admin panel in the client repo via Server Actions)
 */

// ─── API key guard for the client-side bridge ────────────────────────────────
const requireApiKey = (req, res, next) => {
  const configured = req.gitSync && process.env.NODELX_API_KEY;
  const provided = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');

  if (!configured) {
    return res.status(503).json({ error: 'NODELX_API_KEY not configured on this NodeLx server' });
  }
  if (provided !== process.env.NODELX_API_KEY) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  next();
};

/**
 * Middleware that exposes the NodeLx server's GitSync instance on req.gitSync.
 */
const withGitSync = (gitSync) => (req, res, next) => {
  req.gitSync = gitSync;
  next();
};

module.exports = function sitesRouter(gitSync) {
  const sync = withGitSync(gitSync);

  // ─── Developer UI (cookie auth) ──────────────────────────────────────────

  // GET /api/sites → list all sites (developer only)
  router.get('/api/sites', requireAuth, requireRole('developer'), (req, res) => {
    res.json({ sites: getSites() });
  });

  // POST /api/sites → onboard (create) a new site
  router.post('/api/sites', requireAuth, requireRole('developer'), (req, res) => {
      const { repo, name, liveUrl, subtitle, adminUrl, branch, pat } = req.body || {};
    if (!repo || !/^[^/]+\/[^/]+$/.test(repo.trim())) {
      return res.status(400).json({ error: 'A valid GitHub "owner/repo" is required' });
    }

    const id = idFromRepo(repo);
    const site = upsertSite({
      id,
      repo: repo.trim(),
      name: name || id,
      liveUrl: liveUrl || '',
      subtitle: subtitle || '',
      adminUrl: adminUrl || `/admin/editor`,
      branch: branch || 'main',
    });

      // Store the per-site PAT (gitignored) if provided
      if (pat && typeof pat === 'string' && pat.trim()) {
        setToken(id, pat.trim());
      }

      res.status(201).json({ site });
    });

  // GET/POST /api/sites/:id/verify → connectivity check (developer, optional)
    // Accepts an optional { pat } in the body so onboarding can verify a token
    // before it's persisted. (POST is used by the onboarding form; GET kept for
    // backward compatibility.)
    router.post('/api/sites/:id/verify', requireAuth, requireRole('developer'), sync, async (req, res) => {
      const site = getSiteById(req.params.id);
      if (!site) return res.status(404).json({ error: 'Site not found' });

      const { pat } = req.body || {};
      const verifySite = { ...site };
      if (pat && typeof pat === 'string' && pat.trim()) {
        // Temporarily use the provided token for verification
        verifySite._pat = pat.trim();
      }

      const result = await req.gitSync.verifyRepo(verifySite);
      res.json({ site: site.id, ...result });
    });

    router.get('/api/sites/:id/verify', requireAuth, requireRole('developer'), sync, async (req, res) => {
      const site = getSiteById(req.params.id);
      if (!site) return res.status(404).json({ error: 'Site not found' });
      const result = await req.gitSync.verifyRepo(site);
      res.json({ site: site.id, ...result });
    });

  // GET /api/sites/:id → single site
  router.get('/api/sites/:id', requireAuth, requireRole('developer'), (req, res) => {
    const site = getSiteById(req.params.id);
    if (!site) return res.status(404).json({ error: 'Site not found' });
    res.json({ site });
  });

    // PATCH /api/sites/:id → update site fields (e.g. liveUrl)
    router.patch('/api/sites/:id', requireAuth, requireRole('developer'), (req, res) => {
      const { liveUrl, name, subtitle, branch } = req.body || {};
      const fields = {};
      if (liveUrl !== undefined) fields.liveUrl = liveUrl;
      if (name !== undefined) fields.name = name;
      if (subtitle !== undefined) fields.subtitle = subtitle;
      if (branch !== undefined) fields.branch = branch;

      const site = updateSite(req.params.id, fields);
      if (!site) return res.status(404).json({ error: 'Site not found' });
      res.json({ site });
    });

    // DELETE /api/sites/:id → remove a site
    router.delete('/api/sites/:id', requireAuth, requireRole('developer'), (req, res) => {
      const ok = deleteSite(req.params.id);
      if (!ok) return res.status(404).json({ error: 'Site not found' });
      res.json({ ok: true });
    });

  // ─── Client bridge (NODELX_API_KEY) ──────────────────────────────────────
  // Matches the client repo's saveHome() contract:
  //   PUT /api/sites/:siteId/content/:page
  //   Authorization: Bearer <NODELX_API_KEY>
  //   Body: { content, authorEmail, revalidatePaths }
  // ─── Editor bridge (cookie auth, developer) ──────────────────────────────
    // The NodeLx editor reads/writes the client's content/<page>.json via these
    // cookie-authenticated endpoints (the API-key bridge below is for the
    // client's own admin panel).

    // GET /api/editor/content/:siteId/:page → read current content from GitHub
    router.get('/api/editor/content/:siteId/:page', requireAuth, requireRole('developer'), sync, async (req, res) => {
      const site = getSiteById(req.params.siteId);
      if (!site) return res.status(404).json({ error: `Unknown site: ${req.params.siteId}` });

      const page = req.params.page.replace(/[^a-zA-Z0-9_-]/g, '');
      try {
        const { content, sha } = await req.gitSync.readFile(site, `content/${page}.json`);
        res.json({ ok: true, content: JSON.parse(content), sha });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // PUT /api/editor/content/:siteId/:page → commit content to GitHub + revalidate
    router.put('/api/editor/content/:siteId/:page', requireAuth, requireRole('developer'), sync, async (req, res) => {
      const site = getSiteById(req.params.siteId);
      if (!site) return res.status(404).json({ error: `Unknown site: ${req.params.siteId}` });

      const page = req.params.page.replace(/[^a-zA-Z0-9_-]/g, '');
      const { content, authorEmail, revalidatePaths = [] } = req.body || {};

      if (content === undefined || content === null) {
        return res.status(400).json({ error: 'content is required' });
      }

      try {
        const repoPath = `content/${page}.json`;
        const body = JSON.stringify(content, null, 2);
        const commit = await req.gitSync.commitFile(
          site,
          repoPath,
          body,
          `content: update ${page}.json${authorEmail ? ` by ${authorEmail}` : ''}`
        );

        const revalidateResults =
          site.liveUrl && Array.isArray(revalidatePaths) && revalidatePaths.length
            ? await callRevalidate(site.liveUrl, revalidatePaths)
            : [];

        res.json({ ok: true, commit, revalidate: revalidateResults });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // GET /api/sites/:id/content/:page → read current content from GitHub
      // (used by the NodeLx editor to load current values for the sidebar).
      router.get('/api/sites/:id/content/:page', sync, requireApiKey, async (req, res) => {
      const site = getSiteById(req.params.id);
      if (!site) return res.status(404).json({ error: `Unknown site: ${req.params.id}` });

      const page = req.params.page.replace(/[^a-zA-Z0-9_-]/g, '');
      try {
        const { content, sha } = await req.gitSync.readFile(site, `content/${page}.json`);
        res.json({ ok: true, content: JSON.parse(content), sha });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    router.put('/api/sites/:id/content/:page', sync, requireApiKey, async (req, res) => {
      const site = getSiteById(req.params.id);
      if (!site) return res.status(404).json({ error: `Unknown site: ${req.params.id}` });

      const page = req.params.page.replace(/[^a-zA-Z0-9_-]/g, '');
      const { content, authorEmail, revalidatePaths = [] } = req.body || {};

    if (content === undefined || content === null) {
      return res.status(400).json({ error: 'content is required' });
    }

    try {
      const repoPath = `content/${page}.json`;
      const body = JSON.stringify(content, null, 2);
      const commit = await req.gitSync.commitFile(
        site,
        repoPath,
        body,
        `content: update ${page}.json${authorEmail ? ` by ${authorEmail}` : ''}`
      );

      // Flush the live site's ISR cache so the edit goes live in seconds.
            const revalidateResults =
              site.liveUrl && Array.isArray(revalidatePaths) && revalidatePaths.length
                ? await callRevalidate(site.liveUrl, revalidatePaths)
                : [];

            res.json({ ok: true, commit, revalidate: revalidateResults });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};