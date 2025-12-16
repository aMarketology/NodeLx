/**
 * Update Operation - Modify JSX elements in the AST
 */

const t = require('@babel/types');
const traverse = require('@babel/traverse').default;
const { findByEditableId, getTagName } = require('../utils/findElement');

/**
 * Update the text content of an element
 * @param {Object} ast - Babel AST
 * @param {string} targetId - data-editable ID of the element
 * @param {string} newText - New text content
 * @returns {Object} - { success, ast, oldText, message }
 */
function updateText(ast, targetId, newText) {
  const target = findByEditableId(ast, targetId);
  
  if (!target) {
    return {
      success: false,
      ast,
      oldText: null,
      message: `Element with data-editable="${targetId}" not found`
    };
  }

  const children = target.node.children || [];
  let oldText = '';

  // Find and update text content
  let textFound = false;
  
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    
    // Direct text node
    if (t.isJSXText(child)) {
      oldText = child.value.trim();
      child.value = newText;
      textFound = true;
      break;
    }
    
    // Expression container with string/template
    if (t.isJSXExpressionContainer(child)) {
      const expr = child.expression;
      
      // Handle {content.something} - replace with string
      if (t.isMemberExpression(expr) || t.isIdentifier(expr)) {
        oldText = `{${getExpressionString(expr)}}`;
        children[i] = t.jsxText(newText);
        textFound = true;
        break;
      }
      
      // Handle {"string"} or {`template`}
      if (t.isStringLiteral(expr)) {
        oldText = expr.value;
        expr.value = newText;
        textFound = true;
        break;
      }
      
      if (t.isTemplateLiteral(expr) && expr.quasis.length === 1) {
        oldText = expr.quasis[0].value.raw;
        expr.quasis[0].value.raw = newText;
        expr.quasis[0].value.cooked = newText;
        textFound = true;
        break;
      }
    }
  }

  // If no text found, add it
  if (!textFound) {
    target.node.children = [t.jsxText(newText)];
    
    // Make sure element is not self-closing
    target.node.openingElement.selfClosing = false;
    if (!target.node.closingElement) {
      const tagName = target.node.openingElement.name.name;
      target.node.closingElement = t.jsxClosingElement(t.jsxIdentifier(tagName));
    }
  }

  return {
    success: true,
    ast,
    oldText,
    message: `Text updated for "${targetId}"`
  };
}

/**
 * Update or add an attribute on an element
 * @param {Object} ast - Babel AST
 * @param {string} targetId - data-editable ID of the element
 * @param {string} attrName - Attribute name
 * @param {*} attrValue - New attribute value
 * @returns {Object} - { success, ast, oldValue, message }
 */
function updateAttribute(ast, targetId, attrName, attrValue) {
  const target = findByEditableId(ast, targetId);
  
  if (!target) {
    return {
      success: false,
      ast,
      oldValue: null,
      message: `Element with data-editable="${targetId}" not found`
    };
  }

  const attributes = target.node.openingElement.attributes;
  let oldValue = null;

  // Find existing attribute
  const existingIndex = attributes.findIndex(
    attr => t.isJSXAttribute(attr) && attr.name.name === attrName
  );

  // Create new attribute value node
  let valueNode;
  if (attrValue === true) {
    valueNode = null; // Boolean true = no value (e.g., disabled)
  } else if (attrValue === false || attrValue === null) {
    // Remove the attribute
    if (existingIndex >= 0) {
      const removed = attributes.splice(existingIndex, 1)[0];
      oldValue = getAttributeValueFromNode(removed);
    }
    return {
      success: true,
      ast,
      oldValue,
      message: `Attribute "${attrName}" removed from "${targetId}"`
    };
  } else if (typeof attrValue === 'string') {
    valueNode = t.stringLiteral(attrValue);
  } else if (typeof attrValue === 'number') {
    valueNode = t.jsxExpressionContainer(t.numericLiteral(attrValue));
  } else if (typeof attrValue === 'object' && attrValue.expression) {
    valueNode = t.jsxExpressionContainer(t.identifier(attrValue.expression));
  } else {
    valueNode = t.stringLiteral(String(attrValue));
  }

  const newAttr = t.jsxAttribute(
    t.jsxIdentifier(attrName),
    valueNode
  );

  if (existingIndex >= 0) {
    // Update existing attribute
    oldValue = getAttributeValueFromNode(attributes[existingIndex]);
    attributes[existingIndex] = newAttr;
  } else {
    // Add new attribute
    attributes.push(newAttr);
  }

  return {
    success: true,
    ast,
    oldValue,
    message: `Attribute "${attrName}" updated on "${targetId}"`
  };
}

