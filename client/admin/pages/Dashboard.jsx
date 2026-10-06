import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { api } from '../api';

function SiteCard({ site, onDelete }) {
  const pageId = site.pageId || `${site.id}-home`;
  const initial = (site.name || '?').charAt(0).toUpperCase();
  const isLive = site.status === 'live' || site.liveUrl;

  return (
    <div className="site-card">
      <Link className="site-card-link" to={`/admin/editor?page=${encodeURIComponent(pageId)}`}>
        <div className="site-thumb">
          {site.thumbnail ? (
            <img src={site.thumbnail} alt="" />
          ) : (
            <span>{initial}</span>
          )}
        </div>
        <div className="site-body">
          <div className="site-name">{site.name}</div>
          <div className="site-subtitle">{site.subtitle || site.repo || ''}</div>
          <div className="site-meta">
            <span className={`status-badge ${isLive ? 'status-live' : 'status-draft'}`}>
              {isLive ? 'Live' : 'Draft'}
            </span>
            <span className="site-repo">{site.repo || ''}</span>
          </div>
        </div>
      </Link>
      <div className="site-actions">
        <a
          className="site-action"
          href={site.liveUrl || '#'}
          target="_blank"
          rel="noreferrer"
          title="View live site"
        >
          ↗
        </a>
        <button className="site-action" title="Delete site" onClick={() => onDelete(site)}>
          🗑
        </button>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [sites, setSites] = useState(null);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const { sites } = await api.listSites();
      setSites(sites);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async (site) => {
    if (!window.confirm(`Delete "${site.name}"? This cannot be undone.`)) return;
    try {
      await api.deleteSite(site.id);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <Layout
      actions={
        <Link to="/admin/onboarding" className="btn btn-primary">
          + Add Website
        </Link>
      }
    >
      <div className="page-header">
        <h1 className="page-title">Your Websites</h1>
        <p className="page-subtitle">Manage content across all your sites from one place.</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {sites === null ? (
        <div className="loading">
          <div className="spinner" />
          <div>Loading sites…</div>
        </div>
      ) : sites.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">🌐</div>
          <div className="empty-title">No websites yet</div>
          <div className="empty-text">Add a website to start managing its content.</div>
          <Link to="/admin/onboarding" className="btn btn-primary" style={{ marginTop: '1.25rem' }}>
            + Add your first website
          </Link>
        </div>
      ) : (
        <div className="grid">
          {sites.map((site) => (
            <SiteCard key={site.id} site={site} onDelete={handleDelete} />
          ))}
          <Link to="/admin/onboarding" className="add-card">
            <div className="add-icon">+</div>
            <div>Add Website</div>
          </Link>
        </div>
      )}
    </Layout>
  );
}