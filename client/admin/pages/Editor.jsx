import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import Brand from '../components/Brand';
import { useAuth } from '../AuthContext';
import { api } from '../api';

/**
 * NodeLx Editor — sidebar model, aligned to the client's NodelxBridge protocol.
 *
 * Protocol (matches the client's components/admin/NodelxBridge.tsx):
 *   Client → NodeLx:
 *     { type: 'NODELX_READY' }
 *     { type: 'NODELX_ELEMENT_CLICKED', id, currentValue }
 *   NodeLx → Client:
 *     { type: 'NODELX_LIVE_UPDATE', payload: { id, value } }
 *     { type: 'NODELX_PING' }
 *
 * Element ids are dot-notation (e.g. "hero.badge", "hero.h1_0", "projects.0.title").
 * The iframe is loaded with ?nodelx_preview=1.
 */

// ── Dot-notation helpers ────────────────────────────────────────────────────
function getByPath(obj, path) {
  return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

function setByPath(obj, path, value) {
  const keys = path.split('.');
  const clone = JSON.parse(JSON.stringify(obj));
  let cur = clone;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    if (cur[k] == null || typeof cur[k] !== 'object') cur[k] = {};
    cur = cur[k];
  }
  cur[keys[keys.length - 1]] = value;
  return clone;
}

