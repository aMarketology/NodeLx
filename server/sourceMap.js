const fs = require('fs').promises;
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

/**
 * Source mapping system to track JSX code positions to DOM elements
 * This enables the cursor-to-preview highlighting feature
 */
class SourceMapper {
  constructor(componentsDir = './client/components') {
    this.componentsDir = path.resolve(componentsDir);
    this.sourceMap = new Map(); // filename -> AST and positions
  }

  /**
   * Parse a JSX/TSX file and build a source map
   */
  async parseFile(filename) {
    const filePath = path.join(this.componentsDir, filename);

    try {
      const code = await fs.readFile(filePath, 'utf-8');
      const ast = parser.parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript']
      });

      const elements = [];

      // Traverse the AST to find JSX elements with data-editable
      traverse(ast, {
        JSXElement(path) {
          const openingElement = path.node.openingElement;
          const attributes = openingElement.attributes;

          // Look for data-editable attribute
          const editableAttr = attributes.find(
            attr =>
              attr.type === 'JSXAttribute' &&
              attr.name &&
              attr.name.name === 'data-editable'
          );

          if (editableAttr) {
            const elementId = editableAttr.value?.value;

            elements.push({
              elementId,
              start: {
                line: path.node.loc.start.line,
                column: path.node.loc.start.column
              },
              end: {
                line: path.node.loc.end.line,
                column: path.node.loc.end.column
              },
              tagName: openingElement.name.name
            });
          }
        }
      });

      // Store the mapping
      this.sourceMap.set(filename, {
        code,
        elements
      });

      console.log(`[SourceMapper] Mapped ${elements.length} elements in ${filename}`);

      return elements;
    } catch (error) {
      console.error(`[SourceMapper] Error parsing ${filename}:`, error);
      return [];
    }
  }

  /**
   * Parse all component files in the directory
   */
  async parseAllFiles() {
    try {
      const files = await fs.readdir(this.componentsDir);

      for (const file of files) {
        if (file.endsWith('.jsx') || file.endsWith('.tsx')) {
          await this.parseFile(file);
        }
      }

      console.log(`[SourceMapper] Parsed ${this.sourceMap.size} component files`);
    } catch (error) {
      console.error('[SourceMapper] Error parsing files:', error);
    }
  }

  /**
   * Find element at a specific cursor position
   */
  findElementAtPosition(filename, line, column) {
    const mapping = this.sourceMap.get(filename);

    if (!mapping) {
      return null;
    }

    // Find element that contains this position
    for (const element of mapping.elements) {
      const afterStart =
        line > element.start.line ||
        (line === element.start.line && column >= element.start.column);

      const beforeEnd =
        line < element.end.line ||
        (line === element.end.line && column <= element.end.column);

      if (afterStart && beforeEnd) {
        return element;
      }
    }

    return null;
  }

  /**
   * Get all mapped elements for a file
   */
  getElementsForFile(filename) {
    const mapping = this.sourceMap.get(filename);
    return mapping ? mapping.elements : [];
  }

  /**
   * Get the source map for debugging
   */
  getSourceMap() {
    const result = {};

    this.sourceMap.forEach((value, key) => {
      result[key] = {
        elementCount: value.elements.length,
        elements: value.elements
      };
    });

    return result;
  }
}

module.exports = SourceMapper;
