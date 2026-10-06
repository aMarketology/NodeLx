import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import Brand from '../components/Brand';
import { useAuth } from '../AuthContext';
import { api } from '../api';

export default function Editor() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const pageId = searchParams.get('page') || 'williamb-construction-home';

  const frameRef = useRef(null);
  const [siteUrl, setSiteUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pending, setPending] = useState({});
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState({ msg: '', kind: '' });

  const dirtyCount = Object.keys(pending).length;

  // Bootstrap: resolve the site's live URL for this page.
  useEffect(() => {
    (async () => {
      try {
        const ctx = await api.editorContext(pageId);
        setSiteUrl(ctx.previewUrl || 'https://williambconstruction.com');
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [pageId]);

  // Listen for NODELX_CONTENT_CHANGED + NODELX_IMAGE_UPLOAD_REQUEST from the iframe.
  useEffect(() => {
    const onMessage = (e) => {
      const data = e.data;
      if (!data || typeof data !== 'object') return;

        // Text / inline content change
        if (data.type === 'NODELX_CONTENT_CHANGED' && data.key) {
          setPending((prev) => ({ ...prev, [data.key]: { value: data.value, tag: data.tag || 'text' } }));
        }

        // Image upload request → persist via /api/uploads, then reply with the URL
        if (data.type === 'NODELX_IMAGE_UPLOAD_REQUEST' && data.key && data.dataUrl) {
          (async () => {
            try {
              const res = await fetch('/api/uploads', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ dataUrl: data.dataUrl, filename: data.key }),
              });
              const up = await res.json();
              if (res.ok && up.url) {
                // Track the final URL as the pending value for this key
                setPending((prev) => ({ ...prev, [data.key]: { value: up.url, tag: 'img' } }));
                postToFrame({ type: 'NODELX_IMAGE_UPLOAD_RESPONSE', key: data.key, url: up.url });
              } else {
                postToFrame({ type: 'NODELX_IMAGE_UPLOAD_RESPONSE', key: data.key, error: up.error || 'Upload failed' });
              }
            } catch (err) {
              postToFrame({ type: 'NODELX_IMAGE_UPLOAD_RESPONSE', key: data.key, error: err.message });
            }
          })();
        }
      };
      window.addEventListener('message', onMessage);
      return () => window.removeEventListener('message', onMessage);
    }, []);

  const postToFrame = (msg) => {
    try {
      frameRef.current?.contentWindow?.postMessage(msg, '*');
    } catch {
      /* cross-origin — ignore */
    }
  };

  const loadSite = () => {
    if (!siteUrl) return;
    let url = siteUrl;
    url += (url.includes('?') ? '&' : '?') + 'edit=true';
    frameRef.current.src = url;
    setLoading(true);
  };

  useEffect(() => {
    if (siteUrl) loadSite();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteUrl]);

  const saveChanges = async () => {
    if (dirtyCount === 0 || saving) return;
    setSaving(true);
    setStatus({ msg: 'Saving…', kind: '' });
    postToFrame({ type: 'NODELX_SAVE' });

    const payload = {};
    Object.keys(pending).forEach((k) => {
      payload[k] = pending[k].value;
    });

    try {
      const data = await api.saveContent(pageId, payload);
      const commit = data._commit;
      const revalidate = data._revalidate;
      let msg = '✓ Saved' + (commit && commit.commitUrl ? ' · committed' : '');
      if (data._gitWarning) msg += ' · git: ' + data._gitWarning;
      if (revalidate && revalidate.status) msg += ' · revalidated';
      setStatus({ msg, kind: 'ok' });
      setPending({});
      setTimeout(() => setStatus({ msg: '', kind: '' }), 4000);
    } catch (err) {
      setStatus({ msg: 'Error: ' + err.message, kind: 'err' });
    } finally {
      setSaving(false);
    }
  };

  const discardChanges = () => {
    if (saving) return;
    setPending({});
    postToFrame({ type: 'NODELX_DISCARD' });
    setStatus({ msg: 'Discarded', kind: 'ok' });
    setTimeout(() => setStatus({ msg: '', kind: '' }), 2000);
    loadSite();
  };

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
          <button className="btn btn-save" onClick={saveChanges} disabled={dirtyCount === 0 || saving}>
            Save Changes
          </button>
          <button className="btn btn-discard" onClick={discardChanges} disabled={dirtyCount === 0 || saving}>
            Discard
          </button>
          <div className="user-chip">
            <span className="user-avatar">{(user?.email || '?').charAt(0).toUpperCase()}</span>
            <span>{user?.email || '…'}</span>
          </div>
          <Link to="/admin" className="btn btn-ghost">
            Dashboard
          </Link>
        </div>
      </header>

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
            <button className="retry" onClick={loadSite}>
              Retry
            </button>
          </div>
        )}
        <iframe
          ref={frameRef}
          title="Client site — editing mode"
          onLoad={() => setLoading(false)}
        />
      </div>
    </div>
  );
}