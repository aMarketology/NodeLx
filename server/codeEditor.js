const fs = require('fs').promises;
const path = require('path');

/**
 * CodeEditor - File System Service for Developer Mode
 * Provides safe read/write access to project source files
 */
class CodeEditor {
  constructor(projectPath = null) {
    // Default to parent directory (the user's project)
    this.projectPath = projectPath || process.cwd();
    
    // Allowed file extensions for editing
    this.allowedExtensions = [
      '.js', '.jsx', '.ts', '.tsx',
      '.json', '.css', '.scss', '.sass',
      '.html', '.md', '.mdx',
      '.vue', '.svelte'
    ];
    
    // Directories to exclude from file listing
    this.excludedDirs = [
      'node_modules',
      '.git',
      '.next',
      'dist',
      'build',
      '.cache',
      'coverage'
    ];
  }

  /**
   * Set the project path to edit
   * @param {string} projectPath - Absolute path to the project
   */
  setProjectPath(projectPath) {
    this.projectPath = path.resolve(projectPath);
    console.log(`[CodeEditor] Project path set to: ${this.projectPath}`);
  }

  /**
   * Validate that a path is within the project directory (security)
   * @param {string} filePath - Path to validate
   * @returns {boolean}
   */
  isPathSafe(filePath) {
    const resolvedPath = path.resolve(this.projectPath, filePath);
    return resolvedPath.startsWith(this.projectPath);
  }

  /**
   * Check if file extension is allowed
   * @param {string} filePath - Path to check
   * @returns {boolean}
   */
  isExtensionAllowed(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return this.allowedExtensions.includes(ext);
  }