export default function Editor() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const pageId = searchParams.get('page') || 'williamb-construction-home';

  const frameRef = useRef(null);
  const [site, setSite] = useState(null);       // full site object
  const [liveUrl, setLiveUrl] = useState(null); // site.liveUrl
  const [hasToken, setHasToken] = useState(true);
  const [mode, setMode] = useState('live');     // 'live' | 'local'
  const [localUrl, setLocalUrl] = useState('http://localhost:3000');
  const [editingUrl, setEditingUrl] = useState(false);
  const [urlDraft, setUrlDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [content, setContent] = useState(null); // full content object from GitHub
  const [selectedId, setSelectedId] = useState(null); // dot-notation id
  const [editValue, setEditValue] = useState('');
  const [pending, setPending] = useState({});   // id -> value (dot-notation)
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState({ msg: '', kind: '' });

  const dirtyCount = Object.keys(pending).length;
  const activeUrl = mode === 'live' ? liveUrl : localUrl;

  // Bootstrap: resolve site + live URL + token status.
  useEffect(() => {
    (async () => {
      try {
        const ctx = await api.editorContext(pageId);
        setSite(ctx.site || null);
        setLiveUrl(ctx.previewUrl || null);
        setHasToken(ctx.hasToken !== false);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [pageId]);

  // Load the client's current content from GitHub (for the sidebar).
  useEffect(() => {
    if (!site) return;
    (async () => {
      try {
        const data = await api.readEditorContent(site.id, 'home');
        setContent(data.content);
      } catch (err) {
        // Non-fatal — the iframe still works; sidebar just won't pre-fill.
        console.warn('[Editor] could not load content:', err.message);
      }
    })();
  }, [site]);

  const postToFrame = useCallback((msg) => {
    try {
      frameRef.current?.contentWindow?.postMessage(msg, '*');
    } catch {
      /* cross-origin — ignore */
    }
  }, []);

  // Listen for NODELX_READY + NODELX_ELEMENT_CLICKED from the iframe.
  useEffect(() => {
    const onMessage = (e) => {
      const data = e.data;
      if (!data || typeof data !== 'object') return;

      if (data.type === 'NODELX_READY') {
        setLoading(false);
      }

      if (data.type === 'NODELX_ELEMENT_CLICKED' && data.id) {
        setSelectedId(data.id);
        setEditValue(data.currentValue ?? '');
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const loadSite = useCallback(() => {
    if (!activeUrl) return;
    let url = activeUrl;
    url += (url.includes('?') ? '&' : '?') + 'nodelx_preview=1';
    frameRef.current.src = url;
    setLoading(true);
  }, [activeUrl]);

  useEffect(() => {
    if (activeUrl) loadSite();
  }, [activeUrl, mode, loadSite]);

  // Live preview: send the typed value down into the iframe as the user types.
  const handleEditChange = (value) => {
    setEditValue(value);
    if (selectedId) {
      postToFrame({ type: 'NODELX_LIVE_UPDATE', payload: { id: selectedId, value } });
    }
  };

  // Save a new live URL (pencil edit).
  const saveLiveUrl = async () => {
    if (!site || !urlDraft.trim()) return;
    setSaving(true);
    setStatus({ msg: 'Saving URL…', kind: '' });
    try {
      const { site: updated } = await api.updateSite(site.id, { liveUrl: urlDraft.trim() });
      setLiveUrl(updated.liveUrl);
      setEditingUrl(false);
      setStatus({ msg: '✓ Live URL updated', kind: 'ok' });
      setTimeout(() => setStatus({ msg: '', kind: '' }), 3000);
    } catch (err) {
      setStatus({ msg: 'Error: ' + err.message, kind: 'err' });
    } finally {
      setSaving(false);
    }
  };

  // Publish: apply all pending dot-notation edits to the content, commit to GitHub.
  const publish = async () => {
    if (dirtyCount === 0 || saving || !site) return;
    setSaving(true);
    setStatus({ msg: 'Publishing…', kind: '' });

    // Apply pending edits onto the current content tree.
    let next = content || {};
    Object.keys(pending).forEach((id) => {
      next = setByPath(next, id, pending[id]);
    });

    try {
      const data = await api.publishEditorContent(site.id, 'home', next, user?.email);
      const commit = data.commit;
      const revalidate = data.revalidate;
      let msg = '✓ Published' + (commit && commit.commitUrl ? ' · committed' : '');
      if (revalidate && revalidate.length) {
        const ok = revalidate.every((r) => r.status === 200);
        msg += ok ? ' · revalidated' : ' · revalidate issue';
      }
      setStatus({ msg, kind: 'ok' });
      setContent(next);
      setPending({});
      setSelectedId(null);
      setTimeout(() => setStatus({ msg: '', kind: '' }), 4000);
    } catch (err) {
      setStatus({ msg: 'Error: ' + err.message, kind: 'err' });
    } finally {
      setSaving(false);
    }
  };

  const discard = () => {
    if (saving) return;
    setPending({});
    setSelectedId(null);
    setEditValue('');
    setStatus({ msg: 'Discarded', kind: 'ok' });
    setTimeout(() => setStatus({ msg: '', kind: '' }), 2000);
    loadSite();
  };

  // Ping the iframe periodically to keep the bridge alive.
  useEffect(() => {
    const t = setInterval(() => postToFrame({ type: 'NODELX_PING' }), 5000);
    return () => clearInterval(t);
  }, [postToFrame]);

  return (
    <div className="editor-shell">
      <header className="admin-bar">
        <div className="bar-left">
          <Brand />
          <span className="page-badge">{pageId}</span>
        </div>
        <div className="bar-center">
          <span className="mode-pill">Editing Mode</span>
          {dirtyCount > 0 && <span className="dirty-count">{dirtyCount} unsaved</span>}
        </div>
        <div className="bar-right">
          <span className={`save-status ${status.kind}`}>{status.msg}</span>

          {/* Live / Local toggle */}
          <div className="env-toggle" title="Switch between live site and localhost">
            <button className={`env-btn ${mode === 'live' ? 'active' : ''}`} onClick={() => setMode('live')}>
              Live
            </button>
            <button className={`env-btn ${mode === 'local' ? 'active' : ''}`} onClick={() => setMode('local')}>
              Local
            </button>
          </div>

          {/* Pencil to edit the live URL (only in local mode) */}
          {mode === 'local' && (
            <div className="url-edit">
              {editingUrl ? (
                <>
                  <input
                    className="url-input"
                    value={urlDraft}
                    onChange={(e) => setUrlDraft(e.target.value)}
                    placeholder="http://localhost:3000"
                    autoFocus
                  />
                  <button className="btn btn-save" onClick={saveLiveUrl} disabled={saving}>✓</button>
                  <button className="btn btn-ghost" onClick={() => setEditingUrl(false)}>✕</button>
                </>
              ) : (
                <button
                  className="btn btn-ghost pencil-btn"
                  title="Edit live URL"
                  onClick={() => { setUrlDraft(liveUrl || ''); setEditingUrl(true); }}
                >
                  ✏️
                </button>
              )}
            </div>
          )}

          <button className="btn btn-save" onClick={publish} disabled={dirtyCount === 0 || saving}>
            Publish
          </button>
          <button className="btn btn-discard" onClick={discard} disabled={dirtyCount === 0 || saving}>
            Discard
          </button>
          <div className="user-chip">
            <span className="user-avatar">{(user?.email || '?').charAt(0).toUpperCase()}</span>
            <span>{user?.email || '…'}</span>
          </div>
          <Link to="/admin" className="btn btn-ghost">Dashboard</Link>
        </div>
      </header>

      <div className="editor-main">
        {/* Sidebar: selected element editor */}
        <div className="editor-sidebar">
          {selectedId ? (
            <div className="sidebar-content">
              <div className="sidebar-header">
                <span className="sidebar-id">{selectedId}</span>
                <button className="btn btn-ghost" onClick={() => setSelectedId(null)}>✕</button>
              </div>
              <textarea
                className="sidebar-textarea"
                value={editValue}
                onChange={(e) => handleEditChange(e.target.value)}
                placeholder="Edit value…"
                rows={6}
                autoFocus
              />
              <div className="sidebar-hint">
                Changes preview live in the iframe. Click Publish to commit.
              </div>
              <button
                className="btn btn-save sidebar-save"
                onClick={() => {
                  if (selectedId) {
                    setPending((prev) => ({ ...prev, [selectedId]: editValue }));
                    setStatus({ msg: '✓ Staged', kind: 'ok' });
                    setTimeout(() => setStatus({ msg: '', kind: '' }), 1500);
                  }
                }}
              >
                Stage Change
              </button>
            </div>
          ) : (
            <div className="sidebar-empty">
              <div className="empty-icon">👆</div>
              <p>Click an element on the site to edit it.</p>
              <p className="hint">Editable elements are outlined in blue.</p>
            </div>
          )}
        </div>

        {/* Iframe */}
        <div className="iframe-wrap">
          {loading && (
            <div className="iframe-loading">
              <div className="spinner" />
              <div>Loading site…</div>
            </div>
          )}
          {error && (
            <div className="iframe-error">
              <div>⚠️ {error}</div>
              <button className="retry" onClick={loadSite}>Retry</button>
            </div>
          )}
          {!hasToken && (
            <div className="iframe-warning">
              <div>⚠️ No GitHub token configured for this site.</div>
              <div className="iframe-warning-sub">Edits can't be committed. Add a PAT via onboarding or set GITHUB_PAT.</div>
            </div>
          )}
          <iframe
            ref={frameRef}
            title="Client site — editing mode"
            className={!hasToken ? 'iframe-disabled' : ''}
            onLoad={() => setLoading(false)}
          />
        </div>
      </div>
    </div>
  );
}