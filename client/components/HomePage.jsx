import React, { useState } from 'react';
import DebugConsole from './DebugConsole';
import './HomePage.css';

/**
 * Sample HomePage component with editable regions
 * The data-editable attribute marks regions that can be edited by clients
 */
function HomePage({ content }) {
  const [websiteUrl, setWebsiteUrl] = useState('http://localhost:3000');
  const [localPath, setLocalPath] = useState('C:\\Users\\Allied Gaming\\Documents\\GitHub\\austin-crate');

  const handleConnect = () => {
    console.log('Connecting to:', { websiteUrl, localPath });
    // TODO: Send this to the backend to establish connection
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
