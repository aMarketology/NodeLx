import React, { useState, useEffect, useRef } from 'react';
import './DebugConsole.css';

/**
 * Debug Console Component
 * Displays real-time logs of all system activities:
 * - API calls
 * - WebSocket events
 * - Content updates
 * - Errors
 * - Component lifecycle
 */
function DebugConsole() {
  const [logs, setLogs] = useState([]);
  const [isExpanded, setIsExpanded] = useState(true);
  const [filter, setFilter] = useState('all'); // all, error, info, success, warning
  const [autoScroll, setAutoScroll] = useState(true);
  const logsEndRef = useRef(null);
  const consoleRef = useRef(null);

  // Add log entry
  const addLog = (type, category, message, data = null) => {
    const logEntry = {
      id: Date.now() + Math.random(),
      timestamp: new Date().toLocaleTimeString(),
      type, // 'error', 'info', 'success', 'warning'
      category, // 'API', 'WebSocket', 'Content', 'System', 'Iframe'
      message,
      data
    };

    setLogs(prev => [...prev, logEntry]);
  };

  // Expose addLog globally so other components can use it
  useEffect(() => {
    window.debugLog = addLog;
    
    // Log initial system info
    addLog('info', 'System', 'Debug Console initialized');
    addLog('info', 'System', `Environment: ${window.location.hostname}`);
    addLog('info', 'System', `Port: ${window.location.port}`);
    
    // Override console methods to capture logs
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;

    console.log = (...args) => {
      originalLog(...args);
      addLog('info', 'Console', args.join(' '), args);
    };

    console.error = (...args) => {
      originalError(...args);
      addLog('error', 'Console', args.join(' '), args);
    };

    console.warn = (...args) => {
      originalWarn(...args);
      addLog('warning', 'Console', args.join(' '), args);
    };

    // Monitor fetch API
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const url = args[0];
      const options = args[1] || {};
      
      addLog('info', 'API', `→ ${options.method || 'GET'} ${url}`);
      
      try {
        const response = await originalFetch(...args);
        const status = response.status;
        
        if (status >= 200 && status < 300) {
          addLog('success', 'API', `✓ ${status} ${url}`);
        } else {
          addLog('error', 'API', `✗ ${status} ${url}`);
        }
        
        return response;
      } catch (error) {
        addLog('error', 'API', `✗ Failed ${url}`, error.message);
        throw error;
      }
    };

    // Monitor WebSocket
    const originalWebSocket = window.WebSocket;
    window.WebSocket = function(...args) {
      const ws = new originalWebSocket(...args);
      
      addLog('info', 'WebSocket', `Connecting to ${args[0]}`);
      
      ws.addEventListener('open', () => {
        addLog('success', 'WebSocket', `✓ Connected to ${args[0]}`);
      });
      
      ws.addEventListener('close', () => {
        addLog('warning', 'WebSocket', `Disconnected from ${args[0]}`);
      });
      
      ws.addEventListener('error', (error) => {
        addLog('error', 'WebSocket', `✗ Connection error`, error);
      });
      
      ws.addEventListener('message', (event) => {
        try {
          const data = JSON.parse(event.data);
          addLog('info', 'WebSocket', `← ${data.type}`, data);
        } catch (e) {
          addLog('info', 'WebSocket', `← Message received`, event.data);
        }
      });
      
      return ws;
    };

    // Cleanup
    return () => {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
      window.fetch = originalFetch;
      window.WebSocket = originalWebSocket;
    };
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const clearLogs = () => {
    setLogs([]);
    addLog('info', 'System', 'Logs cleared');
  };

  const exportLogs = () => {
    const logText = logs.map(log => 
      `[${log.timestamp}] [${log.type.toUpperCase()}] [${log.category}] ${log.message}`
    ).join('\n');
    
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nodelx-logs-${Date.now()}.txt`;
    a.click();
    
    addLog('success', 'System', 'Logs exported');
  };

  const filteredLogs = filter === 'all' 
    ? logs 
    : logs.filter(log => log.type === filter);

  const getTypeIcon = (type) => {
    switch (type) {
      case 'error': return '❌';
      case 'success': return '✅';
      case 'warning': return '⚠️';
      case 'info': return 'ℹ️';
      default: return '•';
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'error': return '#ff4757';
      case 'success': return '#2ed573';
      case 'warning': return '#ffa502';
      case 'info': return '#63b3ed';
      default: return '#fff';
    }
  };

  return (
    <div className={`debug-console ${isExpanded ? 'expanded' : 'collapsed'}`}>
      {/* Console Header */}
      <div className="debug-header">
        <div className="debug-title">
          <span className="debug-icon">🐛</span>
          <h3>Debug Console</h3>
          <span className="debug-count">{logs.length} logs</span>
        </div>
        
        <div className="debug-controls">
          {/* Filter Buttons */}
          <div className="debug-filters">
            <button 
              className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              All
            </button>
            <button 
              className={`filter-btn ${filter === 'error' ? 'active' : ''}`}
              onClick={() => setFilter('error')}
            >
              Errors
            </button>
            <button 
              className={`filter-btn ${filter === 'success' ? 'active' : ''}`}
              onClick={() => setFilter('success')}
            >
              Success
            </button>
            <button 
              className={`filter-btn ${filter === 'info' ? 'active' : ''}`}
              onClick={() => setFilter('info')}
            >
              Info
            </button>
          </div>

          {/* Action Buttons */}
          <button className="debug-btn" onClick={clearLogs} title="Clear Logs">
            🗑️ Clear
          </button>
          <button className="debug-btn" onClick={exportLogs} title="Export Logs">
            💾 Export
          </button>
          <label className="debug-checkbox">
            <input 
              type="checkbox" 
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
            />
            Auto-scroll
          </label>
          <button 
            className="debug-toggle" 
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? 'Minimize' : 'Expand'}
          >
            {isExpanded ? '▼' : '▲'}
          </button>
        </div>
      </div>

      {/* Console Body */}
      {isExpanded && (
        <div className="debug-body" ref={consoleRef}>
          <div className="debug-logs">
            {filteredLogs.length === 0 ? (
              <div className="debug-empty">
                <p>No logs to display</p>
                <small>System events will appear here</small>
              </div>
            ) : (
              filteredLogs.map(log => (
                <div 
                  key={log.id} 
                  className={`debug-log-entry ${log.type}`}
                >
                  <span className="log-icon">{getTypeIcon(log.type)}</span>
                  <span className="log-timestamp">{log.timestamp}</span>
                  <span 
                    className="log-category"
                    style={{ color: getTypeColor(log.type) }}
                  >
                    [{log.category}]
                  </span>
                  <span className="log-message">{log.message}</span>
                  {log.data && (
                    <details className="log-data">
                      <summary>Show data</summary>
                      <pre>{JSON.stringify(log.data, null, 2)}</pre>
                    </details>
                  )}
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>
        </div>
      )}
    </div>
  );
}

export default DebugConsole;
