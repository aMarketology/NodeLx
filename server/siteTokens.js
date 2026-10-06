const fs = require('fs');
const path = require('path');

/**
 * Per-site GitHub PAT store.
 *
 * Tokens are stored OUTSIDE sites.json (which is committed to Git) in a
 * gitignored file so they never leak into version control.
 *
 * File: content/.site-tokens.json  (gitignored)
 * Shape: { "<siteId>": "github_pat_..." }
 */
const TOKENS_FILE = path.resolve(__dirname, '../content/.site-tokens.json');

const getTokens = () => {
  try {
    const raw = JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf-8'));
    return raw && typeof raw === 'object' ? raw : {};
  } catch {
    return {};
  }
};

const saveTokens = (tokens) => {
  fs.mkdirSync(path.dirname(TOKENS_FILE), { recursive: true });
  fs.writeFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 2), 'utf-8');
};

/**
 * Get the PAT for a site id (or null).
 * @param {string} siteId
 * @returns {string|null}
 */
const getToken = (siteId) => getTokens()[siteId] || null;

/**
 * Set the PAT for a site id.
 * @param {string} siteId
 * @param {string} token
 */
const setToken = (siteId, token) => {
  const tokens = getTokens();
  tokens[siteId] = token;
  saveTokens(tokens);
};

/**
 * Remove the PAT for a site id.
 * @param {string} siteId
 */
const removeToken = (siteId) => {
  const tokens = getTokens();
  if (tokens[siteId]) {
    delete tokens[siteId];
    saveTokens(tokens);
  }
};

module.exports = { getToken, setToken, removeToken };