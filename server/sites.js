const fs   = require('fs');
const path = require('path');

const SITES_FILE = path.resolve(__dirname, '../content/sites.json');

/**
 * Read all registered sites from disk.
 * @returns {Array}
 */
const getSites = () => {
  try {
    const raw = JSON.parse(fs.readFileSync(SITES_FILE, 'utf-8'));
    return Array.isArray(raw) ? raw : (raw.sites || []);
  } catch {
    return [];
  }
};

/**
 * Find a single site by id.
 * @param {string} id
 * @returns {object|null}
 */
const getSiteById = (id) => getSites().find((s) => s.id === id) || null;

module.exports = { getSites, getSiteById };
