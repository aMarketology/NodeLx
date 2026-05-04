import React, { useState, useEffect } from 'react';
import { getServerUrl } from '../config';
import DebugConsole from './DebugConsole';
import './HomePage.css';

function HomePage({ content, onLaunchEditor }) {
  const [websiteUrl, setWebsiteUrl] = useState('http://localhost:3000');
  const [localPath, setLocalPath] = useState('');
  const [status, setStatus] = useState('');

  // Auto-fill from server config on mount
  useEffect(() => {
    fetch(`${getServerUrl()}/api/health`)
      .then(r => r.json())
      .then(data => {
        if (data.siteUrl) setWebsiteUrl(data.siteUrl);
        if (data.projectPath) setLocalPath(data.projectPath);
      })
      .catch(() => {});
  }, []);

  const handleConnect = async () => {
    if (!localPath) {
      setStatus('Please enter a local project path.');
      return;
    }
    setStatus('Connecting...');
    if (onLaunchEditor) {
      await onLaunchEditor({ websiteUrl, localPath });
    }
  };

  return (
    <div className="home-page">
      {/* Hero Section */}
      <section className="hero">
        <div className="hero-content">
          <h1
            data-editable="heroTitle"
            className="hero-title"
          >
            {content.heroTitle}
          </h1>

          <p
            data-editable="heroSubtitle"
            className="hero-subtitle"
          >
            {content.heroSubtitle}
          </p>

          {/* Connection Configuration */}
          <div className="connection-config">
            <div className="input-group">
              <label htmlFor="website-url">Website URL</label>
              <input
                id="website-url"
                type="text"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="http://localhost:3000"
              />
            </div>

            <div className="input-group">
              <label htmlFor="local-path">Local Project Path</label>
              <input
                id="local-path"
                type="text"
                value={localPath}
                onChange={(e) => setLocalPath(e.target.value)}
                placeholder="C:\path\to\your\project"
              />
            </div>

            {status && <p className="connect-status">{status}</p>}

            <button
              onClick={handleConnect}
              className="connect-button"
            >
              Connect & Edit
            </button>
          </div>

          <button
            data-editable="ctaText"
            className="cta-button"
          >
            {content.ctaText}
          </button>
        </div>

        <div className="hero-image-container">
          <img
            data-editable="heroImage"
            src={content.heroImage}
            alt="Hero"
            className="hero-image"
          />
        </div>
      </section>

      {/* Debug Panel */}
      <DebugConsole />
    </div>
  );
}

export default HomePage;
