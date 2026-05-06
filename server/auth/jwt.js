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
 * Set an HTTP-only auth cookie on the response
 * @param {import('express').Response} res
 * @param {object} payload - { id, email, role }
 */
const setAuthCookie = (res, payload) => {
  const token = signToken(payload);
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  });
};

/**
 * Clear the auth cookie
 * @param {import('express').Response} res
 */
const clearAuthCookie = (res) => res.clearCookie(COOKIE_NAME);

module.exports = { signToken, verifyToken, setAuthCookie, clearAuthCookie, COOKIE_NAME };
