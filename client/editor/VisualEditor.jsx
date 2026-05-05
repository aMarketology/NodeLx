import React, { useState, useEffect, useRef, useCallback } from 'react';
import './VisualEditor.css';

/**
 * VisualEditor - Main drag-and-drop visual editor component
 * 
 * This component:
 * 1. Loads the target website in an iframe
 * 2. Overlays clickable/draggable handles on editable elements
 * 3. Provides a properties panel for editing selected elements
 * 4. Communicates with the AST API to modify source code
 */

const API_BASE = 'http://localhost:3001';

export default function VisualEditor({ targetUrl = 'http://localhost:3000', projectPath }) {
  // State
  const [selectedElement, setSelectedElement] = useState(null);
  const [hoveredElement, setHoveredElement] = useState(null);
  const [editableElements, setEditableElements] = useState([]);
  const [elementRects, setElementRects] = useState({});
  const [isConnected, setIsConnected] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [editMode, setEditMode] = useState('select'); // 'select', 'drag', 'text'
  const [propertiesPanel, setPropertiesPanel] = useState({ open: true });
  const [dragState, setDragState] = useState(null);
  const [textEditValue, setTextEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  
  // Refs
  const iframeRef = useRef(null);
  const overlayRef = useRef(null);
  const wsRef = useRef(null);

  // Initialize connection and project path
  useEffect(() => {
    initializeConnection();
    setupWebSocket();
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Initialize connection to backend
  const initializeConnection = async () => {
    try {
      // Set project path if provided
      if (projectPath) {
        await fetch(`${API_BASE}/api/project/set-path`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectPath })
        });
      }
      
      // Check health
      const health = await fetch(`${API_BASE}/api/health`);
      if (health.ok) {
        setIsConnected(true);
      }
    } catch (error) {
      console.error('Failed to connect to NodeLx server:', error);
    }
  };

  // Setup WebSocket for real-time updates
  const setupWebSocket = () => {
    const ws = new WebSocket('ws://localhost:3001');
    
    ws.onopen = () => {
      console.log('[VisualEditor] WebSocket connected');
    };
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'ast-modified' || data.type === 'file-changed') {
        // Refresh iframe when code changes
        refreshIframe();
      }
    };
    
    ws.onclose = () => {
      console.log('[VisualEditor] WebSocket disconnected');
      // Attempt reconnect after 2 seconds
      setTimeout(setupWebSocket, 2000);
    };
    
    wsRef.current = ws;
  };

  // Refresh the iframe
  const refreshIframe = () => {
    if (iframeRef.current) {
      iframeRef.current.src = iframeRef.current.src;
    }
  };

  // Handle iframe load
  const handleIframeLoad = useCallback(() => {
    setIframeLoaded(true);
    // Give the page a moment to render, then scan for editable elements
    setTimeout(() => {
      scanEditableElements();
    }, 500);
  }, []);

  // Scan the iframe for elements with data-editable attribute
  const scanEditableElements = () => {
    try {
      const iframe = iframeRef.current;
      if (!iframe || !iframe.contentDocument) {
        console.warn('Cannot access iframe content - may be cross-origin');
        return;
      }

      const doc = iframe.contentDocument;
      const editables = doc.querySelectorAll('[data-editable]');
      const elements = [];
      const rects = {};

      editables.forEach((el) => {
        const id = el.getAttribute('data-editable');
        const rect = el.getBoundingClientRect();
        const iframeRect = iframe.getBoundingClientRect();
        
        elements.push({
          id,
          tagName: el.tagName.toLowerCase(),
          text: el.innerText?.substring(0, 100),
          className: el.className
        });

        // Store position relative to overlay
        rects[id] = {
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height
        };
      });

      setEditableElements(elements);
      setElementRects(rects);
      console.log(`[VisualEditor] Found ${elements.length} editable elements`);
    } catch (error) {
      console.error('Error scanning iframe:', error);
    }
  };

  // Handle click on overlay element
  const handleElementClick = (elementId, e) => {
    e.stopPropagation();
    
    const element = editableElements.find(el => el.id === elementId);
    setSelectedElement(element);
    
    // Get current text for editing
    if (element) {
      setTextEditValue(element.text || '');
    }
  };

  // Handle drag start
  const handleDragStart = (elementId, e) => {
    if (editMode !== 'drag') return;
    
    setDragState({
      elementId,
      startY: e.clientY,
      startX: e.clientX
    });
  };

  // Handle drag end - reorder elements
  const handleDragEnd = async (e) => {
    if (!dragState) return;
    
    const deltaY = e.clientY - dragState.startY;
    const direction = deltaY > 50 ? 'down' : deltaY < -50 ? 'up' : null;
    
    if (direction) {
      try {
        setSaving(true);
        const endpoint = direction === 'up' ? '/api/ast/move/up' : '/api/ast/move/down';
        
        await fetch(`${API_BASE}${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filePath: 'app/page.tsx', // TODO: Make dynamic
            targetId: dragState.elementId
          })
        });
        
        // Iframe will refresh via WebSocket
      } catch (error) {
        console.error('Failed to move element:', error);
      } finally {
        setSaving(false);
      }
    }
    
    setDragState(null);
  };

  // Save text changes
  const handleSaveText = async () => {
    if (!selectedElement) return;
    
    try {
      setSaving(true);
      
      await fetch(`${API_BASE}/api/ast/text`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath: 'app/page.tsx', // TODO: Make dynamic
          targetId: selectedElement.id,
          text: textEditValue
        })
      });
      
      // Update local state
      setSelectedElement(prev => ({ ...prev, text: textEditValue }));
    } catch (error) {
      console.error('Failed to save text:', error);
    } finally {
      setSaving(false);
    }
  };

  // Update spacing
  const handleSpacingChange = async (spacingType, value) => {
    if (!selectedElement) return;
    
    try {
      setSaving(true);
      
      await fetch(`${API_BASE}/api/ast/spacing`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath: 'app/page.tsx',
          targetId: selectedElement.id,
          spacingType,
          value
        })
      });
    } catch (error) {
      console.error('Failed to update spacing:', error);
    } finally {
      setSaving(false);
    }
  };

  // Delete element
  const handleDeleteElement = async () => {
    if (!selectedElement) return;
    
    if (!confirm(`Delete "${selectedElement.id}"?`)) return;
    
    try {
      setSaving(true);
      
      await fetch(`${API_BASE}/api/ast/element`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath: 'app/page.tsx',
          targetId: selectedElement.id
        })
      });
      
      setSelectedElement(null);
    } catch (error) {
      console.error('Failed to delete element:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="visual-editor">
      {/* Top Toolbar */}
      <div className="editor-toolbar">
        <div className="toolbar-left">
          <div className="logo">
            <span className="logo-icon">⚡</span>
            <span className="logo-text">NodeLx</span>
          </div>
          
          <div className="toolbar-divider" />
          
          <div className="mode-buttons">
            <button 
              className={`mode-btn ${editMode === 'select' ? 'active' : ''}`}
              onClick={() => setEditMode('select')}
              title="Select Mode"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/>
              </svg>
            </button>
            <button 
              className={`mode-btn ${editMode === 'drag' ? 'active' : ''}`}
              onClick={() => setEditMode('drag')}
              title="Drag to Reorder"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2v20M2 12h20M7 7l5-5 5 5M7 17l5 5 5-5"/>
              </svg>
            </button>
            <button 
              className={`mode-btn ${editMode === 'text' ? 'active' : ''}`}
              onClick={() => setEditMode('text')}
              title="Edit Text"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 19l7-7 3 3-7 7-3-3z"/>
                <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
              </svg>
            </button>
          </div>
        </div>
        
        <div className="toolbar-center">
          <div className="url-bar">
            <span className="url-icon">🌐</span>
            <span className="url-text">{targetUrl}</span>
          </div>
        </div>
        
        <div className="toolbar-right">
          <button className="toolbar-btn" onClick={refreshIframe} title="Refresh">
            🔄
          </button>
          <button className="toolbar-btn" onClick={scanEditableElements} title="Rescan Elements">
            🔍
          </button>
          <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? '● Connected' : '○ Disconnected'}
          </div>
        </div>
      </div>

      {/* Main Editor Area */}
      <div className="editor-main">
        {/* Preview Panel */}
        <div className="preview-panel">
          <div className="iframe-container">
            {/* The Website */}
            <iframe
              ref={iframeRef}
              src={targetUrl}
              onLoad={handleIframeLoad}
              title="Website Preview"
            />
            
            {/* Element Overlay */}
            {iframeLoaded && (
              <div 
                ref={overlayRef}
                className="element-overlay"
                onMouseUp={handleDragEnd}
              >
                {Object.entries(elementRects).map(([id, rect]) => (
                  <div
                    key={id}
                    className={`overlay-element ${
                      selectedElement?.id === id ? 'selected' : ''
                    } ${hoveredElement === id ? 'hovered' : ''} ${
                      editMode === 'drag' ? 'draggable' : ''
                    }`}
                    style={{
                      top: rect.top,
                      left: rect.left,
                      width: rect.width,
                      height: rect.height
                    }}
                    onClick={(e) => handleElementClick(id, e)}
                    onMouseEnter={() => setHoveredElement(id)}
                    onMouseLeave={() => setHoveredElement(null)}
                    onMouseDown={(e) => handleDragStart(id, e)}
                  >
                    <div className="element-label">{id}</div>
                    {editMode === 'drag' && (
                      <div className="drag-handle">⋮⋮</div>
                    )}
                  </div>
                ))}
              </div>
            )}
            
            {/* Loading State */}
            {!iframeLoaded && (
              <div className="iframe-loading">
                <div className="spinner" />
                <p>Loading website...</p>
              </div>
            )}
          </div>
        </div>

        {/* Properties Panel */}
        {propertiesPanel.open && (
          <div className="properties-panel">
            <div className="panel-header">
              <h3>Properties</h3>
              <button 
                className="panel-close"
                onClick={() => setPropertiesPanel({ open: false })}
              >
                ✕
              </button>
            </div>
            
            {selectedElement ? (
              <div className="panel-content">
                {/* Element Info */}
                <div className="property-section">
                  <h4>Element</h4>
                  <div className="element-info">
                    <span className="tag-name">&lt;{selectedElement.tagName}&gt;</span>
                    <span className="element-id">{selectedElement.id}</span>
                  </div>
                </div>
                
                {/* Text Content */}
                <div className="property-section">
                  <h4>Content</h4>
                  <textarea
                    value={textEditValue}
                    onChange={(e) => setTextEditValue(e.target.value)}
                    placeholder="Enter text content..."
                    rows={4}
                  />
                  <button 
                    className="save-btn"
                    onClick={handleSaveText}
                    disabled={saving}
                  >
                    {saving ? 'Saving...' : 'Save Text'}
                  </button>
                </div>
                
                {/* Spacing */}
                <div className="property-section">
                  <h4>Spacing</h4>
                  <div className="spacing-grid">
                    <div className="spacing-row">
                      <label>Margin Top</label>
                      <select onChange={(e) => handleSpacingChange('marginTop', e.target.value)}>
                        <option value="">None</option>
                        <option value="0.5rem">0.5rem</option>
                        <option value="1rem">1rem</option>
                        <option value="1.5rem">1.5rem</option>
                        <option value="2rem">2rem</option>
                        <option value="3rem">3rem</option>
                        <option value="4rem">4rem</option>
                      </select>
                    </div>
                    <div className="spacing-row">
                      <label>Margin Bottom</label>
                      <select onChange={(e) => handleSpacingChange('marginBottom', e.target.value)}>
                        <option value="">None</option>
                        <option value="0.5rem">0.5rem</option>
                        <option value="1rem">1rem</option>
                        <option value="1.5rem">1.5rem</option>
                        <option value="2rem">2rem</option>
                        <option value="3rem">3rem</option>
                        <option value="4rem">4rem</option>
                      </select>
                    </div>
                    <div className="spacing-row">
                      <label>Padding Top</label>
                      <select onChange={(e) => handleSpacingChange('paddingTop', e.target.value)}>
                        <option value="">None</option>
                        <option value="0.5rem">0.5rem</option>
                        <option value="1rem">1rem</option>
                        <option value="1.5rem">1.5rem</option>
                        <option value="2rem">2rem</option>
                        <option value="3rem">3rem</option>
                        <option value="4rem">4rem</option>
                      </select>
                    </div>
                    <div className="spacing-row">
                      <label>Padding Bottom</label>
                      <select onChange={(e) => handleSpacingChange('paddingBottom', e.target.value)}>
                        <option value="">None</option>
                        <option value="0.5rem">0.5rem</option>
                        <option value="1rem">1rem</option>
                        <option value="1.5rem">1.5rem</option>
                        <option value="2rem">2rem</option>
                        <option value="3rem">3rem</option>
                        <option value="4rem">4rem</option>
                      </select>
                    </div>
                  </div>
                </div>
                
                {/* Actions */}
                <div className="property-section">
                  <h4>Actions</h4>
                  <div className="action-buttons">
                    <button 
                      className="action-btn move-up"
                      onClick={() => handleSpacingChange('moveUp', null)}
                    >
                      ↑ Move Up
                    </button>
                    <button 
                      className="action-btn move-down"
                      onClick={() => handleSpacingChange('moveDown', null)}
                    >
                      ↓ Move Down
                    </button>
                    <button 
                      className="action-btn delete"
                      onClick={handleDeleteElement}
                    >
                      🗑 Delete
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="panel-empty">
                <div className="empty-icon">👆</div>
                <p>Click on an element to edit it</p>
                <p className="hint">
                  Elements with <code>data-editable</code> attribute are editable
                </p>
              </div>
            )}
            
            {/* Elements List */}
            <div className="elements-list">
              <h4>Editable Elements ({editableElements.length})</h4>
              <ul>
                {editableElements.map((el) => (
                  <li 
                    key={el.id}
                    className={selectedElement?.id === el.id ? 'active' : ''}
                    onClick={() => {
                      setSelectedElement(el);
                      setTextEditValue(el.text || '');
                    }}
                  >
                    <span className="el-tag">{el.tagName}</span>
                    <span className="el-id">{el.id}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
        
        {/* Toggle Panel Button */}
        {!propertiesPanel.open && (
          <button 
            className="toggle-panel-btn"
            onClick={() => setPropertiesPanel({ open: true })}
          >
            ◀ Properties
          </button>
        )}
      </div>
      
      {/* Status Bar */}
      <div className="editor-status">
        <span>{editableElements.length} editable elements</span>
        <span>•</span>
        <span>{selectedElement ? `Selected: ${selectedElement.id}` : 'No selection'}</span>
        <span>•</span>
        <span>Mode: {editMode}</span>
        {saving && <span className="saving">Saving...</span>}
      </div>
    </div>
  );
}
