const express    = require('express');
const rateLimit  = require('express-rate-limit');
const path       = require('path');
const fs         = require('fs');
const { findByEmail } = require('../auth/users');
const { verifyPassword }  = require('../auth/hash');
const { setAuthCookie, clearAuthCookie, verifyToken, COOKIE_NAME } = require('../auth/jwt');
const { requireAuth, requireRole } = require('../auth/middleware');


const router = express.Router();

// ─── SPA serving ─────────────────────────────────────────────────────────────
// The admin panel is a Vite-built React SPA. In production it lives in dist/;
// in development it's served by the Vite dev server (port 5173). We serve the
// built SPA when it exists, and fall back to the legacy static HTML otherwise.
const DIST_ADMIN = path.resolve(__dirname, '../../dist/admin.html');
const LEGACY_ADMIN = path.resolve(__dirname, '../../public/admin');

const serveAdminSpa = (req, res) => {
  if (fs.existsSync(DIST_ADMIN)) {
    return res.sendFile(DIST_ADMIN);
  }
  // Legacy fallback: map to the old static HTML pages.
  const legacyMap = {
    '/admin/login': 'login.html',
    '/admin/onboarding': 'onboarding.html',
    '/admin/editor': 'client-editor.html',
    '/admin/dev': 'dashboard.html',
    '/admin': 'dashboard.html',
  };
  const file = legacyMap[req.path] || 'dashboard.html';
  return res.sendFile(path.join(LEGACY_ADMIN, file));
};

// ─── Rate Limiter ────────────────────────────────────────────────────────────
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: { error: 'Too many login attempts. Please wait 15 minutes and try again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── Helper: resolve current user from cookie ────────────────────────────────
const getCurrentUser = (req) => {
  const token = req.cookies?.[COOKIE_NAME];
  return token ? verifyToken(token) : null;
};

// ─── Admin Pages ─────────────────────────────────────────────────────────────

// GET /admin → serve the SPA (client-side auth handles redirects)
router.get('/admin', (req, res) => {
  serveAdminSpa(req, res);
});

// GET /admin/login → login page
router.get('/admin/login', (req, res) => {
  serveAdminSpa(req, res);
});

// GET /admin/dev → Developer dashboard (developer only)
router.get('/admin/dev', requireAuth, requireRole('developer'), (req, res) => {
  serveAdminSpa(req, res);
});

// GET /admin/onboarding → onboard a new client site (developer only)
router.get('/admin/onboarding', requireAuth, requireRole('developer'), (req, res) => {
  serveAdminSpa(req, res);
});

// GET /admin/editor → Client Mode editor (client or developer)
router.get('/admin/editor', requireAuth, (req, res) => {
  serveAdminSpa(req, res);
});

// GET /admin/logout → clear cookie + redirect
router.get('/admin/logout', (req, res) => {
  clearAuthCookie(res);
  res.redirect('/admin/login');
});

// ─── Auth API ─────────────────────────────────────────────────────────────────

// POST /api/auth/login
router.post('/api/auth/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

    // ── Env-hardcoded admin override (always works, even if users.json is missing)
    const envEmail = process.env.ADMIN_EMAIL;
    const envPass  = process.env.ADMIN_PASSWORD;
    if (envEmail && envPass && email.toLowerCase() === envEmail.toLowerCase() && password === envPass) {
      setAuthCookie(res, { id: 'env-admin', email: envEmail.toLowerCase(), role: 'developer' });
      return res.json({ ok: true, role: 'developer', email: envEmail.toLowerCase() });
    }

    const user = findByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  setAuthCookie(res, { id: user.id, email: user.email, role: user.role });
  return res.json({ ok: true, role: user.role, email: user.email });
});

// POST /api/auth/logout
router.post('/api/auth/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

// GET /api/auth/me → return current user (no password)
router.get('/api/auth/me', requireAuth, (req, res) => {
  const { id, email, role } = req.user;
  res.json({ id, email, role });
});

module.exports = router;
