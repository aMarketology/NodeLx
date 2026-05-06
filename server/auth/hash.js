const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 12;

/**
 * Hash a plain-text password
 * @param {string} plain
 * @returns {Promise<string>} bcrypt hash
 */
const hashPassword = (plain) => bcrypt.hash(plain, SALT_ROUNDS);

/**
 * Compare a plain-text password against a bcrypt hash
 * @param {string} plain
 * @param {string} hash
 * @returns {Promise<boolean>}
 */
const verifyPassword = (plain, hash) => bcrypt.compare(plain, hash);

module.exports = { hashPassword, verifyPassword };
