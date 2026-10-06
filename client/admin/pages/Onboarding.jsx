import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { api } from '../api';

function idFromRepo(repo) {
  const m = /^[^/]+\/([^/]+)$/.exec(repo.trim());
  return m ? m[1].toLowerCase().replace(/_/g, '-') : repo.toLowerCase().replace(/_/g, '-');
}

export default function Onboarding() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [repo, setRepo] = useState('');
  const [liveUrl, setLiveUrl] = useState('');
  const [branch, setBranch] = useState('main');
  const [pat, setPat] = useState('');
  const [status, setStatus] = useState(null); // { kind, msg }
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);

  const show = (msg, kind) => setStatus({ msg, kind });

  const handleVerify = async () => {
    if (!/^[^/]+\/[^/]+$/.test(repo.trim())) {
      return show('Please enter a valid "owner/repo".', 'error');
    }
    if (!pat.trim()) {
      return show('Please enter the GitHub PAT for this repo.', 'error');
    }
    const id = idFromRepo(repo);
    if (!name.trim()) setName(id.replace(/-/g, ' '));

    setBusy(true);
    show('Checking repo access…', 'info');
    try {
      const data = await api.verifySite(id, pat.trim());
      if (data.ok) {
        if (data.defaultBranch) setBranch(data.defaultBranch);
        setVerified(true);
        show(`✓ Access confirmed — ${data.fullName}`, 'success');
      } else {
        setVerified(false);
        show('⚠ ' + (data.error || data.message || 'Verification failed'), 'error');
      }
    } catch (err) {
      setVerified(false);
      show('Network error: ' + err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async () => {
    setBusy(true);
    show('Saving…', 'info');
    try {
      await api.createSite({
        repo: repo.trim(),
        name: name.trim(),
        liveUrl: liveUrl.trim(),
        branch: branch.trim() || 'main',
        pat: pat.trim(),
      });
      show('✅ Site saved. Redirecting…', 'success');
      setTimeout(() => navigate('/admin'), 800);
    } catch (err) {
      show('⚠ ' + err.message, 'error');
      setBusy(false);
    }
  };

  return (
    <Layout>
      <div className="page-header">
        <h1 className="page-title">Add a Website</h1>
        <p className="page-subtitle">
          Connect a client's GitHub repository so NodeLx can publish edits straight to it.
        </p>
      </div>

      <div className="card form-card">
        {status && <div className={`alert alert-${status.kind}`}>{status.msg}</div>}

        <div className="field">
          <label htmlFor="name">Site name</label>
          <input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="William B Construction"
          />
        </div>

        <div className="field">
          <label htmlFor="repo">GitHub repository</label>
          <input
            id="repo"
            value={repo}
            onChange={(e) => setRepo(e.target.value)}
            placeholder="ironoak-texas/williamb_constuction"
          />
          <div className="hint">
            Format: <code>owner/repo</code>
          </div>
        </div>

        <div className="field">
          <label htmlFor="liveUrl">Live URL</label>
          <input
            id="liveUrl"
            value={liveUrl}
            onChange={(e) => setLiveUrl(e.target.value)}
            placeholder="https://www.example.com"
          />
        </div>

        <div className="field">
          <label htmlFor="branch">Branch (optional)</label>
          <input
            id="branch"
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            placeholder="main"
          />
        </div>

                <div className="field">
                  <label htmlFor="pat">GitHub PAT (fine-grained, Contents: read &amp; write)</label>
                  <input
                    id="pat"
                    type="password"
                    value={pat}
                    onChange={(e) => setPat(e.target.value)}
                    placeholder="github_pat_…"
                    autoComplete="off"
                  />
                  <div className="hint">
                    Stored locally in <code>content/.site-tokens.json</code> (gitignored). Never committed.
                  </div>
                </div>

                {!verified ? (
          <button className="btn btn-primary btn-block" onClick={handleVerify} disabled={busy}>
            {busy ? 'Verifying…' : '1 · Verify repo access'}
          </button>
        ) : (
          <button className="btn btn-primary btn-block" onClick={handleSave} disabled={busy}>
            {busy ? 'Saving…' : '2 · Save this site'}
          </button>
        )}

        <ul className="steps">
          <li>Fine-grained PAT with <code>Contents: read &amp; write</code> on this repo</li>
          <li>NodeLx commits edits to <code>content/&lt;page&gt;.json</code></li>
          <li>Live site revalidates on publish (no full redeploy)</li>
        </ul>
      </div>
    </Layout>
  );
}