const fs = require('fs').promises;
const path = require('path');
const chokidar = require('chokidar');

/**
 * In-memory content store for development
 * Watches content files and keeps them synchronized
 */
class ContentStore {
  constructor(contentDir = './content') {
    this.contentDir = path.resolve(contentDir);
    this.store = new Map();
    this.subscribers = new Set();
    this.watcher = null;
  }

  /**
   * Initialize the content store and start watching
   */
  async initialize() {
    console.log(`[ContentStore] Initializing from ${this.contentDir}`);

    // Load all existing content files
    await this.loadAllContent();

    // Watch for changes
    this.startWatching();

    return this;
  }

  /**
   * Load all JSON content files
   */
  async loadAllContent() {
    try {
      const files = await fs.readdir(this.contentDir);

      for (const file of files) {
        if (file.endsWith('.json')) {
          await this.loadContentFile(file);
        }
      }

      console.log(`[ContentStore] Loaded ${this.store.size} content files`);
    } catch (error) {
      console.error('[ContentStore] Error loading content:', error);
    }
  }

  /**
   * Load a single content file
   */
  async loadContentFile(filename) {
    try {
      const filePath = path.join(this.contentDir, filename);
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      const pageId = data.pageId || filename.replace('.json', '');
      this.store.set(pageId, data);

      console.log(`[ContentStore] Loaded: ${pageId}`);

      // Notify subscribers of content change
      this.notifySubscribers({ type: 'update', pageId, data });
    } catch (error) {
      console.error(`[ContentStore] Error loading ${filename}:`, error);
    }
  }

  /**
   * Watch content directory for changes
   */
  startWatching() {
    this.watcher = chokidar.watch(`${this.contentDir}/*.json`, {
      persistent: true,
      ignoreInitial: true
    });

    this.watcher
      .on('add', (filePath) => {
        const filename = path.basename(filePath);
        console.log(`[ContentStore] File added: ${filename}`);
        this.loadContentFile(filename);
      })
      .on('change', (filePath) => {
        const filename = path.basename(filePath);
        console.log(`[ContentStore] File changed: ${filename}`);
        this.loadContentFile(filename);
      })
      .on('unlink', (filePath) => {
        const filename = path.basename(filePath);
        const pageId = filename.replace('.json', '');
        console.log(`[ContentStore] File removed: ${filename}`);
        this.store.delete(pageId);
        this.notifySubscribers({ type: 'delete', pageId });
      });
  }

  /**
   * Get content by page ID
   */
  getContent(pageId) {
    return this.store.get(pageId);
  }

  /**
   * Get all content
   */
  getAllContent() {
    return Object.fromEntries(this.store);
  }

  /**
   * Update content for a page
   */
  async updateContent(pageId, updates) {
    const existing = this.store.get(pageId);

    if (!existing) {
      throw new Error(`Page ${pageId} not found`);
    }

    // Merge updates with existing content
    const updated = {
      ...existing,
      content: {
        ...existing.content,
        ...updates
      },
      metadata: {
        ...existing.metadata,
        lastModified: new Date().toISOString()
      }
    };

    // Update in-memory store
    this.store.set(pageId, updated);

    // Write to file
    const filename = `${pageId}.json`;
    const filePath = path.join(this.contentDir, filename);
    await fs.writeFile(filePath, JSON.stringify(updated, null, 2));

    console.log(`[ContentStore] Updated: ${pageId}`);

    // Notify subscribers
    this.notifySubscribers({ type: 'update', pageId, data: updated });

    return updated;
  }

  /**
   * Subscribe to content changes
   */
  subscribe(callback) {
    this.subscribers.add(callback);

    // Return unsubscribe function
    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Notify all subscribers of changes
   */
  notifySubscribers(event) {
    this.subscribers.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error('[ContentStore] Error notifying subscriber:', error);
      }
    });
  }

  /**
   * Cleanup resources
   */
  async destroy() {
    if (this.watcher) {
      await this.watcher.close();
    }
    this.store.clear();
    this.subscribers.clear();
  }
}

module.exports = ContentStore;
