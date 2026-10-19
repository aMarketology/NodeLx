/* Temporary diagnostic: compare shared secrets between NodeLx and the client site. */
const fs = require('fs');
const crypto = require('crypto');
const dotenv = require('dotenv');

const nodeEnv = dotenv.parse(fs.readFileSync(`${__dirname}/../.env`));
const clientPath = '/Users/thelegendofzjui/Documents/GitHub/websites-TWS/williamb_constuction/.env';
const clientEnv = dotenv.parse(fs.readFileSync(clientPath));

const h = (s) => crypto.createHash('sha256').update(String(s || '')).digest('hex').slice(0, 12);

const pairs = [
  'NODELX_API_KEY',
  'REVALIDATION_SECRET',
];

for (const k of pairs) {
  const a = nodeEnv[k] || '';
  const b = clientEnv[k] || '';
  console.log(
    `${k.padEnd(22)} nodelx(len ${String(a.length).padStart(3)}, ${h(a)})  client(len ${String(b.length).padStart(3)}, ${h(b)})  MATCH=${a === b && a.length > 0}`,
  );
}

console.log('\nClient-only values:');
console.log('  NODELX_URL           =', clientEnv.NODELX_URL);
console.log('  NODELX_SITE_ID       =', clientEnv.NODELX_SITE_ID);
console.log('  ALLOW_IMAGE_EDITING  =', clientEnv.ALLOW_IMAGE_EDITING);
console.log('  ADMIN_PASSWORD set   =', !!clientEnv.ADMIN_PASSWORD);
console.log('  ADMIN_SECRET set     =', !!clientEnv.ADMIN_SECRET);
console.log('  GITHUB_TOKEN set     =', !!clientEnv.GITHUB_TOKEN);
console.log('  GITHUB_OWNER/REPO    =', clientEnv.GITHUB_OWNER || '(unset)', '/', clientEnv.GITHUB_REPO || '(unset)');

console.log('\nNodeLx-only values:');
console.log('  PORT                 =', nodeEnv.PORT);
console.log('  GITHUB_PAT set       =', !!nodeEnv.GITHUB_PAT);
console.log('  SUPABASE_URL         =', nodeEnv.SUPABASE_URL);
console.log('  SUPABASE_SERVICE set =', !!nodeEnv.SUPABASE_SERVICE_ROLE_KEY);

console.log('\nClient login route expectations:');
const loginRoute = fs.readFileSync(`${__dirname}/../../websites-TWS/williamb_constuction/app/api/admin/login/route.ts`, 'utf8');
console.log(loginRoute.split('\n').filter((l) => /process\.env|cookie|Cookie/.test(l)).join('\n'));
