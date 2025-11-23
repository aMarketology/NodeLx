import React from 'react';
import './HomePage.css';

/**
 * Sample HomePage component with editable regions
 * The data-editable attribute marks regions that can be edited by clients
 */
function HomePage({ content }) {
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

      {/* About Section */}
      <section className="about">
        <h2>About NodeLx</h2>

        <p
          data-editable="aboutText"
          className="about-text"
        >
          {content.aboutText}
        </p>
      </section>

      {/* Features Section */}
      <section className="features">
        <h2>Features</h2>

        <div className="feature-grid">
          <div className="feature-card">
            <h3>🎨 Live Preview</h3>
            <p>See changes instantly as you code or edit content</p>
          </div>

          <div className="feature-card">
            <h3>💻 Developer First</h3>
            <p>Full control with React, JSX, and your favorite tools</p>
          </div>

          <div className="feature-card">
            <h3>✏️ Client Editing</h3>
            <p>Simple interface for clients to edit content safely</p>
          </div>

          <div className="feature-card">
            <h3>🚀 Easy Deploy</h3>
            <p>Push to production with Supabase integration</p>
          </div>
        </div>
      </section>
    </div>
  );
}

export default HomePage;