/**
 * Update multiple attributes at once
 * @param {Object} ast - Babel AST
 * @param {string} targetId - data-editable ID of the element
 * @param {Object} attributes - { attrName: attrValue, ... }
 * @returns {Object} - { success, ast, message }
 */
function updateAttributes(ast, targetId, attributes) {
  let currentAst = ast;
  const updates = [];

  for (const [attrName, attrValue] of Object.entries(attributes)) {
    const result = updateAttribute(currentAst, targetId, attrName, attrValue);
    currentAst = result.ast;
    updates.push({ attr: attrName, success: result.success });
  }

  const allSuccess = updates.every(u => u.success);

  return {
    success: allSuccess,
    ast: currentAst,
    updates,
    message: `Updated ${updates.filter(u => u.success).length}/${updates.length} attributes on "${targetId}"`
  };
}

/**
 * Change the tag name of an element
 * @param {Object} ast - Babel AST
 * @param {string} targetId - data-editable ID of the element
 * @param {string} newTagName - New tag name
 * @returns {Object} - { success, ast, oldTagName, message }
 */
function updateTagName(ast, targetId, newTagName) {
  const target = findByEditableId(ast, targetId);
  
  if (!target) {
    return {
      success: false,
      ast,
      oldTagName: null,
      message: `Element with data-editable="${targetId}" not found`
    };
  }

  const oldTagName = getTagName(target.node.openingElement);

  // Update opening element
  target.node.openingElement.name = t.jsxIdentifier(newTagName);

  // Update closing element if exists
  if (target.node.closingElement) {
    target.node.closingElement.name = t.jsxIdentifier(newTagName);
  }

  return {
    success: true,
    ast,
    oldTagName,
    message: `Tag name changed from "${oldTagName}" to "${newTagName}" on "${targetId}"`
  };
}

/**
 * Replace an element's entire content (children)
 * @param {Object} ast - Babel AST
 * @param {string} targetId - data-editable ID of the element
 * @param {Array} newChildren - New children (text strings or JSX nodes)
 * @returns {Object} - { success, ast, message }
 */
function replaceChildren(ast, targetId, newChildren) {
  const target = findByEditableId(ast, targetId);
  
  if (!target) {
    return {
      success: false,
      ast,
      message: `Element with data-editable="${targetId}" not found`
    };
  }

  // Convert children to AST nodes
  const childNodes = newChildren.map(child => {
    if (typeof child === 'string') {
      return t.jsxText(child);
    }
    return child;
  });

  target.node.children = childNodes;

  // Ensure element is not self-closing if it has children
  if (childNodes.length > 0) {
    target.node.openingElement.selfClosing = false;
    if (!target.node.closingElement) {
      const tagName = target.node.openingElement.name.name;
      target.node.closingElement = t.jsxClosingElement(t.jsxIdentifier(tagName));
    }
  }

  return {
    success: true,
    ast,
    message: `Children replaced for "${targetId}"`
  };
}

// ============================================
// Helper Functions
// ============================================

/**
 * Get string representation of an expression
 */
function getExpressionString(expr) {
  if (t.isIdentifier(expr)) {
    return expr.name;
  }
  if (t.isMemberExpression(expr)) {
    return `${getExpressionString(expr.object)}.${expr.property.name}`;
  }
  return 'expression';
}

/**
 * Get the value from an attribute node
 */
function getAttributeValueFromNode(attr) {
  if (!attr.value) return true; // Boolean attribute
  
  if (t.isStringLiteral(attr.value)) {
    return attr.value.value;
  }
  
  if (t.isJSXExpressionContainer(attr.value)) {
    const expr = attr.value.expression;
    if (t.isStringLiteral(expr)) return expr.value;
    if (t.isNumericLiteral(expr)) return expr.value;
    if (t.isBooleanLiteral(expr)) return expr.value;
  }
  
  return null;
}

module.exports = {
  updateText,
  updateAttribute,
  updateAttributes,
  updateTagName,
  replaceChildren
};
