/**
 * NodeLx Client Configuration
 * Manages server URL for network-based editing
 */

const DEFAULT_SERVER_URL = 'http://localhost:3001';
const STORAGE_KEY = 'nodelx-server-url';

/**
 * Get the configured server URL
 * @returns {string} Server URL (HTTP)
 */
export function getServerUrl() {
  if (typeof window === 'undefined') return DEFAULT_SERVER_URL;
  return localStorage.getItem(STORAGE_KEY) || DEFAULT_SERVER_URL;
}

/**
 * Get the WebSocket URL from the server URL
 * @param {string} [serverUrl] - Optional server URL, defaults to getServerUrl()
 * @returns {string} WebSocket URL
 */
export function getWebSocketUrl(serverUrl) {
  const url = serverUrl || getServerUrl();
  return url.replace('http://', 'ws://').replace('https://', 'wss://');
}

/**
 * Set the server URL
 * @param {string} url - Server URL to save
 */
export function setServerUrl(url) {
  if (typeof window === 'undefined') return;
  
  // Clean up URL
  url = url.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'http://' + url;
  }
  
  localStorage.setItem(STORAGE_KEY, url);
}

/**
 * Reset to default server URL
 */
export function resetServerUrl() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Check if using custom (non-localhost) server
 * @returns {boolean}
 */
export function isUsingRemoteServer() {
  const url = getServerUrl();
  return !url.includes('localhost') && !url.includes('127.0.0.1');
}
