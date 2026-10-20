#!/usr/bin/env node
/**
 * scripts/backfill-blog.js
 * ---------------------------------------------------------------------------
 * Backfills the Austin Web Services blog into the NodeLx CMS.
 *
 *   node scripts/backfill-blog.js <path-to-AWS-repo> [--commit] [--out <file>]
 *
 * What it does:
 *   1. Walks <aws>/app/blog/ (recursively) for `const POST: BlogPostData = {...}`.
 *   2. Bundles each post with esbuild (stubbing next/* imports so React-only
 *      JSX compiles and evaluates in plain Node).
 *   3. Renders the post's `children:` JSX to static HTML via ReactDOMServer so
 *      the full body is editable (as bodyIntroHtml) through the blog editor.
 *   4. Emits a JSON array of BlogPostData to content/blog.json.
 *   5. With --commit, pushes content/blog.json to the client repo via GitSync.
 *
 * This turns the previously hardcoded static posts into NodeLx-managed
 * content, making every field — including the slug (URL) — editable.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const vm = require('vm');
const { build } = require('esbuild');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const jsxRuntime = require('react/jsx-runtime');

// ─── Config ────────────────────────────────────────────────────────────────
const OWNER = process.env.GITHUB_OWNER || 'aMarketology';
const REPO = process.env.GITHUB_REPO || 'Austin-Web-Services';
const BRANCH = process.env.GITHUB_BRANCH || 'main';

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const positionals = args.filter((a) => !a.startsWith('--'));
const AWS_ROOT = positionals[0] ? path.resolve(positionals[0]) : path.resolve(__dirname, '../../Austin-Web-Services');
const verbose = flags.has('--verbose');
const doCommit = flags.has('--commit');
const outIdx = args.indexOf('--out');
const OUT_FILE = outIdx >= 0 && args[outIdx + 1] ? path.resolve(args[outIdx + 1]) : path.join(AWS_ROOT, 'content', 'blog.json');

const log = (...a) => console.log(...a);
const vlog = (...a) => { if (verbose) console.log(...a); };

// ─── Discovery ─────────────────────────────────────────────────────────────
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : (e.name === 'page.tsx' ? [p] : []);
  });
}

function repoRelFor(abs) {
  return path.relative(AWS_ROOT, abs).split(path.sep).join('/');
}

// ─── esbuild next/* stubs ──────────────────────────────────────────────────
// Blog posts only import `next`, `next/link`, `next/navigation` for metadata
// and links that don't affect the POST data. We stub them so the bundle is a
// plain React module that can run under Node. React itself is marked external
// (resolved at eval time) so the bundle is lean and has no `process` refs.
// NOTE: stubs are ESM so esbuild's __toESM interop doesn't double-wrap the
// default export.
const NEXT_STUBS = {
  'next': 'export default {};',
  'next/link': "import React from 'react'; export default function Link({ children, href, ...rest }) { return React.createElement('a', { href, ...rest }, children); }",
  'next/navigation': 'export function redirect() {} export function notFound() {} export function useRouter() { return { push: () => {} }; }',
};

const EXTERNAL_REACT = ['react', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react-dom', 'react-dom/server', 'react-dom/client'];

// ─── Bundle a post source to a CJS module that exports { POST } ─────────────
async function bundlePost(src, absFile) {
  const absDir = path.dirname(absFile);
  const result = await build({
    stdin: { contents: src, resolveDir: absDir, loader: 'tsx', sourcefile: path.basename(absFile) },
    bundle: true,
    platform: 'node',
    format: 'cjs',
    write: false,
    jsx: 'automatic',
    target: 'es2020',
    logLevel: 'silent',
    external: EXTERNAL_REACT,
    plugins: [
      {
        name: 'next-and-alias-stubs',
        setup(b) {
          // Stub next/* imports
          b.onResolve({ filter: /^next(\/.*)?$/ }, (args) => ({ path: args.path, namespace: 'stub' }));
          // Stub the BlogPost component import (the POST object never calls it —
          // it's only used by `export default function ... { <BlogPost post={POST}/> }`).
          b.onResolve({ filter: /components\/BlogPost$/ }, () => ({ path: 'blogpost-stub', namespace: 'stub' }));
          // General @/ fallback (POST objects never use these; safety net only).
          b.onResolve({ filter: /^@\// }, (args) => ({ path: args.path, namespace: 'alias-stub' }));

          // Single loader per namespace so the specific stub always wins.
          b.onLoad({ filter: /.*/, namespace: 'stub' }, (args) => {
            if (args.path === 'blogpost-stub') {
              return { contents: 'export default function BlogPost(){ return null; } export { BlogPost };', loader: 'js' };
            }
            return { contents: NEXT_STUBS[args.path] || 'export default {};', loader: 'js' };
          });
          b.onLoad({ filter: /.*/, namespace: 'alias-stub' }, () => ({ contents: 'export default {};', loader: 'js' }));
        },
      },
    ],
  });

  if (result.errors && result.errors.length) {
    const msgs = result.errors.map((e) => e.text).join('\n');
    throw new Error('bundle errors:\n' + msgs);
  }
  // The POST const is internal to the bundled module (not exported), so append
  // an explicit export line so evalPostModule can read it.
  return result.outputFiles[0].text + '\nmodule.exports.POST = typeof POST !== "undefined" ? POST : null;\n';
}

