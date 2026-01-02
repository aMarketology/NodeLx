import React, { useState, useEffect, useRef } from 'react';
import { getServerUrl } from '../config';
import './SplitViewEditor.css';

function SplitViewEditor({ 
  pageId = 'austin-crate-home', 
  previewUrl = 'http://localhost:3000',
  onBack 
}) {
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [currentUrl, setCurrentUrl] = useState(previewUrl);
  const [viewportSize, setViewportSize] = useState('desktop');
  const [iframeLoading, setIframeLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [splitPosition, setSplitPosition] = useState(35);
  
  const iframeRef = useRef(null);
  const API_URL = getServerUrl();

  useEffect(() => {
    console.log('[SplitViewEditor] Mounting with pageId:', pageId);
    loadContent();
  }, [pageId]);

  useEffect(() => {
    if (message.text) {
      const timer = setTimeout(() => setMessage({ text: '', type: '' }), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const loadContent = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_URL}/api/content/${pageId}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      const contentData = data.content || data;
      setContent(contentData);
      setLoading(false);
    } catch (err) {
      console.error('[SplitViewEditor] Error:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  const saveField = async () => {
    if (!editingField || saving) return;
    setSaving(true);

    try {
      const response = await fetch(`${API_URL}/api/content/${pageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: { [editingField]: editValue } }),
      });

      if (!response.ok) throw new Error('Failed to save');

      const updated = await response.json();
      setContent(updated.content || updated);
      setMessage({ text: `✓ Saved "${editingField}"`, type: 'success' });
      setEditingField(null);
      setEditValue('');
      setTimeout(() => refreshPreview(), 500);
    } catch (err) {
      setMessage({ text: `Error: ${err.message}`, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const startEditing = (field, value) => {
    setEditingField(field);
    setEditValue(value || '');
  };

  const cancelEditing = () => {
    setEditingField(null);
    setEditValue('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      saveField();
    } else if (e.key === 'Escape') {
      cancelEditing();
    }
  };

  const refreshPreview = () => {
    if (iframeRef.current) {
      setIframeLoading(true);
      iframeRef.current.src = currentUrl + '?_t=' + Date.now();
    }
  };

  const getViewportWidth = () => {
    switch (viewportSize) {
      case 'mobile': return '375px';
      case 'tablet': return '768px';
      default: return '100%';
    }
  };

  const filteredContent = content ? Object.entries(content).filter(([key, value]) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return key.toLowerCase().includes(term) || 
           (typeof value === 'string' && value.toLowerCase().includes(term));
  }) : [];

  if (loading) {
    return (
      <div className="split-editor-loading">
        <div className="loading-content">
          <div className="spinner"></div>
          <h2>Loading Editor</h2>
          <p>Connecting to {API_URL}...</p>
          {onBack && <button onClick={onBack} className="back-btn">← Back</button>}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="split-editor-error">
        <div className="error-content">
          <div className="error-icon">⚠️</div>
          <h2>Failed to Load Content</h2>
          <p>{error}</p>
          <p>Make sure NodeLx server is running: <code>npm run dev</code></p>
          <div className="error-actions">
            <button onClick={loadContent} className="retry-btn">↻ Retry</button>
            {onBack && <button onClick={onBack} className="back-btn">← Back</button>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="split-editor-container">
      <header className="split-editor-header">
        <div className="header-left">
          {onBack && <button onClick={onBack} className="header-back-btn">←</button>}
          <h1 className="header-title">NodeLx Editor</h1>
          <span className="header-page-badge">{pageId}</span>
        </div>
        
        <div className="header-center">
          {message.text && (
            <div className={`header-message ${message.type}`}>{message.text}</div>
          )}
        </div>

        <div className="header-right">
          <div className="viewport-controls">
            <button 
              className={`viewport-btn ${viewportSize === 'mobile' ? 'active' : ''}`}
              onClick={() => setViewportSize('mobile')} title="Mobile">📱</button>
            <button 
              className={`viewport-btn ${viewportSize === 'tablet' ? 'active' : ''}`}
              onClick={() => setViewportSize('tablet')} title="Tablet">📱</button>
            <button 
              className={`viewport-btn ${viewportSize === 'desktop' ? 'active' : ''}`}
              onClick={() => setViewportSize('desktop')} title="Desktop">🖥️</button>
          </div>
          <button onClick={refreshPreview} className="refresh-btn" title="Refresh">↻</button>
        </div>
      </header>

      <div className="split-editor-main">
        <div className="editor-panel" style={{ width: `${splitPosition}%` }}>
          <div className="editor-toolbar">
            <div className="search-box">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder="Search fields..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
              {searchTerm && <button className="search-clear" onClick={() => setSearchTerm('')}>✕</button>}
            </div>
            <span className="field-count">{filteredContent.length} fields</span>
          </div>

          <div className="editor-fields">
            {filteredContent.length === 0 ? (
              <div className="no-fields">
                <p>{searchTerm ? `No fields match "${searchTerm}"` : 'No content found'}</p>
              </div>
            ) : (
              filteredContent.map(([field, value]) => (
                <div key={field} className={`field-item ${editingField === field ? 'editing' : ''}`}>
                  <div className="field-header">
                    <label className="field-name">{field}</label>
                    {editingField !== field && (
                      <button className="field-edit-btn" onClick={() => startEditing(field, value)}>✎ Edit</button>
                    )}
                  </div>

                  {editingField === field ? (
                    <div className="field-editor">
                      <textarea
                        className="field-textarea"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        autoFocus
                        rows={Math.min(10, Math.max(3, (editValue || '').split('\n').length + 1))}
                      />
                      <div className="field-actions">
                        <button className="btn-save" onClick={saveField} disabled={saving}>
                          {saving ? 'Saving...' : '✓ Save'}
                        </button>
                        <button className="btn-cancel" onClick={cancelEditing} disabled={saving}>✕ Cancel</button>
                      </div>
                      <div className="field-hint">⌘+Enter to save • Esc to cancel</div>
                    </div>
                  ) : (
                    <div className="field-value">
                      {typeof value === 'string' 
                        ? (value.length > 150 ? value.substring(0, 150) + '...' : value)
                        : JSON.stringify(value)}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="split-resizer" onMouseDown={(e) => {
          e.preventDefault();
          const startX = e.clientX;
          const startPos = splitPosition;
          const onMove = (ev) => {
            const container = document.querySelector('.split-editor-main');
            if (container) {
              const delta = ev.clientX - startX;
              const newPos = startPos + (delta / container.offsetWidth) * 100;
              setSplitPosition(Math.min(70, Math.max(20, newPos)));
            }
          };
          const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
          };
          document.addEventListener('mousemove', onMove);
          document.addEventListener('mouseup', onUp);
        }}>
          <div className="resizer-handle"></div>
        </div>

        <div className="preview-panel" style={{ width: `${100 - splitPosition}%` }}>
          <div className="preview-url-bar">
            <span className="url-icon">🌐</span>
            <input
              type="text"
              className="url-input"
              value={currentUrl}
              onChange={(e) => setCurrentUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && refreshPreview()}
              placeholder="Enter preview URL..."
            />
            <button onClick={refreshPreview} className="url-go-btn">Go</button>
          </div>

          <div className="preview-container">
            {iframeLoading && (
              <div className="preview-loading">
                <div className="spinner"></div>
                <p>Loading preview...</p>
              </div>
            )}
            
            <div className="preview-frame-wrapper" style={{ 
              width: getViewportWidth(),
              margin: viewportSize === 'desktop' ? '0' : '0 auto'
            }}>
              <iframe
                ref={iframeRef}
                src={currentUrl}
                className="preview-frame"
                title="Live Preview"
                onLoad={() => setIframeLoading(false)}
                onError={() => setIframeLoading(false)}
              />
            </div>

            {viewportSize !== 'desktop' && (
              <div className="viewport-label">
                {viewportSize === 'mobile' ? '📱 Mobile 375px' : '📱 Tablet 768px'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SplitViewEditor;