/**
 * Move Operation - Reorder JSX elements in the AST
 */

const t = require('@babel/types');
const { findByEditableId } = require('../utils/findElement');

/**
 * Move an element up (before its previous sibling)
 * @param {Object} ast - Babel AST
 * @param {string} targetId - data-editable ID of the element to move
 * @returns {Object} - { success, ast, message }
 */
function moveUp(ast, targetId) {
  const target = findByEditableId(ast, targetId);
  
  if (!target) {
    return {
      success: false,
      ast,
      message: `Element with data-editable="${targetId}" not found`
    };
  }

  const parent = target.path.parent;
  
  if (!parent.children || !Array.isArray(parent.children)) {
    return {
      success: false,
      ast,
      message: 'Cannot move element: no siblings found'
    };
  }

  const children = parent.children;
  const index = children.indexOf(target.node);

  // Find the previous non-whitespace sibling
  let prevIndex = index - 1;
  while (prevIndex >= 0 && isWhitespaceNode(children[prevIndex])) {
    prevIndex--;
  }

  if (prevIndex < 0) {
    return {
      success: false,
      ast,
      message: 'Element is already at the top'
    };
  }

  // Swap positions
  const temp = children[prevIndex];
  children[prevIndex] = target.node;
  children[index] = temp;

  return {
    success: true,
    ast,
    message: `Element "${targetId}" moved up`
  };
}

/**
 * Move an element down (after its next sibling)
 * @param {Object} ast - Babel AST
 * @param {string} targetId - data-editable ID of the element to move
 * @returns {Object} - { success, ast, message }
 */
function moveDown(ast, targetId) {
  const target = findByEditableId(ast, targetId);
  
  if (!target) {
    return {
      success: false,
      ast,
      message: `Element with data-editable="${targetId}" not found`
    };
  }

  const parent = target.path.parent;
  
  if (!parent.children || !Array.isArray(parent.children)) {
    return {
      success: false,
      ast,
      message: 'Cannot move element: no siblings found'
    };
  }

  const children = parent.children;
  const index = children.indexOf(target.node);

  // Find the next non-whitespace sibling
  let nextIndex = index + 1;
  while (nextIndex < children.length && isWhitespaceNode(children[nextIndex])) {
    nextIndex++;
  }

  if (nextIndex >= children.length) {
    return {
      success: false,
      ast,
      message: 'Element is already at the bottom'
    };
  }

  // Swap positions
  const temp = children[nextIndex];
  children[nextIndex] = target.node;
  children[index] = temp;

  return {
    success: true,
    ast,
    message: `Element "${targetId}" moved down`
  };
}

/**
 * Move an element to a specific index among its siblings
 * @param {Object} ast - Babel AST
 * @param {string} targetId - data-editable ID of the element to move
 * @param {number} newIndex - New index position
 * @returns {Object} - { success, ast, message }
 */
function moveToIndex(ast, targetId, newIndex) {
  const target = findByEditableId(ast, targetId);
  
  if (!target) {
    return {
      success: false,
      ast,
      message: `Element with data-editable="${targetId}" not found`
    };
  }

  const parent = target.path.parent;
  
  if (!parent.children || !Array.isArray(parent.children)) {
    return {
      success: false,
      ast,
      message: 'Cannot move element: no siblings found'
    };
  }

  const children = parent.children;
  const currentIndex = children.indexOf(target.node);

  // Get only non-whitespace elements for index calculation
  const elements = children.filter(child => !isWhitespaceNode(child));
  const elementIndex = elements.indexOf(target.node);
  
  if (newIndex < 0 || newIndex >= elements.length) {
    return {
      success: false,
      ast,
      message: `Invalid index: ${newIndex}. Must be between 0 and ${elements.length - 1}`
    };
  }

  // Remove from current position
  children.splice(currentIndex, 1);
  
  // Calculate new position in full children array
  const targetElement = elements[newIndex];
  let insertIndex = children.indexOf(targetElement);
  
  if (insertIndex === -1) {
    insertIndex = children.length;
  }

  // Insert at new position
  children.splice(insertIndex, 0, target.node);

  return {
    success: true,
    ast,
    message: `Element "${targetId}" moved to index ${newIndex}`
  };
}

