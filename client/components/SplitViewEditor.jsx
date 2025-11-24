import React, { useState, useEffect, useRef } from 'react';
import './SplitViewEditor.css';

/**
 * Split View Editor with Live Preview
 * Left side: Content editor
 * Right side: Live iframe preview of the actual site
 */
function SplitViewEditor({ pageId = 'austin-crate-home', previewUrl = 'http://localhost:3000' }) {
  const [content, setContent] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [currentUrl, setCurrentUrl] = useState(previewUrl);
  const [viewportSize, setViewportSize] = useState('desktop'); // desktop, tablet, mobile
  const [iframeError, setIframeError] = useState(false);
  const [iframeLoading, setIframeLoading] = useState(true);
  const iframeRef = useRef(null);

  useEffect(() => {
    window.debugLog?.('info', 'SplitView', `Initializing SplitViewEditor for page: ${pageId}`);
    window.debugLog?.('info', 'SplitView', `Preview URL set to: ${previewUrl}`);
    loadContent();
  }, [pageId]);

  const loadContent = async () => {
    window.debugLog?.('info', 'Content', `Loading content for: ${pageId}`);
    try {
      const response = await fetch(`http://localhost:3001/api/content/${pageId}`);
      const data = await response.json();
      setContent(data.content);
      window.debugLog?.('success', 'Content', `Loaded ${Object.keys(data.content).length} fields`);
    } catch (error) {
      console.error('Error loading content:', error);
      setMessage('Failed to load content');
      window.debugLog?.('error', 'Content', `Failed to load: ${error.message}`);
    }
  };

  const startEditing = (field, value) => {
    setEditingField(field);
    setEditValue(value);
  };

  const cancelEditing = () => {
    setEditingField(null);
    setEditValue('');
  };

  const saveField = async () => {
    if (!editingField) return;

    setSaving(true);
    setMessage('');

    try {
      const response = await fetch(`http://localhost:3001/api/content/${pageId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: {
            [editingField]: editValue
          }
        }),
      });

      if (response.ok) {
        const updated = await response.json();
        setContent(updated.content);
        setMessage(`✓ Saved: ${editingField}`);
        setEditingField(null);
        setEditValue('');
        
        // Reload the iframe to show changes after a brief delay
        setTimeout(() => {
          refreshPreview();
        }, 500);
        
        // Clear success message after 3 seconds
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage('Failed to save changes');
      }
    } catch (error) {
      console.error('Error saving:', error);
      setMessage('Error saving changes');
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      saveField();
    } else if (e.key === 'Escape') {
      cancelEditing();
    }
  };

  const refreshPreview = () => {
    if (iframeRef.current) {
      setIframeLoading(true);
      setIframeError(false);
      window.debugLog?.('info', 'Iframe', `Refreshing preview: ${currentUrl}`);
      // Force reload by setting src to itself with timestamp
      const url = new URL(iframeRef.current.src);
      url.searchParams.set('_refresh', Date.now());
      iframeRef.current.src = url.toString();
    }
  };

  const handleIframeLoad = () => {
    setIframeLoading(false);
    setIframeError(false);
    window.debugLog?.('success', 'Iframe', `Preview loaded successfully: ${currentUrl}`);
  };

  const handleIframeError = () => {
    setIframeLoading(false);
    setIframeError(true);
    window.debugLog?.('error', 'Iframe', `Failed to load preview: ${currentUrl}`);
  };

  const changeViewport = (size) => {
    setViewportSize(size);
  };

  const getIframeWidth = () => {
    switch (viewportSize) {
      case 'mobile':
        return '375px';
      case 'tablet':
        return '768px';
      case 'desktop':
      default:
        return '100%';
    }
  };

  if (!content) {
    return (
      <div className="split-view-loading">
        <div className="loading-spinner"></div>
        <p>Loading editor...</p>
      </div>
    );
  }

  return (
    <div className="split-view-container">
      {/* Left Panel - Content Editor */}
      <div className="split-view-editor">
        <div className="editor-panel-header">
          <h2>Content Editor</h2>
          <div className="editor-page-badge">{pageId}</div>
        </div>

        {message && (
          <div className={`split-message ${message.startsWith('✓') ? 'success' : 'error'}`}>
            {message}
          </div>
        )}

        <div className="editor-fields-list">
          {Object.entries(content).map(([field, value]) => (
            <div key={field} className="editor-field-item">
              <div className="field-header">
                <label className="field-label">{field}</label>
                {editingField !== field && (
                  <button
                    className="field-edit-btn"
                    onClick={() => startEditing(field, value)}
                  >
                    ✎ Edit
                  </button>
                )}
              </div>

              {editingField === field ? (
                <div className="field-editing">
                  <textarea
                    className="field-textarea"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    autoFocus
                    rows={3}
                  />
                  <div className="field-actions">
                    <button
                      className="btn-save"
                      onClick={saveField}
                      disabled={saving}
                    >
                      {saving ? 'Saving...' : '✓ Save'}
                    </button>
                    <button
                      className="btn-cancel"
                      onClick={cancelEditing}
                      disabled={saving}
                    >
                      ✕ Cancel
                    </button>
                  </div>
                  <div className="field-hint">
                    Press Enter to save • Esc to cancel
                  </div>
                </div>
              ) : (
                <div className="field-value">
                  {value}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Right Panel - Live Preview */}
      <div className="split-view-preview">
        <div className="preview-panel-header">
          <h2>Live Preview</h2>
          
          <div className="preview-controls">
            {/* Viewport Size Toggle */}
            <div className="viewport-toggle">
              <button
                className={`viewport-btn ${viewportSize === 'mobile' ? 'active' : ''}`}
                onClick={() => changeViewport('mobile')}
                title="Mobile View"
              >
                📱
              </button>
              <button
                className={`viewport-btn ${viewportSize === 'tablet' ? 'active' : ''}`}
                onClick={() => changeViewport('tablet')}
                title="Tablet View"
              >
                📱︎
              </button>
              <button
                className={`viewport-btn ${viewportSize === 'desktop' ? 'active' : ''}`}
                onClick={() => changeViewport('desktop')}
                title="Desktop View"
              >
                🖥️
              </button>
            </div>

            {/* Refresh Button */}
            <button className="refresh-btn" onClick={refreshPreview} title="Refresh Preview">
              ↻ Refresh
            </button>
          </div>
        </div>

        {/* URL Bar */}
        <div className="preview-url-bar">
          <input
            type="text"
            className="preview-url-input"
            value={currentUrl}
            onChange={(e) => setCurrentUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                refreshPreview();
              }
            }}
            placeholder="Enter preview URL..."
          />
        </div>

        {/* Iframe Container */}
        <div className="preview-iframe-container">
          {iframeLoading && (
            <div className="iframe-loading-overlay">
              <div className="loading-spinner"></div>
              <p>Loading preview...</p>
            </div>
          )}
          
          {iframeError && (
            <div className="iframe-error-overlay">
              <div className="error-icon">⚠️</div>
              <h3>Preview Not Available</h3>
              <p>Make sure your site is running on:</p>
              <code>{currentUrl}</code>
              <button className="retry-btn" onClick={refreshPreview}>
                ↻ Retry
              </button>
            </div>
          )}
          
          <div 
            className="preview-iframe-wrapper"
            style={{ 
              width: getIframeWidth(),
              margin: viewportSize === 'desktop' ? '0' : '0 auto',
              display: iframeError ? 'none' : 'block'
            }}
          >
            <iframe
              ref={iframeRef}
              src={currentUrl}
              className="preview-iframe"
              title="Live Preview"
              onLoad={handleIframeLoad}
              onError={handleIframeError}
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default SplitViewEditor;
