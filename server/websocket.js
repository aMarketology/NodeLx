const WebSocket = require('ws');

/**
 * WebSocket server for real-time communication
 * Handles live preview updates, content changes, and cursor tracking
 */
class WebSocketServer {
  constructor(server) {
    this.wss = new WebSocket.Server({ server });
    this.clients = new Set();
    this.setupHandlers();
  }

  setupHandlers() {
    this.wss.on('connection', (ws) => {
      console.log('[WebSocket] Client connected');
      this.clients.add(ws);

      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message);
          this.handleMessage(ws, data);
        } catch (error) {
          console.error('[WebSocket] Error parsing message:', error);
        }
      });

      ws.on('close', () => {
        console.log('[WebSocket] Client disconnected');
        this.clients.delete(ws);
      });

      ws.on('error', (error) => {
        console.error('[WebSocket] Error:', error);
      });

      // Send initial connection success
      this.send(ws, { type: 'connected' });
    });
  }

  handleMessage(ws, data) {
    console.log('[WebSocket] Received:', data.type);

    switch (data.type) {
      case 'cursor-position':
        // Broadcast cursor position to all clients
        this.broadcast({
          type: 'highlight-element',
          elementId: data.elementId,
          line: data.line,
          column: data.column
        }, ws);
        break;

      case 'content-update':
        // Broadcast content updates to all clients
        this.broadcast({
          type: 'content-changed',
          pageId: data.pageId,
          updates: data.updates
        });
        break;

      case 'ping':
        this.send(ws, { type: 'pong' });
        break;

      default:
        console.log('[WebSocket] Unknown message type:', data.type);
    }
  }

  /**
   * Send message to specific client
   */
  send(ws, data) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }

  /**
   * Broadcast to all clients except sender
   */
  broadcast(data, excludeClient = null) {
    this.clients.forEach(client => {
      if (client !== excludeClient && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  }

  /**
   * Broadcast to all clients including sender
   */
  broadcastToAll(data) {
    this.broadcast(data, null);
  }

  /**
   * Notify all clients of content change
   */
  notifyContentChange(event) {
    this.broadcastToAll({
      type: 'content-store-update',
      event
    });
  }

  /**
   * Notify all clients to reload
   */
  notifyReload() {
    this.broadcastToAll({ type: 'reload' });
  }
}

module.exports = WebSocketServer;
