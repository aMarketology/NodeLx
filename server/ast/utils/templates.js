/**
 * Element Templates - Pre-built JSX element structures
 * Used by insert operation to create new elements
 */

const parser = require('@babel/parser');
const t = require('@babel/types');

/**
 * Parse a JSX string into an AST node
 * @param {string} jsx - JSX code string
 * @returns {Object} - JSX Element node
 */
function parseJSX(jsx) {
  // Wrap in a fragment to parse standalone JSX
  const code = `<>${jsx}</>`;
  const ast = parser.parse(code, {
    sourceType: 'module',
    plugins: ['jsx']
  });
  
  // Extract the first child from the fragment
  const fragment = ast.program.body[0].expression;
  return fragment.children[0];
}

/**
 * Create a JSX element programmatically
 * @param {string} tagName - Element tag name
 * @param {Object} props - Element attributes
 * @param {Array} children - Child elements or text
 * @returns {Object} - JSX Element node
 */
function createElement(tagName, props = {}, children = []) {
  const attributes = Object.entries(props).map(([key, value]) => {
    // Handle special cases
    if (key === 'className') {
      return t.jsxAttribute(
        t.jsxIdentifier('className'),
        t.stringLiteral(value)
      );
    }
    
    if (key === 'data-editable') {
      return t.jsxAttribute(
        t.jsxIdentifier('data-editable'),
        t.stringLiteral(value)
      );
    }
    
    // Handle boolean attributes
    if (value === true) {
      return t.jsxAttribute(t.jsxIdentifier(key), null);
    }
    
    // Handle expressions
    if (typeof value === 'object' && value.expression) {
      return t.jsxAttribute(
        t.jsxIdentifier(key),
        t.jsxExpressionContainer(
          t.identifier(value.expression)
        )
      );
    }
    
    // Default: string value
    return t.jsxAttribute(
      t.jsxIdentifier(key),
      t.stringLiteral(String(value))
    );
  });

  const jsxChildren = children.map(child => {
    if (typeof child === 'string') {
      return t.jsxText(child);
    }
    if (child.expression) {
      return t.jsxExpressionContainer(
        t.identifier(child.expression)
      );
    }
    return child;
  });

  const openingElement = t.jsxOpeningElement(
    t.jsxIdentifier(tagName),
    attributes,
    jsxChildren.length === 0
  );

  const closingElement = jsxChildren.length > 0
    ? t.jsxClosingElement(t.jsxIdentifier(tagName))
    : null;

  return t.jsxElement(
    openingElement,
    closingElement,
    jsxChildren,
    jsxChildren.length === 0
  );
}

/**
 * Pre-built element templates
 */
const TEMPLATES = {
  // Text elements
  heading: (level = 1, text = 'Heading', editableId = null) => {
    const props = {};
    if (editableId) props['data-editable'] = editableId;
    return createElement(`h${level}`, props, [text]);
  },
  
  paragraph: (text = 'Paragraph text', editableId = null) => {
    const props = {};
    if (editableId) props['data-editable'] = editableId;
    return createElement('p', props, [text]);
  },
  
  span: (text = 'Span text', editableId = null) => {
    const props = {};
    if (editableId) props['data-editable'] = editableId;
    return createElement('span', props, [text]);
  },
  
  // Interactive elements
  button: (text = 'Click me', editableId = null, className = '') => {
    const props = {};
    if (editableId) props['data-editable'] = editableId;
    if (className) props.className = className;
    return createElement('button', props, [text]);
  },
  
  link: (text = 'Link text', href = '#', editableId = null) => {
    const props = { href };
    if (editableId) props['data-editable'] = editableId;
    return createElement('a', props, [text]);
  },
  
  // Media elements
  image: (src = '/placeholder.jpg', alt = 'Image', editableId = null) => {
    const props = { src, alt };
    if (editableId) props['data-editable'] = editableId;
    return createElement('img', props, []);
  },
  
  // Container elements
  div: (className = '', editableId = null, children = []) => {
    const props = {};
    if (className) props.className = className;
    if (editableId) props['data-editable'] = editableId;
    return createElement('div', props, children);
  },
  
  section: (className = '', editableId = null, children = []) => {
    const props = {};
    if (className) props.className = className;
    if (editableId) props['data-editable'] = editableId;
    return createElement('section', props, children);
  },
  
  // Complex templates
  heroSection: (title = 'Hero Title', subtitle = 'Hero subtitle', editablePrefix = 'hero') => {
    return parseJSX(`
      <section className="hero" data-editable="${editablePrefix}Section">
        <h1 data-editable="${editablePrefix}Title">${title}</h1>
        <p data-editable="${editablePrefix}Subtitle">${subtitle}</p>
        <button data-editable="${editablePrefix}CTA">Get Started</button>
      </section>
    `.trim());
  },
  
  card: (title = 'Card Title', description = 'Card description', editablePrefix = 'card') => {
    return parseJSX(`
      <div className="card" data-editable="${editablePrefix}">
        <h3 data-editable="${editablePrefix}Title">${title}</h3>
        <p data-editable="${editablePrefix}Description">${description}</p>
      </div>
    `.trim());
  },
  
  featureItem: (title = 'Feature', description = 'Feature description', editablePrefix = 'feature') => {
    return parseJSX(`
      <div className="feature-item" data-editable="${editablePrefix}">
        <h4 data-editable="${editablePrefix}Title">${title}</h4>
        <p data-editable="${editablePrefix}Description">${description}</p>
      </div>
    `.trim());
  }
};

/**
 * Get a template by name
 * @param {string} templateName - Name of the template
 * @param {Object} options - Template options
 * @returns {Object} - JSX Element node
 */
function getTemplate(templateName, options = {}) {
  const template = TEMPLATES[templateName];
  
  if (!template) {
    throw new Error(`Unknown template: ${templateName}`);
  }
  
  // Call template function with options
  return template(
    options.text || options.title,
    options.subtitle || options.href || options.src,
    options.editableId || options.editablePrefix,
    options.className
  );
}

/**
 * List all available templates
 * @returns {Array<string>}
 */
function listTemplates() {
  return Object.keys(TEMPLATES);
}

module.exports = {
  parseJSX,
  createElement,
  getTemplate,
  listTemplates,
  TEMPLATES
};
