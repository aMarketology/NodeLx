import React, { useState, useEffect } from 'react';
import HomePage from './components/HomePage';
import ContentEditor from './components/ContentEditor';
import SplitViewEditor from './components/SplitViewEditor';
import TestSplitView from './components/TestSplitView';
import ConnectionConfig from './components/ConnectionConfig';
import './App.css';

/**
 * Main App component
 * Manages content loading and WebSocket connection for live updates
 */
function App() {
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [highlightedElement, setHighlightedElement] = useState(null);
  const [editorMode, setEditorMode] = useState(false);
  const [editorConfig, setEditorConfig] = useState(null);
  const [serverUrl, setServerUrl] = useState(() => {
    // Check localStorage for saved server URL
    const saved = localStorage.getItem('nodelx-server-url');
    return saved || 'http://localhost:3001';
  });

  useEffect(() => {
    loadContent();
    setupWebSocket();
  }, [serverUrl]);

  const loadContent = async () => {
    try {
      const response = await fetch(`${serverUrl}/api/content/home`);
      const data = await response.json();
      setContent(data.content);
      setLoading(false);
    } catch (error) {
      console.error('Error loading content:', error);
      setLoading(false);
    }
  };

  const setupWebSocket = () => {
    const wsUrl = serverUrl.replace('http://', 'ws://').replace('https://', 'wss://');
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('[WebSocket] Connected to server');
      setConnected(true);
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      handleWebSocketMessage(data);
    };

    ws.onclose = () => {
      console.log('[WebSocket] Disconnected from server');
      setConnected(false);

      // Attempt to reconnect after 2 seconds
      setTimeout(setupWebSocket, 2000);
    };

    ws.onerror = (error) => {
      console.error('[WebSocket] Error:', error);
    };
  };

  const handleWebSocketMessage = (data) => {
    console.log('[WebSocket] Received:', data.type);

    switch (data.type) {
      case 'content-store-update':
        // Reload content when it changes
        if (data.event.type === 'update' && data.event.pageId === 'home') {
          setContent(data.event.data.content);
        }
        break;

      case 'highlight-element':
        // Highlight element when cursor moves in editor
        setHighlightedElement(data.elementId);
        highlightElementInDOM(data.elementId);
        break;

      case 'reload':
        // Full page reload
        window.location.reload();
        break;

      default:
        break;
    }
  };

  const highlightElementInDOM = (elementId) => {
    // Remove previous highlights
    document.querySelectorAll('.highlighted').forEach(el => {
      el.classList.remove('highlighted');
    });

    // Add highlight to target element
    if (elementId) {
      const element = document.querySelector(`[data-editable="${elementId}"]`);
      if (element) {
        element.classList.add('highlighted');

        // Scroll into view
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });

        // Remove highlight after 2 seconds
        setTimeout(() => {
          element.classList.remove('highlighted');
          setHighlightedElement(null);
        }, 2000);
      }
    }
  };

  const handleLaunchEditor = (config) => {
    console.log('Launching editor with config:', config);
    setEditorConfig(config);
    setEditorMode(true);
  };

  const handleBackToHome = () => {
    setEditorMode(false);
    setEditorConfig(null);
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading content...</p>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="error-container">
        <h2>Content not found</h2>
        <p>Could not load page content. Make sure the server is running.</p>
      </div>
    );
  }

  return (
    <div className="app">
      {/* Connection Configuration */}
      <ConnectionConfig onUrlChange={setServerUrl} />

      {/* Show different views based on mode */}
      {editorMode ? (
        <SplitViewEditor 
          previewUrl={editorConfig?.websiteUrl || 'http://localhost:3000'}
          onBack={handleBackToHome}
        />
      ) : (
        <>
          {/* Connection status indicator */}
          <div className={`connection-status ${connected ? 'connected' : 'disconnected'}`}>
            {connected ? '● Connected' : '○ Disconnected'}
          </div>

          {/* Main content */}
          <HomePage content={content} onLaunchEditor={handleLaunchEditor} />
        </>
      )}
    </div>
  );
}

export default App;
