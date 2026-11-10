// Import the Slow Leaks guide into NODELKX via the Spindler admin API.
// Reads the guide content from the Spindler repo's lib/slow-leaks-guide.ts by
// transpiling it with the TypeScript compiler (available in the Spindler repo).
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const SPINDLER = '/Users/thelegendofzjui/Documents/GitHub/websites-TWS/spindler-constructionv3';
const read = (f) => (fs.existsSync(f) ? dotenv.parse(fs.readFileSync(f)) : {});
const env = { ...read(path.join(SPINDLER, '.env')), ...read(path.join(SPINDLER, '.env.local')) };

// Transpile the guide module to extract SLOW_LEAKS_GUIDE.
const ts = require(path.join(SPINDLER, 'node_modules', 'typescript'));
const src = fs.readFileSync(path.join(SPINDLER, 'lib', 'slow-leaks-guide.ts'), 'utf8');
const js = ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

// Evaluate the transpiled module in a sandbox that stubs the @/components import.
const Module = require('module');
const m = new Module('slow-leaks-guide', module);
m.filename = path.join(SPINDLER, 'lib', 'slow-leaks-guide.ts');
m.paths = module.paths;
m.require = (id) => {
  if (id === '@/components/BlogPost') return {}; // type-only import, no runtime value needed
  return require(id);
};
m._compile(js, m.filename);
const guide = m.exports.SLOW_LEAKS_GUIDE;

if (!guide || !guide.slug) {
  console.error('Failed to load SLOW_LEAKS_GUIDE');
  process.exit(1);
}

const headers = {
  'Content-Type': 'application/json',
  Cookie: 'admin_session=' + encodeURIComponent(env.ADMIN_SECRET || ''),
};

(async () => {
  const res = await fetch('http://localhost:3000/api/admin/blog', {
    method: 'POST',
    headers,
    body: JSON.stringify({ post: guide, source: 'slow-leaks-guide' }),
  });
  const data = await res.json();
  if (!res.ok || !data.post) {
    console.error('Import failed:', res.status, data.error || data);
    process.exit(1);
  }
  console.log('Imported:', data.post.slug, 'rev', data.post.revision);
  console.log('  title:', data.post.post.titleText);
  console.log('  numberedItems:', data.post.post.numberedItems?.length);
  console.log('  faq:', data.post.post.faq?.length);
})();