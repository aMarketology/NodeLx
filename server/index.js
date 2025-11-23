const express = require('express');
const http = require('http');
const path = require('path');
const ContentStore = require('./contentStore');
const WebSocketServer = require('./websocket');
const SourceMapper = require('./sourceMap');

/**
 * NodeLx Development Server
 * Provides content management, live preview, and source mapping
 */
class NodeLxServer {
  constructor(options = {}) {
    this.port = options.port || 3000;
    this.app = express();
    this.server = http.createServer(this.app);

    // Initialize core systems
    this.contentStore = new ContentStore('./content');
    this.wsServer = new WebSocketServer(this.server);
    this.sourceMapper = new SourceMapper('./client/components');
  }

  async initialize() {
    // Middleware
    this.app.use(express.json());
    this.app.use(express.static('public'));

    // Initialize content store
    await this.contentStore.initialize();

    // Subscribe to content changes and notify WebSocket clients
    this.contentStore.subscribe((event) => {
      this.wsServer.notifyContentChange(event);
    });

    // Initialize source mapper
    await this.sourceMapper.parseAllFiles();

    // Setup routes
    this.setupRoutes();

    return this;
  }

  setupRoutes() {
    // Health check
    this.app.get('/api/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // Get all content
    this.app.get('/api/content', (req, res) => {
      const content = this.contentStore.getAllContent();
      res.json(content);
    });

    // Get content by page ID
    this.app.get('/api/content/:pageId', (req, res) => {
      const { pageId } = req.params;
      const content = this.contentStore.getContent(pageId);

      if (!content) {
        return res.status(404).json({ error: 'Page not found' });
      }

      res.json(content);
    });

    // Update content
    this.app.patch('/api/content/:pageId', async (req, res) => {
      try {
        const { pageId } = req.params;
        const updates = req.body;

        const updated = await this.contentStore.updateContent(pageId, updates);
        res.json(updated);
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });

    // Get source map for a file
    this.app.get('/api/sourcemap/:filename', async (req, res) => {
      const { filename } = req.params;
      const elements = this.sourceMapper.getElementsForFile(filename);
      res.json({ filename, elements });
    });

    // Find element at cursor position
    this.app.post('/api/sourcemap/find-element', (req, res) => {
      const { filename, line, column } = req.body;
      const element = this.sourceMapper.findElementAtPosition(filename, line, column);

      if (!element) {
        return res.status(404).json({ error: 'No element found at position' });
      }

      res.json(element);
    });

    // Get full source map (debug endpoint)
    this.app.get('/api/sourcemap', (req, res) => {
      const sourceMap = this.sourceMapper.getSourceMap();
      res.json(sourceMap);
    });

    // Reparse a specific component file
    this.app.post('/api/sourcemap/reparse/:filename', async (req, res) => {
      const { filename } = req.params;
      const elements = await this.sourceMapper.parseFile(filename);
      res.json({ filename, elements });
    });
  }

  start() {
    this.server.listen(this.port, () => {
      console.log('\n=================================');
      console.log('🚀 NodeLx Development Server');
      console.log('=================================');
      console.log(`Server running at: http://localhost:${this.port}`);
      console.log(`Content Store: ${this.contentStore.store.size} pages loaded`);
      console.log(`Source Mapper: ${this.sourceMapper.sourceMap.size} components mapped`);
      console.log('=================================\n');
    });
  }

  async stop() {
    await this.contentStore.destroy();
    this.server.close();
  }
}

// Start server if run directly
if (require.main === module) {
  const server = new NodeLxServer({ port: 3000 });

  server
    .initialize()
    .then(() => server.start())
    .catch(error => {
      console.error('Failed to start server:', error);
      process.exit(1);
    });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully...');
    await server.stop();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('\nSIGINT received, shutting down gracefully...');
    await server.stop();
    process.exit(0);
  });
}

module.exports = NodeLxServer;
