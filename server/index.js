require('dotenv').config();
const express      = require('express');
const http         = require('http');
const path         = require('path');
const fs           = require('fs');
const cors         = require('cors');
const cookieParser = require('cookie-parser');
const helmet       = require('helmet');
const ContentStore  = require('./contentStore');
const WebSocketServer = require('./websocket');
const adminRoutes   = require('./routes/admin');
const sitesRoutes   = require('./routes/sites');
const mediaRoutes   = require('./routes/media');
const { getSiteByPageId } = require('./sites');
const { getToken } = require('./siteTokens');
const { callRevalidate } = require('./revalidate');
const { verifyToken, COOKIE_NAME } = require('./auth/jwt');
const GitSync = require('./gitSync');

/**
 * NodeLx 2.0 — headless content backend.
 *
 * Responsibilities:
 *   - Serve the admin SPA (dist/) + auth (cookie/JWT)
 *   - Content store (JSON files) with live WebSocket updates
 *   - Git-backed publishing: commit content/*.json to a client's repo
 *   - ISR revalidation of the live site after each commit
 *   - Media (image) storage via Supabase
 *   - Bridge API for the client site's own admin panel (NODELX_API_KEY)
 */
class NodeLxServer {
  constructor(options = {}) {
    this.port = options.port || process.env.PORT || 9000;
    this.app = express();
    this.server = http.createServer(this.app);

    this.contentStore = new ContentStore('./content');
    this.wsServer = new WebSocketServer(this.server);
    this.gitSync = new GitSync();
  }

  async initialize() {
    // Middleware
    this.app.use(helmet({ contentSecurityPolicy: false })); // CSP off for iframe previews
    this.app.use(cors({
      origin: true,
      credentials: true,
    }));
    this.app.use(express.json({ limit: '50mb' }));
    this.app.use(cookieParser());
    this.app.use(express.static('public'));

    // Serve the built admin SPA (dist/) when present, so /assets/* resolves.
    const distDir = path.resolve(__dirname, '../dist');
    if (fs.existsSync(distDir)) {
      this.app.use(express.static(distDir));
    }

    // Auth + Admin routes (login page, /admin/*, /api/auth/*)
    this.app.use(adminRoutes);

    // Sites router (onboarding + Git-backed publishing bridge)
    this.app.use(sitesRoutes(this.gitSync));

    // Media router (Supabase image storage)
    this.app.use(mediaRoutes);

    // ─── 🔒 API security boundary ───────────────────────────────────────────
    // Public: content reads + health (needed by the live site). Everything else
    // under /api/* requires a valid auth cookie.
    const isPublicGet = (u) =>
      u === '/api/health' ||
      u === '/api/content' ||
      u.startsWith('/api/content/');

    this.app.use('/api', (req, res, next) => {
      const url = req.originalUrl.split('?')[0];
      if (req.method === 'GET' && isPublicGet(url)) return next();

      const token = req.cookies?.[COOKIE_NAME];
      const user = token ? verifyToken(token) : null;
      if (!user) return res.status(401).json({ error: 'Not authenticated' });
      req.user = user;
      next();
    });

    // Initialize content store
    await this.contentStore.initialize();

    // Subscribe to content changes and notify WebSocket clients
    this.contentStore.subscribe((event) => {
      this.wsServer.notifyContentChange(event);
    });

    // Setup routes
    this.setupRoutes();

    return this;
  }