/**
 * Move an element into another element (as last child)
 * @param {Object} ast - Babel AST
 * @param {string} sourceId - data-editable ID of the element to move
 * @param {string} destinationId - data-editable ID of the destination parent
 * @returns {Object} - { success, ast, message }
 */
function moveInto(ast, sourceId, destinationId) {
  const source = findByEditableId(ast, sourceId);
  const destination = findByEditableId(ast, destinationId);
  
  if (!source) {
    return {
      success: false,
      ast,
      message: `Source element with data-editable="${sourceId}" not found`
    };
  }
  
  if (!destination) {
    return {
      success: false,
      ast,
      message: `Destination element with data-editable="${destinationId}" not found`
    };
  }

  // Check that destination is not a descendant of source
  if (isDescendant(source.node, destination.node)) {
    return {
      success: false,
      ast,
      message: 'Cannot move element into its own descendant'
    };
  }

  // Remove from current parent
  const sourceParent = source.path.parent;
  if (sourceParent.children && Array.isArray(sourceParent.children)) {
    const index = sourceParent.children.indexOf(source.node);
    if (index >= 0) {
      // Also remove adjacent whitespace
      if (index > 0 && isWhitespaceNode(sourceParent.children[index - 1])) {
        sourceParent.children.splice(index - 1, 2);
      } else {
        sourceParent.children.splice(index, 1);
      }
    }
  }

  // Add to destination
  if (!destination.node.children) {
    destination.node.children = [];
  }
  
  destination.node.children.push(
    t.jsxText('\n        '),
    source.node,
    t.jsxText('\n      ')
  );

  // Make sure destination is not self-closing
  destination.node.openingElement.selfClosing = false;
  if (!destination.node.closingElement) {
    const tagName = destination.node.openingElement.name.name;
    destination.node.closingElement = t.jsxClosingElement(t.jsxIdentifier(tagName));
  }

  return {
    success: true,
    ast,
    message: `Element "${sourceId}" moved into "${destinationId}"`
  };
}

/**
 * Swap positions of two elements
 * @param {Object} ast - Babel AST
 * @param {string} id1 - data-editable ID of first element
 * @param {string} id2 - data-editable ID of second element
 * @returns {Object} - { success, ast, message }
 */
function swap(ast, id1, id2) {
  const element1 = findByEditableId(ast, id1);
  const element2 = findByEditableId(ast, id2);
  
  if (!element1) {
    return {
      success: false,
      ast,
      message: `Element with data-editable="${id1}" not found`
    };
  }
  
  if (!element2) {
    return {
      success: false,
      ast,
      message: `Element with data-editable="${id2}" not found`
    };
  }

  const parent1 = element1.path.parent;
  const parent2 = element2.path.parent;

  // Both must have children arrays
  if (!parent1.children || !parent2.children) {
    return {
      success: false,
      ast,
      message: 'Cannot swap: elements must have valid parents'
    };
  }

  const index1 = parent1.children.indexOf(element1.node);
  const index2 = parent2.children.indexOf(element2.node);

  if (parent1 === parent2) {
    // Same parent - simple swap
    parent1.children[index1] = element2.node;
    parent1.children[index2] = element1.node;
  } else {
    // Different parents
    parent1.children[index1] = element2.node;
    parent2.children[index2] = element1.node;
  }

  return {
    success: true,
    ast,
    message: `Elements "${id1}" and "${id2}" swapped`
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

/**
 * Check if possibleDescendant is a descendant of ancestor
 */
function isDescendant(ancestor, possibleDescendant) {
  if (!ancestor.children) return false;
  
  for (const child of ancestor.children) {
    if (child === possibleDescendant) return true;
    if (child.children && isDescendant(child, possibleDescendant)) return true;
  }
  
  return false;
}

module.exports = {
  moveUp,
  moveDown,
  moveToIndex,
  moveInto,
  swap
};
