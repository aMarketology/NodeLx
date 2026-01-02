import React, { useState, useEffect } from 'react';
import { getServerUrl } from '../config';
import './ContentEditor.css';

/**
 * Visual Content Editor
 * Allows click-to-edit functionality for content fields
 */
function ContentEditor({ pageId = 'home' }) {
  const [content, setContent] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadContent();
  }, [pageId]);

  const loadContent = async () => {
    try {
      const response = await fetch(`${getServerUrl()}/api/content/${pageId}`);
      const data = await response.json();
      setContent(data.content);
    } catch (error) {
      console.error('Error loading content:', error);
      setMessage('Failed to load content');
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
      const response = await fetch(`${getServerUrl()}/api/content/${pageId}`, {
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

  if (!content) {
    return (
      <div className="editor-container">
        <div className="editor-loading">Loading content...</div>
      </div>
    );
  }

  return (
    <div className="editor-container">
      <div className="editor-header">
        <h1>Content Editor</h1>
        <div className="editor-page-id">Page: {pageId}</div>
        {message && (
          <div className={`editor-message ${message.startsWith('✓') ? 'success' : 'error'}`}>
            {message}
          </div>
        )}
      </div>

      <div className="editor-content">
        <div className="editor-fields">
          {Object.entries(content).map(([field, value]) => (
            <div key={field} className="editor-field">
              <div className="editor-field-header">
                <label className="editor-field-label">{field}</label>
                {editingField !== field && (
                  <button
                    className="editor-edit-btn"
                    onClick={() => startEditing(field, value)}
                  >
                    Edit
                  </button>
                )}
              </div>

              {editingField === field ? (
                <div className="editor-field-editing">
                  <textarea
                    className="editor-textarea"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    autoFocus
                    rows={3}
                  />
                  <div className="editor-field-actions">
                    <button
                      className="editor-save-btn"
                      onClick={saveField}
                      disabled={saving}
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      className="editor-cancel-btn"
                      onClick={cancelEditing}
                      disabled={saving}
                    >
                      Cancel
                    </button>
                  </div>
                  <div className="editor-hint">
                    Press Enter to save, Esc to cancel
                  </div>
                </div>
              ) : (
                <div className="editor-field-value">
                  {value}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ContentEditor;