  setupRoutes() {
    // Root route → redirect to admin
    this.app.get('/', (req, res) => {
      res.redirect('/admin');
    });

    // Health check
    this.app.get('/api/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // Get all content
    this.app.get('/api/content', (req, res) => {
      res.json(this.contentStore.getAllContent());
    });

    // Get content by page ID
    this.app.get('/api/content/:pageId', (req, res) => {
      const { pageId } = req.params;
      const content = this.contentStore.getContent(pageId);
      if (!content) {
        return res.status(404).json({ error: 'Page not found' });
      }
      res.json(content);
    });

    // Editor context: resolve the site + preview URL for a page (any authed role).
    this.app.get('/api/editor/site', (req, res) => {
      const pageId = req.query.page || '';
      const site = pageId ? getSiteByPageId(pageId) : null;
          const hasToken = site ? Boolean(getToken(site.id) || process.env.GITHUB_PAT) : false;
          res.json({
            pageId: pageId || null,
            site: site || null,
            previewUrl: site?.liveUrl || null,
            hasToken,
          });
        });

    // Update content (authenticated client/developer)
    this.app.patch('/api/content/:pageId', async (req, res) => {
      try {
        const { pageId } = req.params;
        const updates = req.body;

        const updated = await this.contentStore.updateContent(pageId, updates);

        // Resolve the owning site (for Git target + live revalidation).
        const site = getSiteByPageId(pageId);

        // Push to GitHub if a token is configured (ignore failures — save should not break)
        if (this.gitSync.isConfigured() || (site && site.id)) {
          try {
            const result = await this.gitSync.commitFile(
              site || {},
              `content/${pageId}.json`,
              JSON.stringify(updated, null, 2),
              `nodelx: update ${pageId} (edited by ${req.user.email})`
            );
            updated._commit = result;
          } catch (err) {
            console.error('[GitSync] commit failed:', err.message);
            updated._gitWarning = err.message;
          }
        }

        // Flush the live site's ISR cache so the edit goes live in seconds.
                if (site && site.liveUrl) {
                  try {
                    updated._revalidate = await callRevalidate(site.liveUrl, ['/']);
                  } catch (err) {
                    updated._revalidate = { error: err.message };
                  }
                }

        res.json(updated);
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });

    // Upload an image (base64 data URL) → saved to public/uploads/, returns a URL.
    this.app.post('/api/uploads', (req, res) => {
      try {
        const { dataUrl, filename } = req.body || {};
        if (!dataUrl || typeof dataUrl !== 'string') {
          return res.status(400).json({ error: 'dataUrl is required' });
        }

        const match = /^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,(.+)$/.exec(dataUrl);
        if (!match) {
          return res.status(400).json({ error: 'Unsupported image format (png/jpg/gif/webp/svg only)' });
        }

        const subtype = match[1];
        const ext = subtype === 'jpeg' ? 'jpg' : subtype.replace('svg+xml', 'svg');
        const buffer = Buffer.from(match[2], 'base64');

        if (buffer.length > 10 * 1024 * 1024) {
          return res.status(400).json({ error: 'Image too large (max 10 MB)' });
        }

        const uploadsDir = path.resolve(__dirname, '../public/uploads');
        fs.mkdirSync(uploadsDir, { recursive: true });

        const safeName = (filename || `image-${Date.now()}`)
          .replace(/[^a-zA-Z0-9._-]/g, '-')
          .replace(/\.(png|jpe?g|gif|webp|svg)$/i, '');
        const finalName = `${safeName}-${Date.now()}.${ext}`;
        fs.writeFileSync(path.join(uploadsDir, finalName), buffer);

        res.json({ ok: true, url: `/uploads/${finalName}` });
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });
  }

  start() {
    this.server.listen(this.port, '0.0.0.0', () => {
      console.log('\n==========================================');
      console.log('🚀 NodeLx 2.0 Server');
      console.log('==========================================');
      console.log(`Server running at: http://0.0.0.0:${this.port}`);
      console.log(`Content Store: ${this.contentStore.store.size} pages loaded`);
      console.log('==========================================');
      console.log('API Endpoints:');
      console.log('  Content:  GET/PATCH /api/content/:pageId');
      console.log('  Uploads:  POST /api/uploads');
      console.log('  Sites:    GET/POST /api/sites, PUT /api/sites/:id/content/:page');
      console.log('  Media:    GET/POST/DELETE /api/media');
      console.log('  Auth:     POST /api/auth/login|logout, GET /api/auth/me');
      console.log('==========================================\n');
    });
  }

  async stop() {
    await this.contentStore.destroy();
    this.server.close();
  }
}

// Start server if run directly
if (require.main === module) {
  const port = process.env.PORT || 9000;
  const server = new NodeLxServer({ port });

  server
    .initialize()
    .then(() => server.start())
    .catch((error) => {
      console.error('Failed to start server:', error);
      process.exit(1);
    });

  process.on('SIGTERM', async () => {
    await server.stop();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    await server.stop();
    process.exit(0);
  });
}

module.exports = NodeLxServer;