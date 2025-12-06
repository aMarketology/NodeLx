/**
 * NodeLx Content Hook for React
 * 
 * This hook connects your website (localhost:3000) to NodeLx API (localhost:3001)
 * and provides real-time content updates via WebSocket.
 * 
 * Usage:
 * ```jsx
 * import { useNodeLxContent } from './hooks/useNodeLxContent';
 * 
 * function HomePage() {
 *   const { content, loading, error, updateContent } = useNodeLxContent('home-page');
 *   
 *   if (loading) return <div>Loading...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *   
 *   return (
 *     <div>
 *       <h1 data-editable="heroTitle">{content.heroTitle}</h1>
 *       <p data-editable="heroSubtitle">{content.heroSubtitle}</p>
 *     </div>
 *   );
 * }
 * ```
 */

import { useState, useEffect, useCallback } from 'react';

// Configuration
const NODELX_API_URL = process.env.NEXT_PUBLIC_NODELX_API || 'http://localhost:3001';
const NODELX_WS_URL = NODELX_API_URL.replace('http', 'ws');

/**
 * React hook for fetching and syncing content with NodeLx
 * @param {string} pageId - The ID of the page/content to fetch
 * @param {object} options - Optional configuration
 * @returns {object} - { content, loading, error, updateContent, refetch }
 */
export function useNodeLxContent(pageId, options = {}) {
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  const {
    enableWebSocket = true,
    onUpdate = null,
    onError = null,
  } = options;

  /**
   * Fetch content from NodeLx API
   */
  const fetchContent = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${NODELX_API_URL}/api/content/${pageId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch content: ${response.statusText}`);
      }

      const data = await response.json();
      setContent(data);
      setLoading(false);

      console.log(`[NodeLx] Fetched content for "${pageId}"`, data);
      
      return data;
    } catch (err) {
      console.error(`[NodeLx] Error fetching content for "${pageId}":`, err);
      setError(err);
      setLoading(false);
      
      if (onError) {
        onError(err);
      }
      
      throw err;
    }
  }, [pageId, onError]);

  /**
   * Update content via NodeLx API
   */
  const updateContent = useCallback(async (updates) => {
    try {
      const response = await fetch(`${NODELX_API_URL}/api/content/${pageId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error(`Failed to update content: ${response.statusText}`);
      }

      const result = await response.json();
      setContent(result.content);

      console.log(`[NodeLx] Updated content for "${pageId}"`, result.content);
      
      return result.content;
    } catch (err) {
      console.error(`[NodeLx] Error updating content for "${pageId}":`, err);
      setError(err);
      throw err;
    }
  }, [pageId]);

  /**
   * Set up WebSocket connection for live updates
   */
  useEffect(() => {
    if (!enableWebSocket) return;

    let ws = null;
    let reconnectTimeout = null;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;

    const connect = () => {
      try {
        console.log(`[NodeLx] Connecting to WebSocket...`);
        ws = new WebSocket(NODELX_WS_URL);

        ws.onopen = () => {
          console.log(`[NodeLx] WebSocket connected`);
          setIsConnected(true);
          reconnectAttempts = 0; // Reset on successful connection
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            
            // Handle content updates for this page
            if (message.type === 'content-store-update' && message.pageId === pageId) {
              console.log(`[NodeLx] Real-time update received for "${pageId}"`, message.content);
              setContent(message.content);
              
              if (onUpdate) {
                onUpdate(message.content);
              }
            }

            // Handle reload requests
            if (message.type === 'reload') {
              console.log(`[NodeLx] Reload requested`);
              fetchContent();
            }
          } catch (err) {
            console.error('[NodeLx] Error parsing WebSocket message:', err);
          }
        };

        ws.onerror = (event) => {
          console.error('[NodeLx] WebSocket error:', event);
          setIsConnected(false);
        };

        ws.onclose = () => {
          console.log('[NodeLx] WebSocket disconnected');
          setIsConnected(false);

          // Attempt to reconnect
          if (reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
            console.log(`[NodeLx] Reconnecting in ${delay}ms (attempt ${reconnectAttempts}/${maxReconnectAttempts})...`);
            
            reconnectTimeout = setTimeout(connect, delay);
          } else {
            console.error('[NodeLx] Max reconnection attempts reached. Please refresh the page.');
          }
        };
      } catch (err) {
        console.error('[NodeLx] Failed to create WebSocket:', err);
      }
    };

    connect();

    // Cleanup
    return () => {
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [pageId, enableWebSocket, fetchContent, onUpdate]);

  /**
   * Initial content fetch
   */
  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  return {
    content,
    loading,
    error,
    isConnected,
    updateContent,
    refetch: fetchContent,
  };
}

/**
 * Simple fetch function for server-side or one-time use
 */
export async function getNodeLxContent(pageId) {
  const response = await fetch(`${NODELX_API_URL}/api/content/${pageId}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch content: ${response.statusText}`);
  }

  return response.json();
}

export default useNodeLxContent;
