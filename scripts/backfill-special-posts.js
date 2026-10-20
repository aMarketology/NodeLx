#!/usr/bin/env node
/**
 * scripts/backfill-special-posts.js
 * ---------------------------------------------------------------------------
 * Converts the two blog posts that do NOT use the shared <BlogPost> component
 * (they use <ArticlePage> and <JackArticle>) into the BlogPostData CMS shape so
 * every post on the site is NodeLx-editable.
 *
 *   node scripts/backfill-special-posts.js <path-to-AWS-repo> [--commit]
 *
 * Approach: extract the JSX *children* passed to the layout component (not the
 * full page), render them to static HTML via ReactDOMServer, and emit a
 * BlogPostData object whose bodyIntroHtml holds that body. Title/excerpt/hero
 * become metadata so <BlogPost> renders the shared chrome exactly once.
 */

const fs = require('fs');
const path = require('path');
const { build } = require('esbuild');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const jsxRuntime = require('react/jsx-runtime');

const OWNER = process.env.GITHUB_OWNER || 'aMarketology';
const REPO = process.env.GITHUB_REPO || 'Austin-Web-Services';
const BRANCH = process.env.GITHUB_BRANCH || 'main';

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const positionals = args.filter((a) => !a.startsWith('--'));
const AWS_ROOT = positionals[0] ? path.resolve(positionals[0]) : path.resolve(__dirname, '../../Austin-Web-Services');
const doCommit = flags.has('--commit');
const BLOG_JSON = path.join(AWS_ROOT, 'content', 'blog.json');

const log = (...a) => console.log(...a);

// ─── Resolve @/ alias with explicit extension probing ──────────────────────
function resolveAlias(p) {
  const rel = p.slice(2);
  const base = path.join(AWS_ROOT, rel);
  for (const ext of ['.tsx', '.ts', '.jsx', '.js', '/index.tsx', '/index.ts', '/index.js']) {
    if (fs.existsSync(base + ext)) return base + ext;
  }
  return null;
}

// ─── Extract the JSX children between a layout component's opening and
// closing tags (e.g. everything inside <ArticlePage>…</ArticlePage>). ───────
function extractChildren(src, tagName) {
  const openRe = new RegExp(`<${tagName}\\b`);
  const openM = openRe.exec(src);
  if (!openM) return null;
  const openIdx = openM.index;

  // Walk from the opening `<Tag` to find the `>` that ends its opening tag,
  // tracking {}, (), [] and string/comment state (props contain JSX arrays).
  let i = src.indexOf('<', openIdx);
  let depth = 0;
  let inStr = null;
  let inLine = false;
  let inBlock = false;
  let gt = -1;
  for (; i < src.length; i++) {
    const c = src[i];
    const n = src[i + 1];
    if (inLine) { if (c === '\n') inLine = false; continue; }
    if (inBlock) { if (c === '*' && n === '/') { inBlock = false; i++; } continue; }
    if (inStr) { if (c === '\\') { i++; continue; } if (c === inStr) inStr = null; continue; }
    if (c === '/' && n === '/') { inLine = true; i++; continue; }
    if (c === '/' && n === '*') { inBlock = true; i++; continue; }
    if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (c === '[') depth++;
    else if (c === ']') depth--;
    else if (c === '>' && depth === 0) { gt = i; break; }
  }
  if (gt === -1) return null;

  // Find the LAST closing tag (the component wraps all children).
  const closeRe = new RegExp(`</${tagName}>`, 'g');
  let closeIdx = -1;
  let m;
  while ((m = closeRe.exec(src)) !== null) closeIdx = m.index;

  if (closeIdx <= gt) return null;
  return src.slice(gt + 1, closeIdx);
}

