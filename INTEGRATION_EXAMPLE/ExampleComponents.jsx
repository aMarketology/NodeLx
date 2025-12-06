/**
 * EXAMPLE: How to use NodeLx in your website (localhost:3000)
 * 
 * This file shows various patterns for integrating NodeLx content
 * into your React components.
 */

import React from 'react';
import { useNodeLxContent } from '../hooks/useNodeLxContent';

/**
 * EXAMPLE 1: Basic Usage
 * Simple page that fetches and displays content from NodeLx
 */
export function BasicExample() {
  const { content, loading, error } = useNodeLxContent('home-page');

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!content) return <div>No content found</div>;

  return (
    <div>
      <h1 data-editable="heroTitle">{content.heroTitle}</h1>
      <p data-editable="heroSubtitle">{content.heroSubtitle}</p>
      <img 
        data-editable="heroImage" 
        src={content.heroImage} 
        alt={content.heroImageAlt || 'Hero image'} 
      />
    </div>
  );
}

/**
 * EXAMPLE 2: With Live Updates Callback
 * Show a notification when content updates in real-time
 */
export function LiveUpdateExample() {
  const [lastUpdate, setLastUpdate] = React.useState(null);

  const { content, loading, isConnected } = useNodeLxContent('home-page', {
    onUpdate: (newContent) => {
      setLastUpdate(new Date().toLocaleTimeString());
      console.log('Content updated!', newContent);
    }
  });

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      {/* Connection indicator */}
      <div style={{ 
        padding: '10px', 
        background: isConnected ? '#4ade80' : '#f87171',
        color: 'white' 
      }}>
        {isConnected ? '🟢 Connected to NodeLx' : '🔴 Disconnected'}
      </div>

      {/* Last update indicator */}
      {lastUpdate && (
        <div style={{ padding: '10px', background: '#fef3c7' }}>
          ✨ Content updated at {lastUpdate}
        </div>
      )}

      {/* Your content */}
      <h1 data-editable="heroTitle">{content?.heroTitle}</h1>
      <p data-editable="heroSubtitle">{content?.heroSubtitle}</p>
    </div>
  );
}

/**
 * EXAMPLE 3: Multiple Content Sections
 * Use NodeLx for different parts of your page
 */
export function MultiSectionExample() {
  const header = useNodeLxContent('header-content');
  const hero = useNodeLxContent('hero-section');
  const features = useNodeLxContent('features-section');

  return (
    <div>
      {/* Header */}
      {header.content && (
        <header>
          <h1 data-editable="siteTitle">{header.content.siteTitle}</h1>
          <nav>
            <a href={header.content.navLink1}>{header.content.navLabel1}</a>
            <a href={header.content.navLink2}>{header.content.navLabel2}</a>
          </nav>
        </header>
      )}

      {/* Hero */}
      {hero.content && (
        <section>
          <h2 data-editable="heroTitle">{hero.content.heroTitle}</h2>
          <p data-editable="heroText">{hero.content.heroText}</p>
        </section>
      )}

      {/* Features */}
      {features.content && (
        <section>
          <h3 data-editable="featuresTitle">{features.content.featuresTitle}</h3>
          {/* Map through features array if you have one */}
        </section>
      )}
    </div>
  );
}

/**
 * EXAMPLE 4: Programmatic Content Updates
 * Update content from your website (rare, but possible)
 */
export function EditableExample() {
  const { content, loading, updateContent } = useNodeLxContent('home-page');
  const [editing, setEditing] = React.useState(false);
  const [title, setTitle] = React.useState('');

  React.useEffect(() => {
    if (content) {
      setTitle(content.heroTitle || '');
    }
  }, [content]);

  const handleSave = async () => {
    try {
      await updateContent({ heroTitle: title });
      setEditing(false);
      alert('Content updated!');
    } catch (error) {
      alert('Failed to update: ' + error.message);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      {editing ? (
        <div>
          <input 
            type="text" 
            value={title} 
            onChange={(e) => setTitle(e.target.value)}
            style={{ width: '100%', padding: '10px', fontSize: '24px' }}
          />
          <button onClick={handleSave}>Save</button>
          <button onClick={() => setEditing(false)}>Cancel</button>
        </div>
      ) : (
        <div>
          <h1 data-editable="heroTitle">{content?.heroTitle}</h1>
          <button onClick={() => setEditing(true)}>Edit</button>
        </div>
      )}
    </div>
  );
}

/**
 * EXAMPLE 5: Server-Side Rendering (Next.js)
 * Fetch content at build time or on the server
 */
import { getNodeLxContent } from '../hooks/useNodeLxContent';

export async function getServerSideProps() {
  try {
    const content = await getNodeLxContent('home-page');
    
    return {
      props: {
        content,
      },
    };
  } catch (error) {
    console.error('Failed to fetch NodeLx content:', error);
    
    return {
      props: {
        content: null,
        error: error.message,
      },
    };
  }
}

export function ServerRenderedExample({ content, error }) {
  if (error) return <div>Error loading content: {error}</div>;
  if (!content) return <div>No content available</div>;

  return (
    <div>
      <h1 data-editable="heroTitle">{content.heroTitle}</h1>
      <p data-editable="heroSubtitle">{content.heroSubtitle}</p>
    </div>
  );
}

/**
 * EXAMPLE 6: Full Page Component
 * Complete example with styling and error handling
 */
export function FullPageExample() {
  const { content, loading, error, isConnected } = useNodeLxContent('home-page');

  // Loading state
  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh' 
      }}>
        <div>Loading content...</div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div style={{ padding: '20px', background: '#fee', color: '#c00' }}>
        <h2>Error Loading Content</h2>
        <p>{error.message}</p>
        <p>Make sure NodeLx is running on http://localhost:3001</p>
      </div>
    );
  }

  // No content
  if (!content) {
    return (
      <div style={{ padding: '20px' }}>
        <h2>No Content Found</h2>
        <p>Create a file: <code>content/home-page.json</code></p>
      </div>
    );
  }

  // Success - render content
  return (
    <div>
      {/* Dev indicator (remove in production) */}
      {process.env.NODE_ENV === 'development' && (
        <div style={{
          position: 'fixed',
          top: 10,
          right: 10,
          padding: '5px 10px',
          background: isConnected ? '#4ade80' : '#f87171',
          color: 'white',
          borderRadius: '4px',
          fontSize: '12px',
          zIndex: 9999,
        }}>
          {isConnected ? '🟢 NodeLx Connected' : '🔴 NodeLx Disconnected'}
        </div>
      )}

      {/* Your actual content */}
      <header style={{ padding: '20px', background: '#f0f0f0' }}>
        <h1 data-editable="heroTitle">{content.heroTitle}</h1>
      </header>

      <main style={{ padding: '40px 20px' }}>
        <section style={{ maxWidth: '800px', margin: '0 auto' }}>
          <h2 data-editable="heroSubtitle">{content.heroSubtitle}</h2>
          <p data-editable="heroDescription">{content.heroDescription}</p>
          
          {content.heroImage && (
            <img 
              data-editable="heroImage"
              src={content.heroImage}
              alt={content.heroImageAlt || ''}
              style={{ width: '100%', height: 'auto', marginTop: '20px' }}
            />
          )}

          {content.ctaText && (
            <button 
              data-editable="ctaText"
              style={{
                marginTop: '20px',
                padding: '12px 24px',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '16px',
              }}
            >
              {content.ctaText}
            </button>
          )}
        </section>
      </main>
    </div>
  );
}

export default FullPageExample;
