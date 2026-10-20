const jwt = require('jsonwebtoken');

const getSecret = () => {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET not set in .env');
  return process.env.JWT_SECRET;
};

const COOKIE_NAME = process.env.COOKIE_NAME || 'nodelx_session';
const EXPIRES_IN  = process.env.JWT_EXPIRES_IN || '24h';

/**
 * Sign a JWT with the given payload
 * @param {object} payload - { id, email, role }
 * @returns {string} signed token
 */
const signToken = (payload) => jwt.sign(payload, getSecret(), { expiresIn: EXPIRES_IN });

/**
 * Verify a JWT and return its payload, or null if invalid/expired
 * @param {string} token
 * @returns {object|null}
 */
const verifyToken = (token) => {
  try {
    return jwt.verify(token, getSecret());
  } catch {
    return null;
  }
};

/**
 * Set an HTTP-only auth cookie on the response.
 * `secure` is set only when the request itself is HTTPS (so local HTTP dev
 * still works even when NODE_ENV=production). `sameSite` is 'lax' to allow
 * the cookie to flow to the iframe'd client site.
 * @param {import('express').Response} res
 * @param {object} payload - { id, email, role }
 */
const setAuthCookie = (res, payload) => {
  const token = signToken(payload);
  const isHttps = res.req?.secure || res.req?.headers?.['x-forwarded-proto'] === 'https';
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isHttps,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  });
};

/**
 * Clear the auth cookie.
 * Must mirror the options used in setAuthCookie (path '/', sameSite, secure)
 * or the cookie survives the clear. We clear with both secure and non-secure
 * variants so it works over HTTP and HTTPS.
 * @param {import('express').Response} res
 */
const clearAuthCookie = (res) => {
  const opts = { httpOnly: true, sameSite: 'lax', path: '/' };
  res.clearCookie(COOKIE_NAME, { ...opts, secure: true });
  res.clearCookie(COOKIE_NAME, { ...opts, secure: false });
};

module.exports = { signToken, verifyToken, setAuthCookie, clearAuthCookie, COOKIE_NAME };
