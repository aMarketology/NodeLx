#!/usr/bin/env node
/**
 * NodeLx — Create User Script
 * Usage: npm run create-user -- --email=you@example.com --role=developer --password=yourpassword
 *
 * Roles: developer | client
 * If --password is omitted, a random one is generated and printed once.
 */

require('dotenv').config();

const { hashPassword }  = require('../server/auth/hash');
const { createUser, findByEmail } = require('../server/auth/users');
const crypto = require('crypto');

// ─── Parse CLI args ──────────────────────────────────────────────────────────
const args = Object.fromEntries(
  process.argv
    .slice(2)
    .filter((a) => a.startsWith('--'))
    .map((a) => {
      const [key, ...rest] = a.slice(2).split('=');
      return [key, rest.join('=')];
    })
);

const { email, role = 'client', password } = args;

if (!email) {
  console.error('\n❌  Usage: npm run create-user -- --email=x@y.com --role=developer [--password=secret]\n');
  process.exit(1);
}

if (!['developer', 'client'].includes(role)) {
  console.error(`\n❌  Invalid role "${role}". Must be "developer" or "client".\n`);
  process.exit(1);
}

// ─── Check for duplicate ─────────────────────────────────────────────────────
if (findByEmail(email)) {
  console.error(`\n❌  User ${email} already exists.\n`);
  process.exit(1);
}

// ─── Generate password if not provided ───────────────────────────────────────
const finalPassword = password || crypto.randomBytes(10).toString('hex');
const generated     = !password;

// ─── Create user ─────────────────────────────────────────────────────────────
(async () => {
  const passwordHash = await hashPassword(finalPassword);
  const user = createUser({ email, passwordHash, role });

  console.log('\n✅  User created successfully!\n');
  console.log(`   Email : ${user.email}`);
  console.log(`   Role  : ${user.role}`);
  console.log(`   ID    : ${user.id}`);

  if (generated) {
    console.log(`\n⚠️   Generated password (shown once — save it now!):`);
    console.log(`   Password: ${finalPassword}\n`);
  } else {
    console.log(`\n   Password set as provided. Share it securely.\n`);
  }
})();
