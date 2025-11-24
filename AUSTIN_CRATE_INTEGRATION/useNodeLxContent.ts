// FILE: austin-crate/hooks/useNodeLxContent.ts
// Copy this to your Austin Crate project

import { useState, useEffect } from 'react';

interface NodeLxContent {
  [key: string]: string;
}

/**
 * Hook to fetch content from NodeLx API
 * Usage: const content = useNodeLxContent('austin-crate-home')
 */
export function useNodeLxContent(pageId: string, fallback: NodeLxContent = {}) {
  const [content, setContent] = useState<NodeLxContent>(fallback);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const NODELX_API = process.env.NEXT_PUBLIC_NODELX_API || 'http://localhost:3001';
    
    // Fetch initial content
    fetch(`${NODELX_API}/api/content/${pageId}`)
      .then(res => res.json())
      .then(data => {
        setContent(data.content);
        setLoading(false);
      })
      .catch(err => {
        console.error('NodeLx content fetch failed:', err);
        setError(err.message);
        setLoading(false);
        // Use fallback content if API fails
      });

    // Setup WebSocket for live updates
    try {
      const ws = new WebSocket(`ws://${NODELX_API.replace('http://', '')}`);
      
      ws.onopen = () => {
        console.log('[NodeLx] Connected - live updates enabled');
      };
      
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === 'content-store-update' && data.event.pageId === pageId) {
          console.log('[NodeLx] Content updated, reloading...');
          setContent(data.event.data.content);
        }
      };

      ws.onerror = () => {
        console.warn('[NodeLx] WebSocket connection failed - live updates disabled');
      };

      return () => ws.close();
    } catch (err) {
      console.warn('[NodeLx] WebSocket not available');
    }
  }, [pageId]);

  return { content, loading, error };
}
