import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import { api } from '../api';

const mb = (bytes) => (bytes ? Math.round((bytes / 1048576) * 100) / 100 : 0);

function Stat({ label, value, tone }) {
  return (
    <div className="speed-stat">
      <div className={`speed-stat-value${tone ? ` speed-stat-${tone}` : ''}`}>{value}</div>
      <div className="speed-stat-label">{label}</div>
    </div>
  );
}

export default function Speed() {
  const [params] = useSearchParams();
  const [sites, setSites] = useState(null);
  const [siteId, setSiteId] = useState(params.get('site') || '');
  const [settings, setSettings] = useState(null);
  const [audit, setAudit] = useState(null);
  const [videoSettings, setVideoSettings] = useState(null);
  const [videoAudit, setVideoAudit] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [batchResult, setBatchResult] = useState(null);
  const [videoResult, setVideoResult] = useState(null);

  // Load the site list once, then default to the first site.
  useEffect(() => {
    (async () => {
      try {
        const { sites: list } = await api.listSites();
        setSites(list || []);
        if (!params.get('site') && list && list.length) setSiteId(list[0].id);
      } catch (err) {
        setError(err.message);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Whenever the selected site changes, load its settings and run an audit.
  useEffect(() => {
    if (!siteId) return;
    setSettings(null);
    setAudit(null);
    setVideoSettings(null);
    setVideoAudit(null);
    setBatchResult(null);
    setVideoResult(null);
    setError('');
    setNotice('');
    loadSite(siteId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId]);

  async function loadSite(id) {
    setBusy('load');
    try {
      const [s, a, va] = await Promise.all([
        api.getSpeedSettings(id),
        api.auditSpeed(id).catch((err) => ({ error: err.message })),
        api.auditVideos(id).catch((err) => ({ error: err.message })),
      ]);
      setSettings(s.settings);
      setVideoSettings(s.videoSettings);
      setAudit(a);
      setVideoAudit(va);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  }

  async function saveVideoSettings(patch) {
    if (!siteId) return;
    setBusy('vsave');
    setError('');
    setNotice('');
    try {
      const res = await api.updateVideoSettings(siteId, patch);
      setVideoSettings(res.videoSettings);
      setNotice('Video settings saved.');
      const va = await api.auditVideos(siteId).catch(() => null);
      if (va) setVideoAudit(va);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  }

  async function compressVideo(path) {
    if (!siteId) return;
    setBusy(`video:${path}`);
    setError('');
    setNotice('');
    setVideoResult(null);
    try {
      const res = await api.optimizeVideo(siteId, path);
      setVideoResult(res);
      setNotice(res.message || (res.status === 'skipped' ? `Skipped: ${res.reason}` : 'Video compressed.'));
      const va = await api.auditVideos(siteId).catch(() => null);
      if (va) setVideoAudit(va);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  }

  async function saveSettings(patch) {
    if (!siteId) return;
    setBusy('save');
    setError('');
    setNotice('');
    try {
      const res = await api.updateSpeedSettings(siteId, patch);
      setSettings(res.settings);
      setNotice('Settings saved. New uploads will use these values.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  }

  async function runBatch() {
    if (!siteId) return;
    setBusy('batch');
    setError('');
    setNotice('');
    setBatchResult(null);
    try {
      const res = await api.optimizeSpeedRepo(siteId, 10);
      setBatchResult(res);
      setNotice(res.message || 'Batch complete.');
      // Re-audit so the numbers reflect the new state.
      const a = await api.auditSpeed(siteId).catch(() => null);
      if (a) setAudit(a);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  }

  const selected = sites?.find((s) => s.id === siteId);
  const summary = audit?.summary;
  const oversized = audit?.oversized || [];
  const vSummary = videoAudit?.summary;
  const oversizedVideos = videoAudit?.oversized || [];

  return (
    <Layout
      actions={
        <>
          <Link to="/admin" className="btn btn-ghost">← Websites</Link>
        </>
      }
    >
      <div className="page-header">
        <h1 className="page-title">Image Speed</h1>
        <p className="page-subtitle">
          Resize and re-encode images at upload time so pages load fast and never exceed
          Vercel&apos;s 10 MB image limit.
        </p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {notice && <div className="alert alert-success">{notice}</div>}

      {sites === null ? (
        <div className="loading">
          <div className="spinner" />
          <div>Loading sites…</div>
        </div>
      ) : sites.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">🌐</div>
          <div className="empty-title">No websites yet</div>
          <div className="empty-text">Add a website before configuring image speed.</div>
        </div>
      ) : (
        <>
          <div className="card" style={{ marginBottom: '1.25rem' }}>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="speed-site">Website</label>
              <select
                id="speed-site"
                className="speed-select"
                value={siteId}
                onChange={(e) => setSiteId(e.target.value)}
              >
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — {s.repo}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {busy === 'load' && (
            <div className="loading">
              <div className="spinner" />
              <div>Auditing images…</div>
            </div>
          )}

          {settings && (
            <div className="card" style={{ marginBottom: '1.25rem' }}>
              <h2 className="speed-section-title">Upload settings</h2>
              <p className="hint" style={{ marginBottom: '1.25rem' }}>
                Applied automatically to every image uploaded through NodeLx for{' '}
                <strong>{selected?.name}</strong>.
              </p>

              <label className="cap-toggle" style={{ marginBottom: '1.25rem' }}>
                <input
                  type="checkbox"
                  checked={settings.enabled !== false}
                  disabled={busy === 'save'}
                  onChange={(e) => saveSettings({ enabled: e.target.checked })}
                />
                <span>Optimize images on upload</span>
              </label>

              <div className="speed-row">
                <div className="field">
                  <label htmlFor="speed-width">Max width (px)</label>
                  <input
                    id="speed-width"
                    type="number"
                    min="320"
                    max="8000"
                    step="100"
                    defaultValue={settings.maxWidth}
                    disabled={busy === 'save' || settings.enabled === false}
                    onBlur={(e) => {
                      const v = Number(e.target.value);
                      if (v !== settings.maxWidth) saveSettings({ maxWidth: v });
                    }}
                  />
                  <div className="hint">2400 is a good default for full-width photos.</div>
                </div>

                <div className="field">
                  <label htmlFor="speed-quality">Quality (40–100)</label>
                  <input
                    id="speed-quality"
                    type="number"
                    min="40"
                    max="100"
                    step="1"
                    defaultValue={settings.quality}
                    disabled={busy === 'save' || settings.enabled === false}
                    onBlur={(e) => {
                      const v = Number(e.target.value);
                      if (v !== settings.quality) saveSettings({ quality: v });
                    }}
                  />
                  <div className="hint">82 is visually lossless for most photos.</div>
                </div>

                <div className="field">
                  <label htmlFor="speed-format">Output format</label>
                  <select
                    id="speed-format"
                    className="speed-select"
                    value={settings.format}
                    disabled={busy === 'save' || settings.enabled === false}
                    onChange={(e) => saveSettings({ format: e.target.value })}
                  >
                    <option value="original">Keep original (JPEG stays JPEG)</option>
                    <option value="webp">Convert to WebP</option>
                    <option value="avif">Convert to AVIF</option>
                  </select>
                  <div className="hint">
                    WebP is ~30% smaller than JPEG with wide support. AVIF is smaller still
                    but slower to encode.
                  </div>
                </div>
              </div>
            </div>
          )}

          {audit && !audit.error && summary && (
            <div className="card" style={{ marginBottom: '1.25rem' }}>
              <h2 className="speed-section-title">Repository audit</h2>
              <p className="hint" style={{ marginBottom: '1.25rem' }}>
                Images already committed to <code>public/</code> on branch{' '}
                <code>{audit.branch}</code>.
              </p>

              <div className="speed-stats">
                <Stat label="Images" value={summary.imageCount} />
                <Stat label="Total size" value={`${summary.totalMB} MB`} />
                <Stat
                  label={`Over ${summary.vercelLimitMB} MB`}
                  value={summary.oversizedCount}
                  tone={summary.oversizedCount > 0 ? 'bad' : 'good'}
                />
                <Stat
                  label="Oversized size"
                  value={`${summary.oversizedMB} MB`}
                  tone={summary.oversizedCount > 0 ? 'bad' : 'good'}
                />
              </div>

              {summary.oversizedCount > 0 ? (
                <>
                  <div className="alert alert-error" style={{ marginTop: '1.25rem' }}>
                    {summary.oversizedCount} image
                    {summary.oversizedCount === 1 ? '' : 's'} exceed Vercel&apos;s{' '}
                    {summary.vercelLimitMB} MB limit and will fail to render in production.
                  </div>

                  <div className="speed-table-wrap">
                    <table className="speed-table">
                      <thead>
                        <tr>
                          <th>Path</th>
                          <th className="num">Size</th>
                        </tr>
                      </thead>
                      <tbody>
                        {oversized.slice(0, 20).map((img) => (
                          <tr key={img.path}>
                            <td className="path">{img.path}</td>
                            <td className="num bad">{img.mb} MB</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {oversized.length > 20 && (
                      <div className="hint" style={{ padding: '0.75rem 1rem' }}>
                        Showing 20 of {oversized.length}.
                      </div>
                    )}
                  </div>

                  <button
                    className="btn btn-primary"
                    style={{ marginTop: '1.25rem' }}
                    disabled={busy === 'batch'}
                    onClick={runBatch}
                  >
                    {busy === 'batch' ? 'Optimizing…' : 'Optimize 10 largest images'}
                  </button>
                  <div className="hint" style={{ marginTop: '0.5rem' }}>
                    Commits optimized versions to the repo. Run it more than once to work
                    through a large backlog.
                  </div>
                </>
              ) : (
                <div className="alert alert-success" style={{ marginTop: '1.25rem' }}>
                  No oversized images — every file in <code>public/</code> is within the limit.
                </div>
              )}

              {batchResult && batchResult.results?.length > 0 && (
                <div className="speed-table-wrap" style={{ marginTop: '1.25rem' }}>
                  <table className="speed-table">
                    <thead>
                      <tr>
                        <th>Result</th>
                        <th>Path</th>
                        <th className="num">Before</th>
                        <th className="num">After</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batchResult.results.map((r, i) => (
                        <tr key={`${r.path}-${i}`}>
                          <td>
                            <span className={`speed-pill speed-pill-${r.status}`}>{r.status}</span>
                          </td>
                          <td className="path">{r.path}</td>
                          <td className="num">{r.originalMB ?? '—'} MB</td>
                          <td className="num">{r.newMB ?? r.reason ?? r.error ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {audit?.error && (
            <div className="alert alert-info">
              Audit unavailable: {audit.error}
            </div>
          )}

          {/* ── Video compression ─────────────────────────────────────── */}
          {videoSettings && (
            <div className="card" style={{ marginBottom: '1.25rem' }}>
              <h2 className="speed-section-title">Video compression</h2>
              <p className="hint" style={{ marginBottom: '1.25rem' }}>
                Self-hosted MP4s are the heaviest assets a site serves. Compress them to a
                target file size with two-pass H.264 encoding.
              </p>

              <label className="cap-toggle" style={{ marginBottom: '1.25rem' }}>
                <input
                  type="checkbox"
                  checked={videoSettings.enabled !== false}
                  disabled={busy === 'vsave'}
                  onChange={(e) => saveVideoSettings({ enabled: e.target.checked })}
                />
                <span>Allow video compression</span>
              </label>

              <div className="speed-row">
                <div className="field">
                  <label htmlFor="video-target">Target size (MB)</label>
                  <input
                    id="video-target"
                    type="number"
                    min="1"
                    max="50"
                    step="0.5"
                    defaultValue={videoSettings.targetMB}
                    disabled={busy === 'vsave' || videoSettings.enabled === false}
                    onBlur={(e) => {
                      const v = Number(e.target.value);
                      if (v !== videoSettings.targetMB) saveVideoSettings({ targetMB: v });
                    }}
                  />
                  <div className="hint">
                    The encoder targets this size. Shorter videos keep more quality at the
                    same budget.
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="video-width">Max width (px)</label>
                  <input
                    id="video-width"
                    type="number"
                    min="320"
                    max="3840"
                    step="160"
                    defaultValue={videoSettings.maxWidth}
                    disabled={busy === 'vsave' || videoSettings.enabled === false}
                    onBlur={(e) => {
                      const v = Number(e.target.value);
                      if (v !== videoSettings.maxWidth) saveVideoSettings({ maxWidth: v });
                    }}
                  />
                  <div className="hint">1280 (720p) is a good default for web video.</div>
                </div>

                <div className="field">
                  <label htmlFor="video-audio">Audio bitrate (kbps)</label>
                  <input
                    id="video-audio"
                    type="number"
                    min="32"
                    max="192"
                    step="16"
                    defaultValue={videoSettings.audioKbps}
                    disabled={busy === 'vsave' || videoSettings.enabled === false}
                    onBlur={(e) => {
                      const v = Number(e.target.value);
                      if (v !== videoSettings.audioKbps) saveVideoSettings({ audioKbps: v });
                    }}
                  />
                  <div className="hint">48 kbps is fine for speech; 128 for music.</div>
                </div>

                <div className="field">
                  <label htmlFor="video-codec">Codec</label>
                  <select
                    id="video-codec"
                    className="speed-select"
                    value={videoSettings.codec}
                    disabled={busy === 'vsave' || videoSettings.enabled === false}
                    onChange={(e) => saveVideoSettings({ codec: e.target.value })}
                  >
                    <option value="h264">H.264 — plays everywhere</option>
                    <option value="h265">H.265 — ~20% smaller, no Firefox support</option>
                  </select>
                  <div className="hint">
                    H.265 gives better quality per byte but Firefox cannot decode it in MP4.
                  </div>
                </div>
              </div>
            </div>
          )}

          {videoAudit && !videoAudit.error && vSummary && (
            <div className="card" style={{ marginBottom: '1.25rem' }}>
              <h2 className="speed-section-title">Video audit</h2>
              <p className="hint" style={{ marginBottom: '1.25rem' }}>
                Videos committed to <code>public/</code> on branch{' '}
                <code>{videoAudit.branch}</code>.
              </p>

              <div className="speed-stats">
                <Stat label="Videos" value={vSummary.videoCount} />
                <Stat label="Total size" value={`${vSummary.totalMB} MB`} />
                <Stat
                  label={`Over ${vSummary.targetMB} MB`}
                  value={vSummary.oversizedCount}
                  tone={vSummary.oversizedCount > 0 ? 'bad' : 'good'}
                />
                <Stat
                  label="Oversized size"
                  value={`${vSummary.oversizedMB} MB`}
                  tone={vSummary.oversizedCount > 0 ? 'bad' : 'good'}
                />
              </div>

              {oversizedVideos.length > 0 ? (
                <>
                  <div className="alert alert-error" style={{ marginTop: '1.25rem' }}>
                    {oversizedVideos.length} video
                    {oversizedVideos.length === 1 ? '' : 's'} exceed the{' '}
                    {vSummary.targetMB} MB target. Compressing commits a new version to the
                    repo.
                  </div>

                  <div className="speed-table-wrap">
                    <table className="speed-table">
                      <thead>
                        <tr>
                          <th>Path</th>
                          <th className="num">Size</th>
                          <th className="num">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {oversizedVideos.map((v) => (
                          <tr key={v.path}>
                            <td className="path">{v.path}</td>
                            <td className="num bad">{v.mb} MB</td>
                            <td className="num">
                              <button
                                className="btn btn-primary"
                                disabled={busy === `video:${v.path}`}
                                onClick={() => compressVideo(v.path)}
                              >
                                {busy === `video:${v.path}` ? 'Compressing…' : 'Compress'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="hint" style={{ marginTop: '0.5rem' }}>
                    Compression runs two ffmpeg passes and can take 30–90 seconds per video.
                  </div>
                </>
              ) : (
                <div className="alert alert-success" style={{ marginTop: '1.25rem' }}>
                  No oversized videos — every file in <code>public/</code> is within the target.
                </div>
              )}

              {videoResult && (
                <div
                  className={`alert ${videoResult.status === 'optimized' ? 'alert-success' : 'alert-info'}`}
                  style={{ marginTop: '1.25rem' }}
                >
                  {videoResult.status === 'optimized' ? (
                    <>
                      <strong>{videoResult.path}</strong> — {videoResult.originalMB} MB →{' '}
                      {videoResult.newMB} MB (saved {videoResult.savedMB} MB).{' '}
                      {videoResult.width}×{videoResult.height}, {videoResult.videoKbps} kbps,{' '}
                      {videoResult.codec}.
                    </>
                  ) : (
                    <>
                      <strong>{videoResult.path}</strong> — skipped: {videoResult.reason}
                      {videoResult.error ? ` (${videoResult.error})` : ''}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {videoAudit?.error && (
            <div className="alert alert-info">
              Video audit unavailable: {videoAudit.error}
            </div>
          )}
        </>
      )}
    </Layout>
  );
}
