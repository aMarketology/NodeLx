const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const ContentStore = require('./contentStore');
const WebSocketServer = require('./websocket');
const SourceMapper = require('./sourceMap');
const CodeEditor = require('./codeEditor');
const ast = require('./ast');
const themeManager = require('./themeManager');

/**
 * NodeLx Development Server
 * Provides content management, live preview, source mapping, and code editing
 */
class NodeLxServer {
  constructor(options = {}) {
    this.port = options.port || 3001;
    this.app = express();
    this.server = http.createServer(this.app);

    // Initialize core systems
    this.contentStore = new ContentStore('./content');
    this.wsServer = new WebSocketServer(this.server);
    this.sourceMapper = new SourceMapper('./client/components');
    this.codeEditor = new CodeEditor(); // Will be configured per-request
  }

  async initialize() {
    // Middleware
    this.app.use(cors({
      origin: ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:5174'],
      credentials: true
    }));
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

    // ========================================
    // FILE SYSTEM API (Developer Mode)
    // ========================================

    // Set project path for code editing
    this.app.post('/api/project/set-path', (req, res) => {
      try {
        const { projectPath } = req.body;
        
        if (!projectPath) {
          return res.status(400).json({ error: 'projectPath is required' });
        }

        this.codeEditor.setProjectPath(projectPath);
        res.json({ 
          success: true, 
          projectPath: this.codeEditor.projectPath 
        });
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });

    // Get current project path
    this.app.get('/api/project/path', (req, res) => {
      res.json({ 
        projectPath: this.codeEditor.projectPath 
      });
    });

    // Get file tree structure
    this.app.get('/api/files/tree', async (req, res) => {
      try {
        const tree = await this.codeEditor.getFileTree();
        res.json(tree);
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });

    // List files in a directory
    this.app.get('/api/files/list', async (req, res) => {
      try {
        const { path: dirPath = '', recursive = 'true' } = req.query;
        const files = await this.codeEditor.listFiles(dirPath, recursive === 'true');
        res.json({ files });
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });

    // Read a file
    this.app.get('/api/files/read', async (req, res) => {
      try {
        const filePath = req.query.path;
        
        if (!filePath) {
          return res.status(400).json({ error: 'File path is required (use ?path=...)' });
        }

        const file = await this.codeEditor.readFile(filePath);
        res.json(file);
      } catch (error) {
        if (error.message.includes('not found')) {
          return res.status(404).json({ error: error.message });
        }
        res.status(400).json({ error: error.message });
      }
    });

    // Write/Update a file
    this.app.put('/api/files/write', async (req, res) => {
      try {
        const { path: filePath, content, createBackup = true } = req.body;
        
        if (!filePath) {
          return res.status(400).json({ error: 'File path is required' });
        }
        
        if (content === undefined) {
          return res.status(400).json({ error: 'content is required' });
        }

        const result = await this.codeEditor.writeFile(filePath, content, createBackup);
        
        // Notify WebSocket clients of file change
        this.wsServer.broadcast({
          type: 'file-changed',
          path: filePath,
          timestamp: new Date().toISOString()
        });

        res.json(result);
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });

    // Create a new file
    this.app.post('/api/files/create', async (req, res) => {
      try {
        const { path: filePath, content = '' } = req.body;
        
        if (!filePath) {
          return res.status(400).json({ error: 'File path is required' });
        }

        const result = await this.codeEditor.createFile(filePath, content);
        
        // Notify WebSocket clients
        this.wsServer.broadcast({
          type: 'file-created',
          path: filePath,
          timestamp: new Date().toISOString()
        });

        res.json(result);
      } catch (error) {
        if (error.message.includes('already exists')) {
          return res.status(409).json({ error: error.message });
        }
        res.status(400).json({ error: error.message });
      }
    });

    // Delete a file
    this.app.delete('/api/files/delete', async (req, res) => {
      try {
        const { path: filePath } = req.body;
        
        if (!filePath) {
          return res.status(400).json({ error: 'File path is required' });
        }

        const result = await this.codeEditor.deleteFile(filePath);
        
        // Notify WebSocket clients
        this.wsServer.broadcast({
          type: 'file-deleted',
          path: filePath,
          timestamp: new Date().toISOString()
        });

        res.json(result);
      } catch (error) {
        if (error.message.includes('not found')) {
          return res.status(404).json({ error: error.message });
        }
        res.status(400).json({ error: error.message });
      }
    });

    // Rename/move a file
    this.app.patch('/api/files/rename', async (req, res) => {
      try {
        const { oldPath, newPath } = req.body;
        
        if (!oldPath || !newPath) {
          return res.status(400).json({ error: 'oldPath and newPath are required' });
        }

        const result = await this.codeEditor.renameFile(oldPath, newPath);
        
        // Notify WebSocket clients
        this.wsServer.broadcast({
          type: 'file-renamed',
          oldPath,
          newPath,
          timestamp: new Date().toISOString()
        });

        res.json(result);
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });

    // ========================================
    // AST API (Code Manipulation)
    // ========================================

    // Get all editable elements in a file
    this.app.get('/api/ast/editable', async (req, res) => {
      try {
        const filePath = req.query.path;
        
        if (!filePath) {
          return res.status(400).json({ error: 'File path is required (use ?path=...)' });
        }
        
        const fullPath = path.resolve(this.codeEditor.projectPath, filePath);
        
        const result = await ast.manager.findAllEditable(fullPath);
        res.json(result);
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });

    // List available element templates
    this.app.get('/api/ast/templates', (req, res) => {
      res.json({
        templates: ast.templates.list()
      });
    });

    // Insert element after target
    this.app.post('/api/ast/insert/after', async (req, res) => {
      try {
        const { filePath, targetId, element, options = {} } = req.body;
        
        if (!filePath || !targetId || !element) {
          return res.status(400).json({ 
            error: 'filePath, targetId, and element are required' 
          });
        }

        const fullPath = path.resolve(this.codeEditor.projectPath, filePath);
        const result = await ast.manager.insertAfter(fullPath, targetId, element, options);
        
        if (result.success) {
          this.wsServer.broadcast({
            type: 'ast-modified',
            operation: 'insert',
            filePath,
            targetId,
            timestamp: new Date().toISOString()
          });
        }
        
        res.json(result);
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });

    // Insert element before target
    this.app.post('/api/ast/insert/before', async (req, res) => {
      try {
        const { filePath, targetId, element, options = {} } = req.body;
        
        if (!filePath || !targetId || !element) {
          return res.status(400).json({ 
            error: 'filePath, targetId, and element are required' 
          });
        }

        const fullPath = path.resolve(this.codeEditor.projectPath, filePath);
        const result = await ast.manager.insertBefore(fullPath, targetId, element, options);
        
        if (result.success) {
          this.wsServer.broadcast({
            type: 'ast-modified',
            operation: 'insert',
            filePath,
            targetId,
            timestamp: new Date().toISOString()
          });
        }
        
        res.json(result);
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });

    // Remove element
    this.app.delete('/api/ast/element', async (req, res) => {
      try {
        const { filePath, targetId, options = {} } = req.body;
        
        if (!filePath || !targetId) {
          return res.status(400).json({ 
            error: 'filePath and targetId are required' 
          });
        }

        const fullPath = path.resolve(this.codeEditor.projectPath, filePath);
        const result = await ast.manager.removeElement(fullPath, targetId, options);
        
        if (result.success) {
          this.wsServer.broadcast({
            type: 'ast-modified',
            operation: 'remove',
            filePath,
            targetId,
            timestamp: new Date().toISOString()
          });
        }
        
        res.json(result);
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });

    // Update element text
    this.app.patch('/api/ast/text', async (req, res) => {
      try {
        const { filePath, targetId, text } = req.body;
        
        if (!filePath || !targetId || text === undefined) {
          return res.status(400).json({ 
            error: 'filePath, targetId, and text are required' 
          });
        }

        const fullPath = path.resolve(this.codeEditor.projectPath, filePath);
        const result = await ast.manager.updateText(fullPath, targetId, text);
        
        if (result.success) {
          this.wsServer.broadcast({
            type: 'ast-modified',
            operation: 'update-text',
            filePath,
            targetId,
            timestamp: new Date().toISOString()
          });
        }
        
        res.json(result);
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });

    // Update element attribute
    this.app.patch('/api/ast/attribute', async (req, res) => {
      try {
        const { filePath, targetId, attribute, value } = req.body;
        
        if (!filePath || !targetId || !attribute) {
          return res.status(400).json({ 
            error: 'filePath, targetId, and attribute are required' 
          });
        }

        const fullPath = path.resolve(this.codeEditor.projectPath, filePath);
        const result = await ast.manager.updateAttribute(fullPath, targetId, attribute, value);
        
        if (result.success) {
          this.wsServer.broadcast({
            type: 'ast-modified',
            operation: 'update-attribute',
            filePath,
            targetId,
            timestamp: new Date().toISOString()
          });
        }
        
        res.json(result);
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });

    // Move element up
    this.app.post('/api/ast/move/up', async (req, res) => {
      try {
        const { filePath, targetId } = req.body;
        
        if (!filePath || !targetId) {
          return res.status(400).json({ 
            error: 'filePath and targetId are required' 
          });
        }

        const fullPath = path.resolve(this.codeEditor.projectPath, filePath);
        const result = await ast.manager.moveUp(fullPath, targetId);
        
        if (result.success) {
          this.wsServer.broadcast({
            type: 'ast-modified',
            operation: 'move',
            filePath,
            targetId,
            timestamp: new Date().toISOString()
          });
        }
        
        res.json(result);
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });

    // Move element down
    this.app.post('/api/ast/move/down', async (req, res) => {
      try {
        const { filePath, targetId } = req.body;
        
        if (!filePath || !targetId) {
          return res.status(400).json({ 
            error: 'filePath and targetId are required' 
          });
        }

        const fullPath = path.resolve(this.codeEditor.projectPath, filePath);
        const result = await ast.manager.moveDown(fullPath, targetId);
        
        if (result.success) {
          this.wsServer.broadcast({
            type: 'ast-modified',
            operation: 'move',
            filePath,
            targetId,
            timestamp: new Date().toISOString()
          });
        }
        
        res.json(result);
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });

    // ========================================
    // STYLE API (Element Styling)
    // ========================================

    // Update element spacing (margin/padding)
    this.app.patch('/api/ast/spacing', async (req, res) => {
      try {
        const { filePath, targetId, spacingType, value } = req.body;
        
        if (!filePath || !targetId || !spacingType) {
          return res.status(400).json({ 
            error: 'filePath, targetId, and spacingType are required' 
          });
        }

        const fullPath = path.resolve(this.codeEditor.projectPath, filePath);
        const result = await ast.manager.updateSpacing(fullPath, targetId, spacingType, value);
        
        if (result.success) {
          this.wsServer.broadcast({
            type: 'ast-modified',
            operation: 'update-spacing',
            filePath,
            targetId,
            timestamp: new Date().toISOString()
          });
        }
        
        res.json(result);
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });

    // Update element inline styles
    this.app.patch('/api/ast/style', async (req, res) => {
      try {
        const { filePath, targetId, styles } = req.body;
        
        if (!filePath || !targetId || !styles) {
          return res.status(400).json({ 
            error: 'filePath, targetId, and styles are required' 
          });
        }

        const fullPath = path.resolve(this.codeEditor.projectPath, filePath);
        const result = await ast.manager.updateStyle(fullPath, targetId, styles);
        
        if (result.success) {
          this.wsServer.broadcast({
            type: 'ast-modified',
            operation: 'update-style',
            filePath,
            targetId,
            timestamp: new Date().toISOString()
          });
        }
        
        res.json(result);
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });

    // Get element styles
    this.app.get('/api/ast/style/:targetId', async (req, res) => {
      try {
        const { targetId } = req.params;
        const { filePath } = req.query;
        
        if (!filePath) {
          return res.status(400).json({ error: 'filePath query param is required' });
        }

        const fullPath = path.resolve(this.codeEditor.projectPath, filePath);
        const result = await ast.manager.getStyles(fullPath, targetId);
        
        res.json(result);
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });

    // Add CSS class to element
    this.app.post('/api/ast/class', async (req, res) => {
      try {
        const { filePath, targetId, className } = req.body;
        
        if (!filePath || !targetId || !className) {
          return res.status(400).json({ 
            error: 'filePath, targetId, and className are required' 
          });
        }

        const fullPath = path.resolve(this.codeEditor.projectPath, filePath);
        const result = await ast.manager.addClassName(fullPath, targetId, className);
        
        if (result.success) {
          this.wsServer.broadcast({
            type: 'ast-modified',
            operation: 'add-class',
            filePath,
            targetId,
            timestamp: new Date().toISOString()
          });
        }
        
        res.json(result);
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });

    // Remove CSS class from element
    this.app.delete('/api/ast/class', async (req, res) => {
      try {
        const { filePath, targetId, className } = req.body;
        
        if (!filePath || !targetId || !className) {
          return res.status(400).json({ 
            error: 'filePath, targetId, and className are required' 
          });
        }

        const fullPath = path.resolve(this.codeEditor.projectPath, filePath);
        const result = await ast.manager.removeClassName(fullPath, targetId, className);
        
        if (result.success) {
          this.wsServer.broadcast({
            type: 'ast-modified',
            operation: 'remove-class',
            filePath,
            targetId,
            timestamp: new Date().toISOString()
          });
        }
        
        res.json(result);
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });

    // ========================================
    // THEME API (Global Typography & Styles)
    // ========================================

    // Get full theme
    this.app.get('/api/theme', async (req, res) => {
      try {
        const theme = await themeManager.getTheme();
        res.json(theme);
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });

    // Update entire theme
    this.app.put('/api/theme', async (req, res) => {
      try {
        const theme = await themeManager.updateTheme(req.body);
        
        this.wsServer.broadcast({
          type: 'theme-changed',
          timestamp: new Date().toISOString()
        });
        
        res.json(theme);
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });

    // Get typography settings
    this.app.get('/api/theme/typography', async (req, res) => {
      try {
        const typography = await themeManager.getTypography();
        res.json(typography);
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });

    // Update typography for specific element (h1, h2, p, etc.)
    this.app.patch('/api/theme/typography/:element', async (req, res) => {
      try {
        const { element } = req.params;
        const settings = req.body;
        
        const theme = await themeManager.updateTypography(element, settings);
        
        this.wsServer.broadcast({
          type: 'theme-changed',
          element,
          timestamp: new Date().toISOString()
        });
        
        res.json(theme.typography[element]);
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });

    // Get color palette
    this.app.get('/api/theme/colors', async (req, res) => {
      try {
        const colors = await themeManager.getColors();
        res.json(colors);
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });

    // Update colors
    this.app.patch('/api/theme/colors', async (req, res) => {
      try {
        const theme = await themeManager.updateColors(req.body);
        
        this.wsServer.broadcast({
          type: 'theme-changed',
          timestamp: new Date().toISOString()
        });
        
        res.json(theme.colors);
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });

    // Get generated CSS from theme
    this.app.get('/api/theme/css', async (req, res) => {
      try {
        const css = await themeManager.generateCSS();
        res.type('text/css').send(css);
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });

    // Add Google Font
    this.app.post('/api/theme/fonts', async (req, res) => {
      try {
        const { fontName } = req.body;
        
        if (!fontName) {
          return res.status(400).json({ error: 'fontName is required' });
        }

        const theme = await themeManager.addGoogleFont(fontName);
        
        this.wsServer.broadcast({
          type: 'theme-changed',
          timestamp: new Date().toISOString()
        });
        
        res.json({ googleFonts: theme.googleFonts });
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });

    // Remove Google Font
    this.app.delete('/api/theme/fonts', async (req, res) => {
      try {
        const { fontName } = req.body;
        
        if (!fontName) {
          return res.status(400).json({ error: 'fontName is required' });
        }

        const theme = await themeManager.removeGoogleFont(fontName);
        
        this.wsServer.broadcast({
          type: 'theme-changed',
          timestamp: new Date().toISOString()
        });
        
        res.json({ googleFonts: theme.googleFonts });
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });

    // Get Google Fonts link tags
    this.app.get('/api/theme/fonts/link', async (req, res) => {
      try {
        const link = await themeManager.generateGoogleFontsLink();
        res.json({ link });
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });

    // Get popular font suggestions
    this.app.get('/api/theme/fonts/popular', (req, res) => {
      res.json(themeManager.POPULAR_FONTS);
    });

    // Reset theme to defaults
    this.app.post('/api/theme/reset', async (req, res) => {
      try {
        const theme = await themeManager.resetTheme();
        
        this.wsServer.broadcast({
          type: 'theme-reset',
          timestamp: new Date().toISOString()
        });
        
        res.json(theme);
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });
  }

  start() {
    this.server.listen(this.port, () => {
      console.log('\n==========================================');
      console.log('🚀 NodeLx Development Server');
      console.log('==========================================');
      console.log(`Server running at: http://localhost:${this.port}`);
      console.log(`Content Store: ${this.contentStore.store.size} pages loaded`);
      console.log(`Source Mapper: ${this.sourceMapper.sourceMap.size} components mapped`);
      console.log(`Code Editor: Ready (Developer Mode)`);
      console.log(`AST Parser: Ready`);
      console.log(`Theme Manager: Ready`);
      console.log('==========================================');
      console.log('API Endpoints:');
      console.log('  Content:  GET/PATCH /api/content/:pageId');
      console.log('  Files:    GET/PUT/POST/DELETE /api/files/*');
      console.log('  Tree:     GET /api/files/tree');
      console.log('  AST:      POST /api/ast/insert/after|before');
      console.log('            DELETE /api/ast/element');
      console.log('            PATCH /api/ast/text|attribute|spacing|style');
      console.log('            POST /api/ast/move/up|down');
      console.log('            POST|DELETE /api/ast/class');
      console.log('  Theme:    GET/PUT /api/theme');
      console.log('            GET/PATCH /api/theme/typography/:element');
      console.log('            GET/PATCH /api/theme/colors');
      console.log('            GET /api/theme/css');
      console.log('            POST|DELETE /api/theme/fonts');
      console.log('==========================================\n');
    });
  }

  async stop() {
    await this.contentStore.destroy();
    this.server.close();
  }
}

// Start server if run directly
if (require.main === module) {
  const server = new NodeLxServer({ port: 3001 });

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
