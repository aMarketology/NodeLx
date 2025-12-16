/**
 * AST Module - Main Entry Point
 * 
 * This module provides a clean API for AST manipulation.
 * All operations are performed on in-memory AST, then converted back to code.
 * 
 * Usage:
 *   const ast = require('./ast');
 *   
 *   // Parse a file
 *   const { ast: tree, code } = await ast.parseFile('/path/to/file.jsx');
 *   
 *   // Modify the AST
 *   ast.insert.after(tree, 'heroTitle', 'button', { text: 'Click me' });
 *   ast.update.text(tree, 'heroTitle', 'New Title');
 *   ast.remove.element(tree, 'oldElement');
 *   
 *   // Generate code
 *   const newCode = ast.generate(tree);
 */

const fs = require('fs').promises;
const path = require('path');

// Core modules
const parser = require('./parser');
const generator = require('./generator');

// Operations
const insertOps = require('./operations/insert');
const removeOps = require('./operations/remove');
const updateOps = require('./operations/update');
const moveOps = require('./operations/move');
const styleOps = require('./operations/style');

// Utilities
const findElement = require('./utils/findElement');
const templates = require('./utils/templates');

/**
 * High-level API for file-based operations
 * These methods handle the full workflow: read -> parse -> modify -> generate -> write
 */
class ASTManager {
  /**
   * Process a file with a modification function
   * @param {string} filePath - Path to the file
   * @param {Function} modifyFn - Function that receives AST and returns { success, ast, message }
   * @returns {Promise<{success: boolean, code?: string, message: string}>}
   */
  async processFile(filePath, modifyFn) {
    try {
      // Read and parse
      const { ast, code: originalCode } = await parser.parseFile(filePath);
      
      // Apply modification
      const result = modifyFn(ast);
      
      if (!result.success) {
        return result;
      }
      
      // Generate new code
      const newCode = generator.generateCode(result.ast);
      
      return {
        success: true,
        code: newCode,
        originalCode,
        message: result.message
      };
    } catch (error) {
      return {
        success: false,
        message: `Error processing file: ${error.message}`
      };
    }
  }

  /**
   * Process and write changes back to file
   * @param {string} filePath - Path to the file
   * @param {Function} modifyFn - Modification function
   * @param {boolean} createBackup - Whether to create backup
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async processAndWrite(filePath, modifyFn, createBackup = true) {
    const result = await this.processFile(filePath, modifyFn);
    
    if (!result.success) {
      return result;
    }
    
    try {
      // Create backup
      if (createBackup) {
        const backupPath = `${filePath}.bak`;
        await fs.writeFile(backupPath, result.originalCode, 'utf-8');
      }
      
      // Write new code
      await fs.writeFile(filePath, result.code, 'utf-8');
      
      return {
        success: true,
        message: result.message,
        code: result.code
      };
    } catch (error) {
      return {
        success: false,
        message: `Error writing file: ${error.message}`
      };
    }
  }

  // ==========================================
  // Convenience Methods (File-based)
  // ==========================================

  /**
   * Insert an element after another element in a file
   */
  async insertAfter(filePath, targetId, element, options = {}) {
    return this.processAndWrite(filePath, (ast) => 
      insertOps.insertAfter(ast, targetId, element, options)
    );
  }

  /**
   * Insert an element before another element in a file
   */
  async insertBefore(filePath, targetId, element, options = {}) {
    return this.processAndWrite(filePath, (ast) => 
      insertOps.insertBefore(ast, targetId, element, options)
    );
  }

  /**
   * Remove an element from a file
   */
  async removeElement(filePath, targetId, options = {}) {
    return this.processAndWrite(filePath, (ast) => 
      removeOps.removeElement(ast, targetId, options)
    );
  }

  /**
   * Update text content in a file
   */
  async updateText(filePath, targetId, newText) {
    return this.processAndWrite(filePath, (ast) => 
      updateOps.updateText(ast, targetId, newText)
    );
  }

