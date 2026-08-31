const express    = require('express');
const rateLimit  = require('express-rate-limit');
const path       = require('path');
const { findByEmail } = require('../auth/users');
const { verifyPassword }  = require('../auth/hash');
const { setAuthCookie, clearAuthCookie, verifyToken, COOKIE_NAME } = require('../auth/jwt');
const { requireAuth, requireRole } = require('../auth/middleware');
const { getSites } = require('../sites');

const router = express.Router();

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

// GET /admin → smart redirect based on role
router.get('/admin', (req, res) => {
  const user = getCurrentUser(req);
  if (!user) return res.redirect('/admin/login');
  if (user.role === 'developer') return res.redirect('/admin/dev');
  return res.redirect('/admin/editor');
});

// GET /admin/login → login page
router.get('/admin/login', (req, res) => {
  const user = getCurrentUser(req);
  if (user) return res.redirect('/admin'); // already logged in
  res.sendFile(path.resolve(__dirname, '../../public/admin/login.html'));
});

// GET /admin/dev → Developer dashboard (developer only)
router.get('/admin/dev', requireAuth, requireRole('developer'), (req, res) => {
  res.sendFile(path.resolve(__dirname, '../../public/admin/dashboard.html'));
});

// GET /admin/editor → Client Mode editor (client or developer)
router.get('/admin/editor', requireAuth, (req, res) => {
  res.sendFile(path.resolve(__dirname, '../../public/admin/client-editor.html'));
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

// GET /api/sites → list all managed sites (developer only)
router.get('/api/sites', requireAuth, requireRole('developer'), (req, res) => {
  res.json({ sites: getSites() });
});

module.exports = router;
