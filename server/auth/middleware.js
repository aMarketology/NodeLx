const { verifyToken, COOKIE_NAME } = require('./jwt');

/**
 * Middleware: require a valid auth cookie.
 * Sets req.user = { id, email, role } on success.
 */
const requireAuth = (req, res, next) => {
  const token = req.cookies?.[COOKIE_NAME];
  const user  = token ? verifyToken(token) : null;

  if (!user) {
    // If it's an API request, return JSON. Otherwise redirect to login page.
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    return res.redirect('/admin/login');
  }

  req.user = user;
  next();
};

/**
 * Middleware factory: require one of the specified roles.
 * Must be used AFTER requireAuth.
 * @param {...string} roles
 */
const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role)) {
    if (req.path.startsWith('/api/')) {
      return res.status(403).json({ error: 'Forbidden — insufficient role' });
    }
    return res.status(403).send('<h1>403 — Forbidden</h1><p>You do not have access to this page.</p>');
  }
  next();
};

module.exports = { requireAuth, requireRole };
