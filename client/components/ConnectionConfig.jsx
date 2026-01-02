import React, { useState } from 'react';
import { getServerUrl, setServerUrl, resetServerUrl, isUsingRemoteServer } from '../config';
import './ConnectionConfig.css';

/**
 * Connection Configuration Component
 * Allows users to configure the NodeLx server URL for network editing
 */
function ConnectionConfig({ onUrlChange }) {
  const [url, setUrl] = useState(getServerUrl());
  const [isEditing, setIsEditing] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const handleSave = () => {
    setServerUrl(url);
    setIsEditing(false);
    if (onUrlChange) {
      onUrlChange(url);
    }
    // Reload the page to apply new connection
    window.location.reload();
  };

  const handleReset = () => {
    resetServerUrl();
    setUrl('http://localhost:3001');
    setIsEditing(false);
    if (onUrlChange) {
      onUrlChange('http://localhost:3001');
    }
    window.location.reload();
  };

  const handleCancel = () => {
    setUrl(getServerUrl());
    setIsEditing(false);
  };

  const isRemote = isUsingRemoteServer();

  return (
    <div className="connection-config">
      <div className="connection-status">
        <div className={`status-indicator ${isRemote ? 'remote' : 'local'}`}></div>
        <span className="status-label">
          {isRemote ? '🌐 Network Mode' : '💻 Local Mode'}
        </span>
      </div>

      {!isEditing ? (
        <button 
          className="config-button"
          onClick={() => setIsEditing(true)}
          title="Configure server connection"
        >
          ⚙️ Configure Server
        </button>
      ) : (
        <div className="config-form">
          <div className="config-header">
            <h3>NodeLx Server Connection</h3>
            <button 
              className="help-toggle"
              onClick={() => setShowHelp(!showHelp)}
            >
              {showHelp ? '❌' : '❓'}
            </button>
          </div>

          {showHelp && (
            <div className="help-box">
              <h4>Network Editing Setup</h4>
              <ol>
                <li>Run NodeLx server on the machine with your source code</li>
                <li>Find that machine's IP address (e.g., 192.168.1.178)</li>
                <li>Enter: <code>http://192.168.1.178:3001</code></li>
                <li>Click Save and reload</li>
              </ol>
              <p><strong>Local editing:</strong> Use <code>http://localhost:3001</code></p>
              <p><strong>Security:</strong> Only connect to servers on your trusted network</p>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="server-url">Server URL:</label>
            <input
              id="server-url"
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="http://192.168.1.178:3001"
              autoFocus
            />
          </div>

          <div className="form-actions">
            <button className="btn-primary" onClick={handleSave}>
              💾 Save & Reload
            </button>
            <button className="btn-secondary" onClick={handleReset}>
              🔄 Reset to Local
            </button>
            <button className="btn-cancel" onClick={handleCancel}>
              Cancel
            </button>
          </div>

          <div className="current-config">
            <small>Current: {getServerUrl()}</small>
          </div>
        </div>
      )}
    </div>
  );
}

export default ConnectionConfig;
