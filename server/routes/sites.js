const express = require('express');
const { getSites, getSiteById, upsertSite, deleteSite, idFromRepo } = require('../sites');
const { setToken, removeToken } = require('../siteTokens');
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
      const revalidateResults = [];
      if (site.liveUrl && Array.isArray(revalidatePaths) && revalidatePaths.length) {
        for (const p of revalidatePaths) {
          try {
            const base = (site.liveUrl || '').replace(/\/$/, '');
            const r = await fetch(`${base}/api/revalidate`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ paths: [p] }),
            });
            revalidateResults.push({ path: p, status: r.status });
          } catch (err) {
            revalidateResults.push({ path: p, error: err.message });
          }
        }
      }

      res.json({ ok: true, commit, revalidate: revalidateResults });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};