/**
 * Find Element Utility - Locate JSX elements in AST
 * Used by all operations to find target elements
 */

const traverse = require('@babel/traverse').default;
const t = require('@babel/types');

/**
 * Find a JSX element by its data-editable attribute value
 * @param {Object} ast - Babel AST
 * @param {string} editableId - The data-editable value to find
 * @returns {Object|null} - { path, node, parent } or null if not found
 */
function findByEditableId(ast, editableId) {
  let result = null;

  traverse(ast, {
    JSXElement(path) {
      const openingElement = path.node.openingElement;
      const editableAttr = getEditableAttribute(openingElement);

      if (editableAttr && getAttributeValue(editableAttr) === editableId) {
        result = {
          path,
          node: path.node,
          parent: path.parent,
          parentPath: path.parentPath,
          index: getChildIndex(path)
        };
        path.stop(); // Stop traversal once found
      }
    }
  });

  return result;
}

/**
 * Find all JSX elements with data-editable attributes
 * @param {Object} ast - Babel AST
 * @returns {Array<{id: string, path: Object, node: Object}>}
 */
function findAllEditableElements(ast) {
  const elements = [];

  traverse(ast, {
    JSXElement(path) {
      const openingElement = path.node.openingElement;
      const editableAttr = getEditableAttribute(openingElement);

      if (editableAttr) {
        const id = getAttributeValue(editableAttr);
        elements.push({
          id,
          path,
          node: path.node,
          tagName: getTagName(openingElement),
          location: path.node.loc
        });
      }
    }
  });

  return elements;
}

/**
 * Find JSX element by tag name (first match)
 * @param {Object} ast - Babel AST
 * @param {string} tagName - Tag name to find (e.g., 'div', 'Button')
 * @returns {Object|null}
 */
function findByTagName(ast, tagName) {
  let result = null;

  traverse(ast, {
    JSXElement(path) {
      const name = getTagName(path.node.openingElement);
      if (name === tagName) {
        result = {
          path,
          node: path.node,
          parent: path.parent,
          index: getChildIndex(path)
        };
        path.stop();
      }
    }
  });

  return result;
}

/**
 * Find the return statement in a function component
 * @param {Object} ast - Babel AST
 * @param {string} componentName - Optional component name to find
 * @returns {Object|null}
 */
function findComponentReturn(ast, componentName = null) {
  let result = null;

  traverse(ast, {
    // Arrow function components
    ArrowFunctionExpression(path) {
      if (componentName) {
        const parent = path.parent;
        if (parent.type === 'VariableDeclarator' && 
            parent.id.name === componentName) {
          result = findReturnInFunction(path);
          path.stop();
        }
      } else if (path.node.body.type === 'JSXElement') {
        result = { path, node: path.node.body };
        path.stop();
      }
    },
    
    // Regular function components
    FunctionDeclaration(path) {
      if (!componentName || path.node.id?.name === componentName) {
        result = findReturnInFunction(path);
        if (result) path.stop();
      }
    },
    
    // Function expression components
    FunctionExpression(path) {
      if (componentName) {
        const parent = path.parent;
        if (parent.type === 'VariableDeclarator' && 
            parent.id.name === componentName) {
          result = findReturnInFunction(path);
          path.stop();
        }
      }
    }
  });

  return result;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Get the data-editable attribute from an opening element
 */
function getEditableAttribute(openingElement) {
  return openingElement.attributes.find(
    attr => 
      t.isJSXAttribute(attr) &&
      t.isJSXIdentifier(attr.name) &&
      attr.name.name === 'data-editable'
  );
}

/**
 * Get the value of a JSX attribute
 */
function getAttributeValue(attr) {
  if (!attr.value) return null;
  
  // String literal: data-editable="value"
  if (t.isStringLiteral(attr.value)) {
    return attr.value.value;
  }
  
  // JSX expression: data-editable={value}
  if (t.isJSXExpressionContainer(attr.value)) {
    const expr = attr.value.expression;
    if (t.isStringLiteral(expr)) {
      return expr.value;
    }
  }
  
  return null;
}

/**
 * Get the tag name from an opening element
 */
function getTagName(openingElement) {
  const name = openingElement.name;
  
  if (t.isJSXIdentifier(name)) {
    return name.name;
  }
  
  if (t.isJSXMemberExpression(name)) {
    // Handle Component.SubComponent
    return `${name.object.name}.${name.property.name}`;
  }
  
  return null;
}

/**
 * Get the index of an element among its siblings
 */
function getChildIndex(path) {
  if (!path.parentPath || !Array.isArray(path.parent.children)) {
    return -1;
  }
  return path.parent.children.indexOf(path.node);
}

/**
 * Find return statement in a function body
 */
function findReturnInFunction(functionPath) {
  let result = null;
  
  functionPath.traverse({
    ReturnStatement(path) {
      if (path.node.argument && 
          (t.isJSXElement(path.node.argument) || 
           t.isJSXFragment(path.node.argument))) {
        result = {
          path,
          node: path.node.argument
        };
        path.stop();
      }
    }
  });
  
  return result;
}

module.exports = {
  findByEditableId,
  findAllEditableElements,
  findByTagName,
  findComponentReturn,
  getEditableAttribute,
  getAttributeValue,
  getTagName,
  getChildIndex
};
