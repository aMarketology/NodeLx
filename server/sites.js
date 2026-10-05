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

/**
 * Persist the full sites array to disk.
 * @param {Array} sites
 */
const saveSites = (sites) => {
  fs.mkdirSync(path.dirname(SITES_FILE), { recursive: true });
  fs.writeFileSync(SITES_FILE, JSON.stringify(sites, null, 2), 'utf-8');
};

/**
 * Create (or replace) a site and persist it.
 * @param {object} site full site object
 * @returns {object} the persisted site
 */
const upsertSite = (site) => {
  const sites = getSites();
  const idx = sites.findIndex((s) => s.id === site.id);
  const now = new Date().toISOString();

  const normalized = {
    status: 'draft',
    adminUrl: '/admin/editor',
    createdAt: now,
    ...site,
    lastEdited: now,
  };

  if (idx >= 0) {
    normalized.createdAt = sites[idx].createdAt || now;
    sites[idx] = normalized;
  } else {
    sites.push(normalized);
  }

  saveSites(sites);
  return normalized;
};

/**
 * Delete a site by id. Returns true if removed.
 * @param {string} id
 */
const deleteSite = (id) => {
  const sites = getSites();
  const next = sites.filter((s) => s.id !== id);
  if (next.length === sites.length) return false;
  saveSites(next);
  return true;
};

/**
 * Derive a stable site id from a GitHub "owner/repo" string.
 * Repos may use `-` or `_`; normalize to hyphens.
 * @param {string} repo "owner/repo"
 * @returns {string|null}
 */
const idFromRepo = (repo) => {
  const m = /^([^/]+)\/([^/]+)$/.exec((repo || '').trim());
  if (!m) return null;
  return m[2].toLowerCase().replace(/_/g, '-');
};

module.exports = {
  getSites,
  getSiteById,
  upsertSite,
  deleteSite,
  idFromRepo,
};
