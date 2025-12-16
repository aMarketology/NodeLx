/**
 * AST Generator - Convert AST back to source code
 * Uses Babel generator with formatting preservation
 */

const generate = require('@babel/generator').default;

/**
 * Default generator options
 * Preserves formatting as much as possible
 */
const DEFAULT_OPTIONS = {
  retainLines: false,        // Don't force original line numbers
  compact: false,            // Don't minify
  concise: false,            // Full output
  quotes: 'single',          // Use single quotes
  jsescOption: {
    minimal: true            // Minimal escaping
  }
};

/**
 * Generate code from AST
 * @param {Object} ast - Babel AST
 * @param {Object} options - Generator options
 * @returns {string} - Generated source code
 */
function generateCode(ast, options = {}) {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
  
  try {
    const result = generate(ast, mergedOptions);
    return result.code;
  } catch (error) {
    throw new Error(`Generator error: ${error.message}`);
  }
}

/**
 * Generate code with source map
 * @param {Object} ast - Babel AST
 * @param {string} sourceFileName - Original file name
 * @returns {{code: string, map: Object}}
 */
function generateWithSourceMap(ast, sourceFileName) {
  const options = {
    ...DEFAULT_OPTIONS,
    sourceMaps: true,
    sourceFileName
  };
  
  const result = generate(ast, options);
  return {
    code: result.code,
    map: result.map
  };
}

/**
 * Format generated code (basic prettification)
 * @param {string} code - Generated code
 * @returns {string} - Formatted code
 */
function formatCode(code) {
  // Basic formatting - add newlines after imports and before exports
  let formatted = code;
  
  // Add blank line after import block
  formatted = formatted.replace(
    /(import [^;]+;)\n((?!import)[a-zA-Z])/g,
    '$1\n\n$2'
  );
  
  // Add blank line before export
  formatted = formatted.replace(
    /([;}])\n(export )/g,
    '$1\n\n$2'
  );
  
  return formatted;
}

module.exports = {
  generateCode,
  generateWithSourceMap,
  formatCode,
  DEFAULT_OPTIONS
};