// ─── Bundle + render a JSX fragment to static HTML ─────────────────────────
async function renderFragment(wrapperSrc, resolveDir) {
  const result = await build({
    stdin: { contents: wrapperSrc, resolveDir, loader: 'tsx', sourcefile: 'fragment.tsx' },
    bundle: true,
    platform: 'node',
    format: 'cjs',
    write: false,
    jsx: 'automatic',
    target: 'es2020',
    logLevel: 'silent',
    external: ['react', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react-dom', 'react-dom/server', 'react-dom/client'],
    plugins: [{
      name: 'stubs',
      setup(b) {
        b.onResolve({ filter: /^next(\/.*)?$/ }, (a) => ({ path: a.path, namespace: 'stub' }));
        b.onLoad({ filter: /.*/, namespace: 'stub' }, (a) => ({
          contents:
            a.path === 'next/link'
              ? "import React from 'react'; export default function Link({children,href,...r}){return React.createElement('a',{href,...r},children);}"
              : a.path === 'next/image'
                ? "import React from 'react'; export default function Image(props){return React.createElement('img',props);}"
                : 'export default {};',
          loader: 'js',
        }));
        b.onResolve({ filter: /^@\// }, (a) => {
          const resolved = resolveAlias(a.path);
          return resolved ? { path: resolved } : { path: a.path, namespace: 'alias-stub' };
        });
        b.onLoad({ filter: /.*/, namespace: 'alias-stub' }, () => ({ contents: 'export default {};', loader: 'js' }));
      },
    }],
  });

  if (result.errors && result.errors.length) {
    throw new Error(result.errors.map((e) => e.text).join('\n'));
  }

  const code = result.outputFiles[0].text;
  const module = { exports: {} };
  const requireShim = (id) => {
    if (id === 'react') return React;
    if (id === 'react/jsx-runtime') return jsxRuntime;
    if (id === 'react/jsx-dev-runtime') return jsxRuntime;
    if (id === 'react-dom/server') return { renderToStaticMarkup };
    return require(id);
  };
  const fn = new Function('require', 'module', 'exports', code);
  fn(requireShim, module, module.exports);
  const Component = module.exports.default;
  return renderToStaticMarkup(React.createElement(Component, {}));
}

// ─── Per-post definition (metadata hand-curated from the source file) ─────
const SPECIAL_POSTS = [
  {
    file: 'app/blog/5-signs-your-website-needs-a-redesign/page.tsx',
    layoutTag: 'ArticlePage',
    imports: "import { Section, TableOfContents, Quote, DataTable, Notice, RelatedLinks } from '@/app/components/ArticlePage';\nimport Link from 'next/link';",
    slug: '/blog/5-signs-your-website-needs-a-redesign',
    titleText: '5 Signs Your Small Business Website Needs a Redesign',
    titleAccent: 'Needs a Redesign',
    excerptText: 'Is your Austin business website costing you customers? Here are 5 clear warning signs it is time for a website redesign — and what a modern site should do instead.',
    tags: [{ label: 'Web Design', color: 'violet' }],
    date: 'April 22, 2026',
    datePublished: '2026-04-22',
    readTime: '8 min read',
    heroImage: 'https://images.unsplash.com/photo-1467232004584-a241de8bcf5d?w=1400&q=80',
    heroImageAlt: 'Modern responsive website design on desktop and mobile',
    breadcrumb: [{ label: 'Blog', href: '/blog' }, { label: 'Website Redesign Signs' }],
    keywords: ['website redesign austin', 'small business website redesign', 'website redesign signs', 'outdated business website', 'web design austin texas'],
  },
  {
    file: 'app/blog/local-seo-austin-complete-guide/page.tsx',
    layoutTag: 'JackArticle',
    imports: "import { JackSection, JackSubheading, JackCallout, JackStats, JackProcess, JackCard, JackCardGrid, JackCaseOverview, JackIndicatorGrid, JackQuote } from '@/app/components/JackArticle';",
    slug: '/blog/local-seo-austin-complete-guide',
    titleText: 'Local SEO for Austin Businesses: The Complete 2026 Guide',
    titleAccent: 'The Complete 2026 Guide',
    excerptText: 'The definitive local SEO guide for Austin, TX businesses. Learn how to rank on Google Maps, optimize your Google Business Profile, build citations, and generate consistent inbound leads from organic search.',
    tags: [{ label: 'Local SEO', color: 'emerald' }],
    date: 'April 22, 2026',
    datePublished: '2026-04-22',
    readTime: '14 min read',
    heroImage: 'https://images.unsplash.com/photo-1573164713988-8665fc963095?w=1400&q=80',
    heroImageAlt: 'Local SEO strategy for Austin Texas businesses on a laptop',
    breadcrumb: [{ label: 'Blog', href: '/blog' }, { label: 'Local SEO Austin Guide' }],
    keywords: ['local seo austin', 'local seo austin tx', 'seo for austin businesses', 'google maps ranking austin', 'austin local search optimization'],
  },
];

async function main() {
  const existing = JSON.parse(fs.readFileSync(BLOG_JSON, 'utf8'));
  const bySlug = new Map(existing.map((p) => [p.slug, p]));
  let added = 0;

  for (const def of SPECIAL_POSTS) {
    const file = path.join(AWS_ROOT, def.file);
    if (!fs.existsSync(file)) {
      log(`✗ missing ${def.file}, skipping`);
      continue;
    }
    try {
      const src = fs.readFileSync(file, 'utf8');
      const children = extractChildren(src, def.layoutTag);
      if (!children) throw new Error('could not extract children');
      const wrapperSrc = `${def.imports}\nconst __frag = (\n  <>\n${children}\n  </>\n);\nexport default function Wrapper(){ return __frag; }`;
      const html = await renderFragment(wrapperSrc, path.dirname(file));
      const post = {
        slug: def.slug,
        canonicalUrl: `https://www.austin-web-services.com${def.slug}`,
        datePublished: def.datePublished,
        dateModified: def.datePublished,
        schemaType: 'Article',
        articleSection: 'Blog',
        keywords: def.keywords,
        tags: def.tags,
        date: def.date,
        readTime: def.readTime,
        titleText: def.titleText,
        titleAccent: def.titleAccent,
        excerptText: def.excerptText,
        heroImage: def.heroImage,
        heroImageAlt: def.heroImageAlt,
        breadcrumb: def.breadcrumb,
        bodyIntroHtml: html,
        _sourceFile: def.file,
      };
      bySlug.set(def.slug, post);
      added++;
      log(`✓ ${def.slug} (body ${html.length} chars)`);
    } catch (e) {
      log(`✗ ${def.slug}: ${e.message.split('\n')[0]}`);
    }
  }

  const merged = [...bySlug.values()].sort((a, b) => (b.datePublished || '').localeCompare(a.datePublished || ''));
  fs.writeFileSync(BLOG_JSON, JSON.stringify(merged, null, 2), 'utf8');
  log(`\nWrote ${merged.length} posts total (+${added} special) → ${BLOG_JSON}`);

  if (doCommit) {
    log('\nCommitting content/blog.json via GitSync…');
    const GitSync = require('../server/gitSync');
    const { getSiteById } = require('../server/sites');
    const site = getSiteById('austin-web-services') || { id: 'austin-web-services', repo: `${OWNER}/${REPO}`, branch: BRANCH };
    const git = new GitSync();
    if (!git.isConfigured()) {
      log('✗ GITHUB_PAT not configured.');
    } else {
      const commit = await git.commitFile(site, 'content/blog.json', JSON.stringify(merged, null, 2), 'content: backfill special blog posts');
      log(`✓ Committed ${commit.sha}`);
    }
  }
}

main().catch((e) => {
  console.error('Special-post backfill failed:', e);
  process.exit(1);
});
