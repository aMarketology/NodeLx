/**
 * Style Operation - Manage inline styles and spacing on JSX elements
 */

const t = require('@babel/types');
const { findByEditableId } = require('../utils/findElement');

/**
 * Parse inline style string to object
 * @param {string} styleString - CSS style string "margin: 10px; padding: 20px"
 * @returns {Object}
 */
function parseStyleString(styleString) {
  const styles = {};
  if (!styleString) return styles;
  
  styleString.split(';').forEach(rule => {
    const [prop, value] = rule.split(':').map(s => s.trim());
    if (prop && value) {
      // Convert kebab-case to camelCase
      const camelProp = prop.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
      styles[camelProp] = value;
    }
  });
  
  return styles;
}

/**
 * Convert style object to JSX style attribute value
 * @param {Object} styles - Style object { marginTop: '10px' }
 * @returns {Object} - Babel AST node for style attribute
 */
function styleObjectToAST(styles) {
  const properties = Object.entries(styles).map(([key, value]) => {
    return t.objectProperty(
      t.identifier(key),
      t.stringLiteral(value)
    );
  });
  
  return t.jsxExpressionContainer(
    t.objectExpression(properties)
  );
}

/**
 * Get current style object from an element
 * @param {Object} elementNode - JSX Element node
 * @returns {Object} - Current styles
 */
function getElementStyles(elementNode) {
  const attributes = elementNode.openingElement.attributes;
  
  const styleAttr = attributes.find(
    attr => t.isJSXAttribute(attr) && attr.name.name === 'style'
  );
  
  if (!styleAttr || !styleAttr.value) {
    return {};
  }
  
  // Handle style={{ ... }}
  if (t.isJSXExpressionContainer(styleAttr.value)) {
    const expr = styleAttr.value.expression;
    
    if (t.isObjectExpression(expr)) {
      const styles = {};
      expr.properties.forEach(prop => {
        if (t.isObjectProperty(prop)) {
          const key = prop.key.name || prop.key.value;
          const value = prop.value.value || prop.value.name;
          styles[key] = value;
        }
      });
      return styles;
    }
  }
  
  return {};
}

/**
 * Update or add style properties to an element
 * @param {Object} ast - Babel AST
 * @param {string} targetId - data-editable ID
 * @param {Object} newStyles - Styles to add/update { marginTop: '20px' }
 * @returns {Object} - { success, ast, message }
 */
function updateStyles(ast, targetId, newStyles) {
  const target = findByEditableId(ast, targetId);
  
  if (!target) {
    return {
      success: false,
      ast,
      message: `Element with data-editable="${targetId}" not found`
    };
  }

  const attributes = target.node.openingElement.attributes;
  
  // Get existing styles
  const currentStyles = getElementStyles(target.node);
  
  // Merge with new styles
  const mergedStyles = { ...currentStyles, ...newStyles };
  
  // Remove null/undefined values (allows removing styles)
  Object.keys(mergedStyles).forEach(key => {
    if (mergedStyles[key] === null || mergedStyles[key] === undefined || mergedStyles[key] === '') {
      delete mergedStyles[key];
    }
  });
  
  // Find or create style attribute
  const styleAttrIndex = attributes.findIndex(
    attr => t.isJSXAttribute(attr) && attr.name.name === 'style'
  );
  
  const newStyleAttr = t.jsxAttribute(
    t.jsxIdentifier('style'),
    styleObjectToAST(mergedStyles)
  );
  
  if (styleAttrIndex >= 0) {
    attributes[styleAttrIndex] = newStyleAttr;
  } else {
    attributes.push(newStyleAttr);
  }

  return {
    success: true,
    ast,
    styles: mergedStyles,
    message: `Styles updated on "${targetId}"`
  };
}

/**
 * Set spacing (margin/padding) on an element
 * @param {Object} ast - Babel AST
 * @param {string} targetId - data-editable ID
 * @param {Object} spacing - { marginTop, marginBottom, paddingTop, paddingBottom, etc. }
 * @returns {Object}
 */