  /**
   * Update an attribute in a file
   */
  async updateAttribute(filePath, targetId, attrName, attrValue) {
    return this.processAndWrite(filePath, (ast) => 
      updateOps.updateAttribute(ast, targetId, attrName, attrValue)
    );
  }

  /**
   * Move an element up in a file
   */
  async moveUp(filePath, targetId) {
    return this.processAndWrite(filePath, (ast) => 
      moveOps.moveUp(ast, targetId)
    );
  }

  /**
   * Move an element down in a file
   */
  async moveDown(filePath, targetId) {
    return this.processAndWrite(filePath, (ast) => 
      moveOps.moveDown(ast, targetId)
    );
  }

  /**
   * Update element spacing (margin/padding)
   */
  async updateSpacing(filePath, targetId, spacingType, value) {
    return this.processAndWrite(filePath, (ast) => 
      styleOps.updateSpacing(ast, targetId, spacingType, value)
    );
  }

  /**
   * Update element inline styles
   */
  async updateStyle(filePath, targetId, styles) {
    return this.processAndWrite(filePath, (ast) => 
      styleOps.updateStyle(ast, targetId, styles)
    );
  }

  /**
   * Get element styles
   */
  async getStyles(filePath, targetId) {
    try {
      const { ast } = await parser.parseFile(filePath);
      return styleOps.getStyles(ast, targetId);
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
   * Add CSS class to element
   */
  async addClassName(filePath, targetId, className) {
    return this.processAndWrite(filePath, (ast) => 
      styleOps.addClassName(ast, targetId, className)
    );
  }

  /**
   * Remove CSS class from element
   */
  async removeClassName(filePath, targetId, className) {
    return this.processAndWrite(filePath, (ast) => 
      styleOps.removeClassName(ast, targetId, className)
    );
  }

  /**
   * Find all editable elements in a file
   */
  async findAllEditable(filePath) {
    try {
      const { ast } = await parser.parseFile(filePath);
      const elements = findElement.findAllEditableElements(ast);
      
      return {
        success: true,
        elements: elements.map(el => ({
          id: el.id,
          tagName: el.tagName,
          location: el.location
        }))
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        elements: []
      };
    }
  }
}

// Create singleton instance
const manager = new ASTManager();

// Export everything
module.exports = {
  // High-level manager for file operations
  manager,
  
  // Core functions
  parse: parser.parseCode,
  parseFile: parser.parseFile,
  generate: generator.generateCode,
  generateWithSourceMap: generator.generateWithSourceMap,
  
  // Operations (for in-memory AST manipulation)
  insert: {
    after: insertOps.insertAfter,
    before: insertOps.insertBefore,
    asFirstChild: insertOps.insertAsFirstChild,
    asLastChild: insertOps.insertAsLastChild,
    atRoot: insertOps.insertAtRoot
  },
  
  remove: {
    element: removeOps.removeElement,
    multiple: removeOps.removeMultiple,
    clearChildren: removeOps.clearChildren
  },
  
  update: {
    text: updateOps.updateText,
    attribute: updateOps.updateAttribute,
    attributes: updateOps.updateAttributes,
    tagName: updateOps.updateTagName,
    children: updateOps.replaceChildren
  },
  
  move: {
    up: moveOps.moveUp,
    down: moveOps.moveDown,
    toIndex: moveOps.moveToIndex,
    into: moveOps.moveInto,
    swap: moveOps.swap
  },
  
  style: {
    updateSpacing: styleOps.updateSpacing,
    updateStyle: styleOps.updateStyle,
    getStyles: styleOps.getStyles,
    addClassName: styleOps.addClassName,
    removeClassName: styleOps.removeClassName
  },
  
  // Utilities
  find: {
    byEditableId: findElement.findByEditableId,
    allEditable: findElement.findAllEditableElements,
    byTagName: findElement.findByTagName,
    componentReturn: findElement.findComponentReturn
  },
  
  templates: {
    get: templates.getTemplate,
    list: templates.listTemplates,
    parse: templates.parseJSX,
    create: templates.createElement
  }
};