  /**
   * Read a file's contents
   * @param {string} relativePath - Path relative to project root
   * @returns {Promise<{content: string, path: string, extension: string}>}
   */
  async readFile(relativePath) {
    // Security check
    if (!this.isPathSafe(relativePath)) {
      throw new Error(`Access denied: Path outside project directory`);
    }

    const fullPath = path.resolve(this.projectPath, relativePath);
    
    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      const stats = await fs.stat(fullPath);
      
      return {
        path: relativePath,
        fullPath,
        content,
        extension: path.extname(relativePath),
        size: stats.size,
        modified: stats.mtime,
        created: stats.birthtime
      };
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`File not found: ${relativePath}`);
      }
      throw error;
    }
  }

  /**
   * Write content to a file
   * @param {string} relativePath - Path relative to project root
   * @param {string} content - New file content
   * @param {boolean} createBackup - Whether to create a .bak file
   * @returns {Promise<{success: boolean, path: string, backup?: string}>}
   */
  async writeFile(relativePath, content, createBackup = true) {
    // Security check
    if (!this.isPathSafe(relativePath)) {
      throw new Error(`Access denied: Path outside project directory`);
    }

    // Extension check
    if (!this.isExtensionAllowed(relativePath)) {
      throw new Error(`File type not allowed: ${path.extname(relativePath)}`);
    }

    const fullPath = path.resolve(this.projectPath, relativePath);
    let backupPath = null;

    try {
      // Create backup of existing file
      if (createBackup) {
        try {
          const existingContent = await fs.readFile(fullPath, 'utf-8');
          backupPath = `${fullPath}.bak`;
          await fs.writeFile(backupPath, existingContent, 'utf-8');
        } catch (e) {
          // File doesn't exist yet, no backup needed
        }
      }

      // Ensure directory exists
      const dir = path.dirname(fullPath);
      await fs.mkdir(dir, { recursive: true });

      // Write the file
      await fs.writeFile(fullPath, content, 'utf-8');

      console.log(`[CodeEditor] File written: ${relativePath}`);

      return {
        success: true,
        path: relativePath,
        fullPath,
        backup: backupPath
      };
    } catch (error) {
      console.error(`[CodeEditor] Error writing file: ${error.message}`);
      throw error;
    }
  }

  /**
   * List files in a directory (recursive)
   * @param {string} relativePath - Directory path relative to project root
   * @param {boolean} recursive - Whether to list subdirectories
   * @returns {Promise<Array<{name: string, path: string, type: string, extension?: string}>>}
   */
  async listFiles(relativePath = '', recursive = true) {
    const fullPath = path.resolve(this.projectPath, relativePath);

    // Security check
    if (!this.isPathSafe(relativePath)) {
      throw new Error(`Access denied: Path outside project directory`);
    }

    const results = [];

    try {
      const entries = await fs.readdir(fullPath, { withFileTypes: true });

      for (const entry of entries) {
        // Skip excluded directories
        if (entry.isDirectory() && this.excludedDirs.includes(entry.name)) {
          continue;
        }

        const entryRelativePath = path.join(relativePath, entry.name);

        if (entry.isDirectory()) {
          results.push({
            name: entry.name,
            path: entryRelativePath,
            type: 'directory'
          });

          // Recursively list subdirectory contents
          if (recursive) {
            const subEntries = await this.listFiles(entryRelativePath, true);
            results.push(...subEntries);
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          
          // Only include allowed file types
          if (this.allowedExtensions.includes(ext)) {
            results.push({
              name: entry.name,
              path: entryRelativePath,
              type: 'file',
              extension: ext
            });
          }
        }
      }

      return results;
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Directory not found: ${relativePath}`);
      }
      throw error;
    }
  }

  /**
   * Get file tree structure (hierarchical)
   * @param {string} relativePath - Directory path relative to project root
   * @returns {Promise<Object>} - Nested tree structure
   */
  async getFileTree(relativePath = '') {
    const fullPath = path.resolve(this.projectPath, relativePath);

    if (!this.isPathSafe(relativePath)) {
      throw new Error(`Access denied: Path outside project directory`);
    }

    const buildTree = async (dirPath, relPath) => {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      const children = [];

      for (const entry of entries) {
        // Skip excluded directories
        if (entry.isDirectory() && this.excludedDirs.includes(entry.name)) {
          continue;
        }

        const entryRelPath = path.join(relPath, entry.name);
        const entryFullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          const subTree = await buildTree(entryFullPath, entryRelPath);
          children.push({
            name: entry.name,
            path: entryRelPath,
            type: 'directory',
            children: subTree
          });
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (this.allowedExtensions.includes(ext)) {
            children.push({
              name: entry.name,
              path: entryRelPath,
              type: 'file',
              extension: ext
            });
          }
        }
      }

      // Sort: directories first, then files, alphabetically
      return children.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'directory' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
    };

    try {
      const tree = await buildTree(fullPath, relativePath);
      return {
        name: path.basename(this.projectPath),
        path: '',
        type: 'directory',
        children: tree
      };
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Directory not found: ${relativePath}`);
      }
      throw error;
    }
  }

  /**
   * Check if a file exists
   * @param {string} relativePath - Path relative to project root
   * @returns {Promise<boolean>}
   */
  async fileExists(relativePath) {
    const fullPath = path.resolve(this.projectPath, relativePath);
    try {
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Delete a file (with backup)
   * @param {string} relativePath - Path relative to project root
   * @returns {Promise<{success: boolean, backup: string}>}
   */
  async deleteFile(relativePath) {
    if (!this.isPathSafe(relativePath)) {
      throw new Error(`Access denied: Path outside project directory`);
    }

    const fullPath = path.resolve(this.projectPath, relativePath);

    try {
      // Create backup before deleting
      const content = await fs.readFile(fullPath, 'utf-8');
      const backupPath = `${fullPath}.deleted.bak`;
      await fs.writeFile(backupPath, content, 'utf-8');

      // Delete the file
      await fs.unlink(fullPath);

      console.log(`[CodeEditor] File deleted: ${relativePath} (backup: ${backupPath})`);

      return {
        success: true,
        path: relativePath,
        backup: backupPath
      };
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`File not found: ${relativePath}`);
      }
      throw error;
    }
  }

  /**
   * Create a new file
   * @param {string} relativePath - Path relative to project root
   * @param {string} content - Initial content
   * @returns {Promise<{success: boolean, path: string}>}
   */
  async createFile(relativePath, content = '') {
    if (!this.isPathSafe(relativePath)) {
      throw new Error(`Access denied: Path outside project directory`);
    }

    if (!this.isExtensionAllowed(relativePath)) {
      throw new Error(`File type not allowed: ${path.extname(relativePath)}`);
    }

    const fullPath = path.resolve(this.projectPath, relativePath);

    // Check if file already exists
    if (await this.fileExists(relativePath)) {
      throw new Error(`File already exists: ${relativePath}`);
    }

    // Ensure directory exists
    const dir = path.dirname(fullPath);
    await fs.mkdir(dir, { recursive: true });

    // Create the file
    await fs.writeFile(fullPath, content, 'utf-8');

    console.log(`[CodeEditor] File created: ${relativePath}`);

    return {
      success: true,
      path: relativePath,
      fullPath
    };
  }

  /**
   * Rename/move a file
   * @param {string} oldPath - Current path relative to project root
   * @param {string} newPath - New path relative to project root
   * @returns {Promise<{success: boolean, oldPath: string, newPath: string}>}
   */
  async renameFile(oldPath, newPath) {
    if (!this.isPathSafe(oldPath) || !this.isPathSafe(newPath)) {
      throw new Error(`Access denied: Path outside project directory`);
    }

    const fullOldPath = path.resolve(this.projectPath, oldPath);
    const fullNewPath = path.resolve(this.projectPath, newPath);

    try {
      // Ensure new directory exists
      const dir = path.dirname(fullNewPath);
      await fs.mkdir(dir, { recursive: true });

      // Rename/move the file
      await fs.rename(fullOldPath, fullNewPath);

      console.log(`[CodeEditor] File renamed: ${oldPath} -> ${newPath}`);

      return {
        success: true,
        oldPath,
        newPath
      };
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`File not found: ${oldPath}`);
      }
      throw error;
    }
  }
}

module.exports = CodeEditor;
