import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { api } from '../api';

export default function Email() {
  const [sites, setSites] = useState(null);
  const [siteId, setSiteId] = useState('');
  const [campaigns, setCampaigns] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api.listSites().then(({ sites: items }) => { if (active) { setSites(items); setSiteId(items[0]?.id || ''); } }).catch((err) => { if (active) setError(err.message); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!siteId) return;
    let active = true;
    api.listEmailCampaigns(siteId).then((data) => { if (active) setCampaigns(data.campaigns); }).catch((err) => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [siteId]);
  const selected = sites?.find((site) => site.id === siteId);
  let editUrl = null;
  try {
    const url = new URL(selected?.liveUrl);
    if (url.protocol === 'https:' || url.hostname === 'localhost') editUrl = new URL('/admin/email', url).href;
  } catch { /* site URL is not configured */ }
  return <Layout actions={<Link className="btn btn-ghost" to="/admin">Websites</Link>}>
    <div className="page-header"><h1 className="page-title">Email campaigns</h1><p className="page-subtitle">Private NODELKX drafts for each connected website. Edit and prepare broadcasts in the site’s email workspace.</p></div>
    {error && <div className="alert alert-error" role="alert">{error}</div>}
    {!sites ? <div className="loading">Loading sites…</div> : sites.length === 0 ? <p>No websites are connected yet.</p> : <>
      <label>Website <select value={siteId} onChange={(event) => { setCampaigns(null); setError(''); setSiteId(event.target.value); }}>{sites.map((site) => <option key={site.id} value={site.id}>{site.name || site.id}</option>)}</select></label>
      {editUrl ? <p><a className="btn btn-primary" href={editUrl} target="_blank" rel="noreferrer">Open site email editor ↗</a></p> : <p>Configure this site’s live URL to open its email editor.</p>}
      {campaigns === null ? !error && <p>Loading campaigns…</p> : campaigns.length === 0 ? <p>No saved email campaigns for this site yet.</p> : <div className="grid">{campaigns.map((campaign) => <div className="site-card" key={campaign.id}><div className="site-body"><div className="site-name">{campaign.draft.name}</div><div className="site-subtitle">{campaign.draft.subject || 'No subject yet'}</div><div className="site-meta">Updated {new Date(campaign.updatedAt).toLocaleString()}</div></div></div>)}</div>}
    </>}
  </Layout>;
}
