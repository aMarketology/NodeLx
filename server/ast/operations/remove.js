/**
 * Remove Operation - Delete JSX elements from the AST
 */

const { findByEditableId } = require('../utils/findElement');

/**
 * Remove an element by its data-editable ID
 * @param {Object} ast - Babel AST
 * @param {string} targetId - data-editable ID of the element to remove
 * @param {Object} options - Remove options
 * @returns {Object} - { success, ast, removedElement, message }
 */
function removeElement(ast, targetId, options = {}) {
  const { preserveChildren = false } = options;
  
  const target = findByEditableId(ast, targetId);
  
  if (!target) {
    return {
      success: false,
      ast,
      removedElement: null,
      message: `Element with data-editable="${targetId}" not found`
    };
  }

  const parent = target.path.parent;
  
  // Check if we can remove from parent's children
  if (parent.children && Array.isArray(parent.children)) {
    const index = parent.children.indexOf(target.node);
    
    if (index === -1) {
      return {
        success: false,
        ast,
        removedElement: null,
        message: 'Element not found in parent children'
      };
    }

    // Store the removed element for undo capability
    const removedElement = target.node;

    if (preserveChildren && target.node.children) {
      // Replace element with its children (unwrap)
      parent.children.splice(index, 1, ...target.node.children);
    } else {
      // Remove the element entirely
      // Also remove adjacent whitespace
      const removeCount = (index > 0 && isWhitespaceNode(parent.children[index - 1])) 
        ? 2 
        : 1;
      const removeStart = removeCount === 2 ? index - 1 : index;
      
      parent.children.splice(removeStart, removeCount);
    }

    return {
      success: true,
      ast,
      removedElement,
      message: `Element "${targetId}" removed successfully`
    };
  }

  // Try using Babel's path.remove()
  try {
    const removedElement = target.node;
    target.path.remove();
    
    return {
      success: true,
      ast,
      removedElement,
      message: `Element "${targetId}" removed successfully`
    };
  } catch (error) {
    return {
      success: false,
      ast,
      removedElement: null,
      message: `Failed to remove element: ${error.message}`
    };
  }
}

/**
 * Remove multiple elements by their data-editable IDs
 * @param {Object} ast - Babel AST
 * @param {Array<string>} targetIds - Array of data-editable IDs
 * @returns {Object} - { success, ast, removedCount, errors }
 */
function removeMultiple(ast, targetIds) {
  const results = {
    success: true,
    ast,
    removedCount: 0,
    errors: []
  };

  // Remove in reverse order to preserve indices
  for (const targetId of targetIds.reverse()) {
    const result = removeElement(ast, targetId);
    
    if (result.success) {
      results.removedCount++;
    } else {
      results.errors.push({ id: targetId, message: result.message });
    }
  }

  results.success = results.errors.length === 0;
  
  return results;
}

/**
 * Remove all children from an element (clear contents)
 * @param {Object} ast - Babel AST
 * @param {string} targetId - data-editable ID of the parent element
 * @returns {Object} - { success, ast, message }
 */
function clearChildren(ast, targetId) {
  const target = findByEditableId(ast, targetId);
  
  if (!target) {
    return {
      success: false,
      ast,
      message: `Element with data-editable="${targetId}" not found`
    };
  }

  // Clear all children
  target.node.children = [];
  
  // Make it self-closing if possible
  const tagName = target.node.openingElement.name.name;
  const voidElements = ['img', 'br', 'hr', 'input', 'meta', 'link'];
  
  if (voidElements.includes(tagName.toLowerCase())) {
    target.node.openingElement.selfClosing = true;
    target.node.closingElement = null;
  }

  return {
    success: true,
    ast,
    message: `Children of "${targetId}" cleared`
  };
}

// ============================================
// Helper Functions
// ============================================

/**
 * Check if a node is just whitespace text
 */
function isWhitespaceNode(node) {
  return node && 
         node.type === 'JSXText' && 
         /^\s*$/.test(node.value);
}

module.exports = {
  removeElement,
  removeMultiple,
  clearChildren
};
