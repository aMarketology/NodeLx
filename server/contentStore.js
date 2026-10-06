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
          // Skip dotfiles (e.g. .site-tokens.json) and NodeLx's own config files
          // (sites.json, theme.json, users.json) — only load page content files.
          if (!file.endsWith('.json')) continue;
          if (file.startsWith('.')) continue;
          if (['sites.json', 'theme.json', 'users.json'].includes(file)) continue;
          await this.loadContentFile(file);
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
        ignoreInitial: true,
        ignored: (p) => {
          const name = path.basename(p);
          return name.startsWith('.') || ['sites.json', 'theme.json', 'users.json'].includes(name);
        },
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
     * Creates the page file if it doesn't exist yet (bootstrap for newly
     * onboarded sites whose content file hasn't been committed yet).
       *
       * `updates` may contain dot-notation paths (e.g. "hero.badge",
       * "projects.0.title", "hero.h1_0") matching the client site's
       * data-editable ids. These are applied onto the nested content tree.
       */
      async updateContent(pageId, updates) {
        const existing = this.store.get(pageId);

        let updated;
        if (!existing) {
          updated = {
            pageId,
            content: { ...updates },
            metadata: {
              lastModified: new Date().toISOString(),
              author: 'system',
            },
          };
        } else {
          // Deep-clone existing content so we can apply nested mutations
          const base = JSON.parse(JSON.stringify(existing.content || {}));

          // Apply each update. Dot-notation paths are resolved onto the tree;
          // plain keys are merged at the top level.
          for (const [key, value] of Object.entries(updates)) {
            if (key.includes('.')) {
              applyPath(base, key, value);
            } else {
              base[key] = value;
            }
          }

          updated = {
            ...existing,
            content: base,
            metadata: {
              ...existing.metadata,
              lastModified: new Date().toISOString()
            }
          };
        }

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

  /**
   * Apply a dot-notation path onto a nested object.
   * Handles:
   *   - "hero.badge"       → obj.hero.badge
   *   - "hero.h1_0"        → obj.hero.h1[0]   (h1_N → array index)
   *   - "projects.0.title" → obj.projects[0].title
   *   - "stats.2.val"      → obj.stats[2].val
   */
  function applyPath(obj, path, value) {
    const segments = path.split('.');
    let cursor = obj;

    for (let i = 0; i < segments.length - 1; i++) {
      const seg = segments[i];

      // "h1_0" → array "h1" index 0
      const arrayMatch = /^(.+)_(\d+)$/.exec(seg);
      if (arrayMatch && Array.isArray(cursor[arrayMatch[1]])) {
        cursor = cursor[arrayMatch[1]][Number(arrayMatch[2])];
        continue;
      }

      // numeric segment → array index
      if (/^\d+$/.test(seg) && Array.isArray(cursor)) {
        cursor = cursor[Number(seg)];
        continue;
      }

      cursor = cursor[seg];
      if (cursor === undefined || cursor === null) return;
    }

    const last = segments[segments.length - 1];
    const lastArrayMatch = /^(.+)_(\d+)$/.exec(last);
    if (lastArrayMatch && Array.isArray(cursor[lastArrayMatch[1]])) {
      cursor[lastArrayMatch[1]][Number(lastArrayMatch[2])] = value;
      return;
    }

    cursor[last] = value;
  }

  module.exports = ContentStore;
