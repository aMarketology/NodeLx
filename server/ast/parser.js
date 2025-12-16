/**
 * AST Parser - Parse JSX/TSX files into Abstract Syntax Trees
 * Uses Babel parser for robust JSX support
 */

const parser = require('@babel/parser');
const fs = require('fs').promises;
const path = require('path');

/**
 * Parse options for Babel
 */
const PARSE_OPTIONS = {
  sourceType: 'module',
  plugins: [
    'jsx',
    'typescript',
    'classProperties',
    'decorators-legacy',
    'exportDefaultFrom',
    'optionalChaining',
    'nullishCoalescingOperator'
  ]
};

/**
 * Parse code string into AST
 * @param {string} code - Source code to parse
 * @returns {Object} - Babel AST
 */
function parseCode(code) {
  try {
    return parser.parse(code, PARSE_OPTIONS);
  } catch (error) {
    throw new Error(`Parse error: ${error.message}`);
  }
}

/**
 * Parse a file into AST
 * @param {string} filePath - Path to the file
 * @returns {Promise<{ast: Object, code: string}>}
 */
async function parseFile(filePath) {
  const code = await fs.readFile(filePath, 'utf-8');
  const ast = parseCode(code);
  
  return {
    ast,
    code,
    filePath
  };
}

/**
 * Check if a file is parseable (JSX/TSX/JS/TS)
 * @param {string} filePath - Path to check
 * @returns {boolean}
 */
function isParseable(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return ['.js', '.jsx', '.ts', '.tsx'].includes(ext);
}

module.exports = {
  parseCode,
  parseFile,
  isParseable,
  PARSE_OPTIONS
};
