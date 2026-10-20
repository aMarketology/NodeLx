#!/usr/bin/env node
/**
 * scripts/archive-static-blog.js
 * ---------------------------------------------------------------------------
 * Moves the now-backfilled static blog post directories out of app/blog/ so the
 * dynamic catch-all route app/blog/[...slug]/page.tsx serves every post from
 * content/blog.json (NodeLx CMS).
 *
 *   node scripts/archive-static-blog.js <path-to-AWS-repo> [--dry-run]
 *
 * What it archives:
 *   - every leaf post directory under app/blog/ (page.tsx with `const POST`,
 *     ArticlePage, JackArticle, or a redirect) EXCEPT:
 *       • app/blog/email       (category hub page)
 *       • app/blog/[...slug]   (the dynamic CMS route)
 *       • app/blog/page.tsx    (the blog index)
 *       • app/blog/BlogClient.tsx
 *   - then removes now-empty archive container dirs (auto-body, hvac, etc.).
 *
 * Files are moved to content/blog-static-backup/ (gitignored) preserving their
 * relative paths, so nothing is destroyed.
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const AWS_ROOT = path.resolve(args[0] || path.resolve(__dirname, '../../Austin-Web-Services'));
const dryRun = args.includes('--dry-run');

const BLOG_DIR = path.join(AWS_ROOT, 'app', 'blog');
const BACKUP_ROOT = path.join(AWS_ROOT, 'content', 'blog-static-backup');

// Top-level names to KEEP (not posts).
const KEEP = new Set(['email', '[...slug]', 'page.tsx', 'BlogClient.tsx']);

// Archive container dirs (no page.tsx at top level, just nested dated folders).
const CONTAINERS = new Set(['auto-body', 'business', 'healthcare', 'hvac', 'pools', 'remodel', 'seo', 'technical']);

function isPostDir(absDir) {
  const p = path.join(absDir, 'page.tsx');
  if (!fs.existsSync(p)) return false;
  const src = fs.readFileSync(p, 'utf8');
  return (
    /const\s+POST\s*:?\s*(?:BlogPostData\s*)?=/.test(src) ||
    /<ArticlePage\b/.test(src) ||
    /<JackArticle\b/.test(src) ||
    /redirect\(/.test(src)
  );
}

function walkDirs(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (!e.isDirectory()) return [];
    const p = path.join(dir, e.name);
    return [p, ...walkDirs(p)];
  });
}

function move(from, to) {
  if (dryRun) {
    console.log(`[dry-run] move ${from} -> ${to}`);
    return;
  }
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.renameSync(from, to);
}

async function main() {
  if (!fs.existsSync(BLOG_DIR)) {
    console.error(`No app/blog under ${AWS_ROOT}`);
    process.exit(1);
  }

  const allDirs = walkDirs(BLOG_DIR);
  const postDirs = allDirs.filter(isPostDir);
  let archived = 0;

  for (const dir of postDirs) {
    const rel = path.relative(BLOG_DIR, dir).split(path.sep).join('/');
    const top = rel.split('/')[0];
    if (KEEP.has(top) || top.includes('[...slug]')) {
      console.log(`  SKIP (protected): ${rel}`);
      continue;
    }
    const dest = path.join(BACKUP_ROOT, rel);
    move(dir, dest);
    archived++;
    console.log(`✓ ${rel}`);
  }

  // Remove now-empty container dirs (only if dry-run is off and they're empty).
  for (const c of CONTAINERS) {
    const p = path.join(BLOG_DIR, c);
    if (fs.existsSync(p) && fs.readdirSync(p).length === 0) {
      if (dryRun) {
        console.log(`[dry-run] rmdir ${p}`);
      } else {
        fs.rmdirSync(p);
        console.log(`✓ removed empty container ${c}/`);
      }
    }
  }

  console.log(`\nArchived ${archived} static post directories.`);
  if (dryRun) console.log('(dry run — no changes made)');
}

main().catch((e) => {
  console.error('Archive failed:', e);
  process.exit(1);
});
