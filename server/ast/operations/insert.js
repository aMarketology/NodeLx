/**
 * Insert Operation - Add new JSX elements to the AST
 */

const t = require('@babel/types');
const { findByEditableId, findComponentReturn } = require('../utils/findElement');
const { parseJSX, getTemplate } = require('../utils/templates');

/**
 * Insert a new element after a target element
 * @param {Object} ast - Babel AST
 * @param {string} targetId - data-editable ID of the target element
 * @param {Object|string} newElement - JSX element node or template name
 * @param {Object} options - Insert options
 * @returns {Object} - { success, ast, message }
 */
function insertAfter(ast, targetId, newElement, options = {}) {
  const target = findByEditableId(ast, targetId);
  
  if (!target) {
    return {
      success: false,
      ast,
      message: `Element with data-editable="${targetId}" not found`
    };
  }

  // Get or create the element to insert
  const elementToInsert = resolveElement(newElement, options);
  
  if (!elementToInsert) {
    return {
      success: false,
      ast,
      message: 'Invalid element to insert'
    };
  }

  // Find the parent's children array
  const parent = target.path.parent;
  
  if (parent.children && Array.isArray(parent.children)) {
    const index = parent.children.indexOf(target.node);
    
    // Insert after the target (add whitespace for formatting)
    parent.children.splice(
      index + 1, 
      0, 
      t.jsxText('\n      '),  // Newline and indentation
      elementToInsert
    );
    
    return {
      success: true,
      ast,
      message: `Element inserted after "${targetId}"`
    };
  }

  return {
    success: false,
    ast,
    message: 'Could not find insertion point'
  };
}

/**
 * Insert a new element before a target element
 * @param {Object} ast - Babel AST
 * @param {string} targetId - data-editable ID of the target element
 * @param {Object|string} newElement - JSX element node or template name
 * @param {Object} options - Insert options
 * @returns {Object} - { success, ast, message }
 */
function insertBefore(ast, targetId, newElement, options = {}) {
  const target = findByEditableId(ast, targetId);
  
  if (!target) {
    return {
      success: false,
      ast,
      message: `Element with data-editable="${targetId}" not found`
    };
  }

  const elementToInsert = resolveElement(newElement, options);
  
  if (!elementToInsert) {
    return {
      success: false,
      ast,
      message: 'Invalid element to insert'
    };
  }

  const parent = target.path.parent;
  
  if (parent.children && Array.isArray(parent.children)) {
    const index = parent.children.indexOf(target.node);
    
    // Insert before the target
    parent.children.splice(
      index, 
      0, 
      elementToInsert,
      t.jsxText('\n      ')
    );
    
    return {
      success: true,
      ast,
      message: `Element inserted before "${targetId}"`
    };
  }

  return {
    success: false,
    ast,
    message: 'Could not find insertion point'
  };
}

/**
 * Insert a new element as the first child of a target element
 * @param {Object} ast - Babel AST
 * @param {string} targetId - data-editable ID of the parent element
 * @param {Object|string} newElement - JSX element node or template name
 * @param {Object} options - Insert options
 * @returns {Object} - { success, ast, message }
 */
function insertAsFirstChild(ast, targetId, newElement, options = {}) {
  const target = findByEditableId(ast, targetId);
  
  if (!target) {
    return {
      success: false,
      ast,
      message: `Element with data-editable="${targetId}" not found`
    };
  }

  const elementToInsert = resolveElement(newElement, options);
  
  if (!elementToInsert) {
    return {
      success: false,
      ast,
      message: 'Invalid element to insert'
    };
  }

  // Make sure target has children array
  if (!target.node.children) {
    target.node.children = [];
  }

  // Insert at the beginning
  target.node.children.unshift(
    t.jsxText('\n        '),
    elementToInsert
  );

  // Make sure it's not self-closing anymore
  target.node.openingElement.selfClosing = false;
  if (!target.node.closingElement) {
    const tagName = target.node.openingElement.name.name;
    target.node.closingElement = t.jsxClosingElement(t.jsxIdentifier(tagName));
  }

  return {
    success: true,
    ast,
    message: `Element inserted as first child of "${targetId}"`
  };
}

/**
 * Insert a new element as the last child of a target element
 * @param {Object} ast - Babel AST
 * @param {string} targetId - data-editable ID of the parent element
 * @param {Object|string} newElement - JSX element node or template name
 * @param {Object} options - Insert options
 * @returns {Object} - { success, ast, message }
 */
function insertAsLastChild(ast, targetId, newElement, options = {}) {
  const target = findByEditableId(ast, targetId);
  
  if (!target) {
    return {
      success: false,
      ast,
      message: `Element with data-editable="${targetId}" not found`
    };
  }

  const elementToInsert = resolveElement(newElement, options);
  
  if (!elementToInsert) {
    return {
      success: false,
      ast,
      message: 'Invalid element to insert'
    };
  }

  if (!target.node.children) {
    target.node.children = [];
  }

  // Insert at the end
  target.node.children.push(
    t.jsxText('\n        '),
    elementToInsert,
    t.jsxText('\n      ')
  );

  // Make sure it's not self-closing
  target.node.openingElement.selfClosing = false;
  if (!target.node.closingElement) {
    const tagName = target.node.openingElement.name.name;
    target.node.closingElement = t.jsxClosingElement(t.jsxIdentifier(tagName));
  }

  return {
    success: true,
    ast,
    message: `Element inserted as last child of "${targetId}"`
  };
}

/**
 * Insert element at the root level of a component
 * @param {Object} ast - Babel AST
 * @param {Object|string} newElement - JSX element node or template name
 * @param {Object} options - { position: 'first' | 'last', componentName }
 * @returns {Object} - { success, ast, message }
 */
function insertAtRoot(ast, newElement, options = {}) {
  const { position = 'last', componentName } = options;
  
  const componentReturn = findComponentReturn(ast, componentName);
  
  if (!componentReturn) {
    return {
      success: false,
      ast,
      message: 'Could not find component return statement'
    };
  }

  const elementToInsert = resolveElement(newElement, options);
  
  if (!elementToInsert) {
    return {
      success: false,
      ast,
      message: 'Invalid element to insert'
    };
  }

  const rootElement = componentReturn.node;
  
  if (!rootElement.children) {
    rootElement.children = [];
  }

  if (position === 'first') {
    rootElement.children.unshift(
      t.jsxText('\n      '),
      elementToInsert
    );
  } else {
    rootElement.children.push(
      t.jsxText('\n      '),
      elementToInsert,
      t.jsxText('\n    ')
    );
  }

  return {
    success: true,
    ast,
    message: `Element inserted at ${position} of component root`
  };
}

// ============================================
// Helper Functions
// ============================================

/**
 * Resolve element from template name or JSX node
 */
function resolveElement(element, options = {}) {
  // If it's already an AST node, return it
  if (element && typeof element === 'object' && element.type) {
    return element;
  }
  
  // If it's a string, try to parse as template or JSX
  if (typeof element === 'string') {
    // Check if it's a template name
    try {
      return getTemplate(element, options);
    } catch {
      // Not a template, try to parse as raw JSX
      try {
        return parseJSX(element);
      } catch {
        return null;
      }
    }
  }
  
  return null;
}

module.exports = {
  insertAfter,
  insertBefore,
  insertAsFirstChild,
  insertAsLastChild,
  insertAtRoot
};
