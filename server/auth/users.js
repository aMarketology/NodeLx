const fs   = require('fs');
const path = require('path');

const USERS_FILE = path.resolve(__dirname, '../../content/users.json');

/**
 * Read all users from disk
 * @returns {Array}
 */
const getUsers = () => {
  try {
    const raw = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
    // Support both array format and { users: [] } object format
    return Array.isArray(raw) ? raw : (raw.users || []);
  } catch {
    return [];
  }
};

/**
 * Write users array back to disk
 * @param {Array} users
 */
const saveUsers = (users) => {
  fs.mkdirSync(path.dirname(USERS_FILE), { recursive: true });
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
};

/**
 * Find a user by email (case-insensitive)
 * @param {string} email
 * @returns {object|null}
 */
const findByEmail = (email) => {
  const users = getUsers();
  return users.find((u) => u.email === email.toLowerCase()) || null;
};

/**
 * Create and persist a new user
 * @param {{ email: string, passwordHash: string, role: 'developer'|'client' }} opts
 * @returns {object} created user (no passwordHash exposed)
 */
const createUser = ({ email, passwordHash, role }) => {
  const users = getUsers();
  const normalEmail = email.toLowerCase();

  if (users.find((u) => u.email === normalEmail)) {
    throw new Error(`User ${normalEmail} already exists`);
  }

  const user = {
    id: Date.now().toString(),
    email: normalEmail,
    passwordHash,
    role,
    createdAt: new Date().toISOString(),
  };

  users.push(user);
  saveUsers(users);

  // Return safe copy (no hash)
  const { passwordHash: _, ...safe } = user;
  return safe;
};

/**
 * List all users (safe — no password hashes)
 * @returns {Array}
 */
const listUsers = () =>
  getUsers().map(({ passwordHash: _, ...u }) => u);

module.exports = { getUsers, findByEmail, createUser, listUsers };
