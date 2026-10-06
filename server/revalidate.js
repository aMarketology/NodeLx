/**
 * revalidate.js — flush a client site's ISR cache.
 *
 * The client's /api/revalidate endpoint requires the shared secret in the
 * `x-revalidation-secret` header (see the client's docs/headless_cms_implementation.md).
 * The secret is configured on NodeLx as REVALIDATION_SECRET.
 */

/**
 * POST /api/revalidate on the live site for the given paths.
 * @param {string} liveUrl  e.g. "https://www.diamondbctx.com"
 * @param {string[]} paths  e.g. ["/"]
 * @returns {Promise<{path, status?, error?}>}
 */
async function callRevalidate(liveUrl, paths = ['/']) {
  const base = (liveUrl || '').replace(/\/$/, '');
  const secret = process.env.REVALIDATION_SECRET || '';

  const results = [];
  for (const p of paths) {
    try {
      const r = await fetch(`${base}/api/revalidate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(secret ? { 'x-revalidation-secret': secret } : {}),
        },
        body: JSON.stringify({ paths: [p] }),
      });
      results.push({ path: p, status: r.status });
    } catch (err) {
      results.push({ path: p, error: err.message });
    }
  }
  return results;
}

module.exports = { callRevalidate };