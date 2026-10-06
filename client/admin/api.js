/**
 * NodeLx Admin API client.
 * All requests use `credentials: 'include'` so the auth cookie set by the
 * Express backend (http://localhost:9000) is sent automatically.
 */
 const BASE = ''; // same-origin; Vite dev proxies /api to :9000

async function request(path, options = {}) {
  const res = await fetch(BASE + path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const err = new Error((data && data.error) || `Request failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

export const api = {
  // ── Auth ──────────────────────────────────────────────
  me: () => request('/api/auth/me'),
  login: (email, password) =>
    request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  logout: () => request('/api/auth/logout', { method: 'POST' }),

  // ── Sites ─────────────────────────────────────────────
  listSites: () => request('/api/sites'),
  createSite: (payload) => request('/api/sites', { method: 'POST', body: JSON.stringify(payload) }),
    verifySite: (id, pat) =>
      request(`/api/sites/${encodeURIComponent(id)}/verify`, {
        method: 'POST',
        body: JSON.stringify({ pat }),
      }),
    updateSite: (id, fields) =>
      request(`/api/sites/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(fields),
      }),
    deleteSite: (id) => request(`/api/sites/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  // ── Editor ────────────────────────────────────────────
    editorContext: (pageId) => request(`/api/editor/site?page=${encodeURIComponent(pageId)}`),
    saveContent: (pageId, payload) =>
      request(`/api/content/${encodeURIComponent(pageId)}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),

    // ── Editor bridge (cookie auth) — read/write the client's GitHub content ──
    // Read the client's content/<page>.json from GitHub (for the editor sidebar).
    readEditorContent: (siteId, page) =>
      request(`/api/editor/content/${encodeURIComponent(siteId)}/${encodeURIComponent(page)}`),
    // Publish the full content object back to the client repo (commit + revalidate).
    publishEditorContent: (siteId, page, content, authorEmail) =>
      request(`/api/editor/content/${encodeURIComponent(siteId)}/${encodeURIComponent(page)}`, {
        method: 'PUT',
        body: JSON.stringify({ content, authorEmail, revalidatePaths: ['/'] }),
      }),
  };