function setSpacing(ast, targetId, spacing) {
  const styleUpdates = {};
  
  // Map spacing values to style properties
  const spacingProps = [
    'marginTop', 'marginBottom', 'marginLeft', 'marginRight', 'margin',
    'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight', 'padding'
  ];
  
  spacingProps.forEach(prop => {
    if (spacing[prop] !== undefined) {
      // Add 'px' if it's just a number
      const value = spacing[prop];
      styleUpdates[prop] = typeof value === 'number' ? `${value}px` : value;
    }
  });
  
  return updateStyles(ast, targetId, styleUpdates);
}

/**
 * Set margin on an element
 * @param {Object} ast - Babel AST
 * @param {string} targetId - data-editable ID
 * @param {Object} margin - { top, bottom, left, right } or single value
 * @returns {Object}
 */
function setMargin(ast, targetId, margin) {
  if (typeof margin === 'number' || typeof margin === 'string') {
    return updateStyles(ast, targetId, { margin: typeof margin === 'number' ? `${margin}px` : margin });
  }
  
  const styles = {};
  if (margin.top !== undefined) styles.marginTop = `${margin.top}px`;
  if (margin.bottom !== undefined) styles.marginBottom = `${margin.bottom}px`;
  if (margin.left !== undefined) styles.marginLeft = `${margin.left}px`;
  if (margin.right !== undefined) styles.marginRight = `${margin.right}px`;
  
  return updateStyles(ast, targetId, styles);
}

/**
 * Set padding on an element
 * @param {Object} ast - Babel AST
 * @param {string} targetId - data-editable ID
 * @param {Object} padding - { top, bottom, left, right } or single value
 * @returns {Object}
 */
function setPadding(ast, targetId, padding) {
  if (typeof padding === 'number' || typeof padding === 'string') {
    return updateStyles(ast, targetId, { padding: typeof padding === 'number' ? `${padding}px` : padding });
  }
  
  const styles = {};
  if (padding.top !== undefined) styles.paddingTop = `${padding.top}px`;
  if (padding.bottom !== undefined) styles.paddingBottom = `${padding.bottom}px`;
  if (padding.left !== undefined) styles.paddingLeft = `${padding.left}px`;
  if (padding.right !== undefined) styles.paddingRight = `${padding.right}px`;
  
  return updateStyles(ast, targetId, styles);
}

/**
 * Remove all inline styles from an element
 * @param {Object} ast - Babel AST
 * @param {string} targetId - data-editable ID
 * @returns {Object}
 */
function clearStyles(ast, targetId) {
  const target = findByEditableId(ast, targetId);
  
  if (!target) {
    return {
      success: false,
      ast,
      message: `Element with data-editable="${targetId}" not found`
    };
  }

  const attributes = target.node.openingElement.attributes;
  const styleAttrIndex = attributes.findIndex(
    attr => t.isJSXAttribute(attr) && attr.name.name === 'style'
  );
  
  if (styleAttrIndex >= 0) {
    attributes.splice(styleAttrIndex, 1);
  }

  return {
    success: true,
    ast,
    message: `Styles cleared from "${targetId}"`
  };
}

/**
 * Get current styles from an element
 * @param {Object} ast - Babel AST
 * @param {string} targetId - data-editable ID
 * @returns {Object}
 */
function getStyles(ast, targetId) {
  const target = findByEditableId(ast, targetId);
  
  if (!target) {
    return {
      success: false,
      styles: {},
      message: `Element with data-editable="${targetId}" not found`
    };
  }

  return {
    success: true,
    styles: getElementStyles(target.node),
    message: 'Styles retrieved'
  };
}

module.exports = {
  updateStyles,
  setSpacing,
  setMargin,
  setPadding,
  clearStyles,
  getStyles,
  parseStyleString,
  getElementStyles
};