// ─── Evaluate a bundled CJS module and return its `POST` export ────────────
function evalPostModule(code) {
  const module = { exports: {} };
  const requireShim = (id) => {
    if (id === 'react') return React;
    if (id === 'react/jsx-runtime') return jsxRuntime;
    if (id === 'react/jsx-dev-runtime') return jsxRuntime;
    if (id === 'react-dom/server') return { renderToStaticMarkup };
    if (id === 'react-dom' || id === 'react-dom/client') return {};
    if (id === 'next/link' || id === 'next' || id === 'next/navigation') return {};
    return require(id);
  };
  const sandbox = vm.createContext({
    process,
    Buffer,
    console,
    setTimeout,
    clearTimeout,
    global,
  });
  const fn = vm.runInContext(
    `(function(require,module,exports){${code}\n})`,
    sandbox,
    { filename: 'bundle.cjs' }
  );
  fn(requireShim, module, module.exports);
  return module.exports;
}

// ─── Render a ReactNode to static HTML ─────────────────────────────────────
function renderChildrenToHtml(children) {
  try {
    if (Array.isArray(children)) {
      return renderToStaticMarkup(React.createElement(React.Fragment, null, ...children));
    }
    return renderToStaticMarkup(React.createElement(React.Fragment, null, children));
  } catch (e) {
    vlog(`  children render failed: ${e.message}`);
    return '';
  }
}

// ─── Sanitize for JSON + editor round-trip ────────────────────────────────
// React nodes (title/excerpt) become strings; functions/spread artifacts drop.
function cleanPost(raw, rel) {
  const slugFromPath = '/' + rel.replace(/^app\/blog\//, '').replace(/\/page\.tsx$/, '');
  const p = { ...raw };

  // Render ReactNode title/excerpt to plain strings where present.
  if (p.title != null && typeof p.title !== 'string') {
    const html = renderChildrenToHtml(p.title);
    p.titleText = p.titleText ?? html.replace(/<[^>]+>/g, '');
    delete p.title;
  }
  if (p.excerpt != null && typeof p.excerpt !== 'string') {
    const html = renderChildrenToHtml(p.excerpt);
    p.excerptText = p.excerptText ?? html.replace(/<[^>]+>/g, '');
    delete p.excerpt;
  }

  // Render body `children` JSX to HTML and store as bodyIntroHtml so the
  // editor + dynamic renderer reproduce the full article.
  if (p.children != null) {
    const html = renderChildrenToHtml(p.children);
    if (html) p.bodyIntroHtml = html;
    delete p.children;
  }

  // Normalize metadata required by the CMS / dynamic renderer.
  p.slug = p.slug || slugFromPath;
  p.canonicalUrl = p.canonicalUrl || `https://www.austin-web-services.com${p.slug}`;
  p.titleText = p.titleText || '(Untitled)';
  p.excerptText = p.excerptText || '';
  p.datePublished = p.datePublished || '2026-01-01';
  p.dateModified = p.dateModified || p.datePublished;
  p.keywords = p.keywords || [];
  p.tags = p.tags || [{ label: 'Blog', color: 'sky' }];
  p.breadcrumb = p.breadcrumb || [{ label: p.titleText }];
  p._sourceFile = rel;

  // Strip any non-serializable leftovers.
  return JSON.parse(JSON.stringify(p, (k, v) => (typeof v === 'function' ? undefined : v)));
}

// ─── Main ──────────────────────────────────────────────────────────────────
async function main() {
  if (!fs.existsSync(AWS_ROOT)) {
    console.error(`AWS repo not found: ${AWS_ROOT}`);
    process.exit(1);
  }
  const blogDir = path.join(AWS_ROOT, 'app', 'blog');
  if (!fs.existsSync(blogDir)) {
    console.error(`No app/blog directory under ${AWS_ROOT}`);
    process.exit(1);
  }

  const files = walk(blogDir);
  log(`Found ${files.length} blog page.tsx files.`);

  const posts = [];
  const skipped = [];
  const failures = [];

  for (const file of files) {
    const rel = repoRelFor(file);
    const src = fs.readFileSync(file, 'utf8');
    if (!/const\s+POST\s*:?\s*(?:BlogPostData\s*)?=/.test(src)) {
      skipped.push(rel);
      continue;
    }

    try {
      const code = await bundlePost(src, file);
      const mod = evalPostModule(code);
      const post = mod.POST;
      if (!post) throw new Error('no POST export');
      const cleaned = cleanPost(post, rel);
      posts.push(cleaned);
      vlog(`✓ ${rel} → ${cleaned.slug}`);
    } catch (e) {
      failures.push({ rel, error: e.message.split('\n')[0] });
      vlog(`✗ ${rel}: ${e.message.split('\n')[0]}`);
    }
  }

  posts.sort((a, b) => (b.datePublished || '').localeCompare(a.datePublished || ''));

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(posts, null, 2), 'utf8');
  log(`\nWrote ${posts.length} posts → ${OUT_FILE}`);
  log(`Skipped ${skipped.length} non-POST pages.`);
  if (failures.length) {
    log(`\nFailed ${failures.length} files:`);
    for (const f of failures) log(`  - ${f.rel}: ${f.error}`);
  }

  if (doCommit) {
    log('\nCommitting content/blog.json via GitSync…');
    const GitSync = require('../server/gitSync');
    const { getSiteById } = require('../server/sites');
    const site = getSiteById('austin-web-services') || { id: 'austin-web-services', repo: `${OWNER}/${REPO}`, branch: BRANCH };
    const git = new GitSync();
    if (!git.isConfigured()) {
      log('✗ GITHUB_PAT not configured — set it in .env first.');
    } else {
      try {
        const body = JSON.stringify(posts, null, 2);
        const commit = await git.commitFile(site, 'content/blog.json', body, 'content: backfill blog.json from static posts');
        log(`✓ Committed ${commit.sha} → ${commit.commitUrl || 'n/a'}`);
      } catch (e) {
        log(`✗ Commit failed: ${e.message}`);
      }
    }
  }
}

main().catch((e) => {
  console.error('Backfill failed:', e);
  process.exit(1);
});
