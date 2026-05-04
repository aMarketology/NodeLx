import React from 'react';

function App() {
  return (
    <div className="site">
      <header className="site-header">
        <a href="/" data-editable="brand" className="brand">Acme Co.</a>
        <nav className="nav">
          <a href="/" data-editable="navHome">Home</a>
          <a href="/about" data-editable="navAbout">About</a>
          <a href="/contact" data-editable="navContact">Contact</a>
        </nav>
      </header>

      <main>
        <section className="hero">
          <h1 data-editable="heroTitle">
            Build something people love.
          </h1>
          <p data-editable="heroSubtitle">
            A short, friendly tagline that explains what your product does in one sentence.
          </p>
          <a href="/signup" data-editable="heroCta" className="cta">
            Get started
          </a>
        </section>

        <section className="feature">
          <img
            data-editable="featureImage"
            src="https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=1200&h=675&fit=crop"
            alt="Workspace"
            className="feature-image"
          />
          <div className="feature-text">
            <h2 data-editable="featureTitle">
              Designed for makers.
            </h2>
            <p data-editable="featureBody">
              Tools that get out of the way so you can focus on shipping. Fast, simple, and built for the long run.
            </p>
          </div>
        </section>

        <section className="cta-band">
          <h2 data-editable="bandTitle">Ready to start?</h2>
          <a href="/signup" data-editable="bandCta" className="cta">
            Try it free
          </a>
        </section>
      </main>

      <footer className="site-footer">
        <p data-editable="footerText">© 2026 Acme Co. All rights reserved.</p>
      </footer>
    </div>
  );
}

export default App;
