const express = require('express');
const crypto = require('crypto');
const { getSiteById } = require('../sites');
const { getSupabaseClient } = require('../supabase');
const { requireAuth, requireRole } = require('../auth/middleware');

const router = express.Router();
const TABLE = 'nodelx_blog_posts';
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const maxField = 20000;
const allowedTags = new Set(['amber', 'steel', 'slate']);
const allowedAccents = new Set(['sky', 'gold', 'pink']);

function apiKey(req, res, next) {
  const key = process.env.NODELX_API_KEY;
  if (!key) return res.status(503).json({ error: 'NODELX_API_KEY is not configured' });
  const provided = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const a = crypto.createHash('sha256').update(provided).digest();
  const b = crypto.createHash('sha256').update(key).digest();
  if (!crypto.timingSafeEqual(a, b)) return res.status(401).json({ error: 'Unauthorized' });
  next();
}
function site(req, res, next) {
  if (!getSiteById(req.params.siteId)) return res.status(404).json({ error: 'Unknown site' });
  next();
}
function isStr(value) { return typeof value === 'string' && value.length <= maxField; }
function isDate(value) { return typeof value === 'string' && !Number.isNaN(Date.parse(value)); }
function validatePost(post) {
  if (!post || typeof post !== 'object') return false;
  if (!isStr(post.slug) || !slugPattern.test(post.slug) || post.slug.length > 100) return false;
  if (!isStr(post.canonicalUrl) || !/^https:\/\//.test(post.canonicalUrl)) return false;
  if (!isDate(post.datePublished) || (post.dateModified !== undefined && post.dateModified !== null && !isDate(post.dateModified))) return false;
  if (post.keywords !== undefined && (!Array.isArray(post.keywords) || post.keywords.length > 50 || !post.keywords.every(isStr))) return false;
  if (post.author !== undefined && (!post.author || typeof post.author !== 'object' || !isStr(post.author.name) || (post.author.jobTitle !== undefined && !isStr(post.author.jobTitle)) || (post.author.image !== undefined && post.author.image !== null && !isStr(post.author.image)))) return false;
  if (!Array.isArray(post.tags) || post.tags.length === 0 || post.tags.length > 10 || !post.tags.every((t) => t && isStr(t.label) && (t.color === undefined || allowedTags.has(t.color)))) return false;
  for (const field of ['date', 'readTime', 'title', 'titleText', 'titleAccent', 'excerpt', 'excerptText', 'heroImage', 'heroImageAlt', 'heroCaption', 'bodyIntroHtml', 'bodyClosingHtml', 'relatedLinksHeading']) if (post[field] !== undefined && post[field] !== null && !isStr(post[field])) return false;
  if (!post.titleText && !isStr(post.title)) return false;
  if (!isStr(post.heroImage) || !isStr(post.heroImageAlt)) return false;
  if (!Array.isArray(post.breadcrumb) || post.breadcrumb.length === 0 || !post.breadcrumb.every((b) => b && isStr(b.label))) return false;
  if (post.numberedItems !== undefined && (!Array.isArray(post.numberedItems) || post.numberedItems.length > 100 || !post.numberedItems.every((i) => i && isStr(i.num) && isStr(i.title) && isStr(i.stat) && isStr(i.body) && isStr(i.source) && (i.sourceUrl === null || i.sourceUrl === undefined || isStr(i.sourceUrl)) && allowedAccents.has(i.accent)))) return false;
  if (post.statCards !== undefined && (!Array.isArray(post.statCards) || post.statCards.length > 50 || !post.statCards.every((c) => c && isStr(c.value) && isStr(c.label)))) return false;
  if (post.faq !== undefined && (!Array.isArray(post.faq) || post.faq.length > 50 || !post.faq.every((f) => f && isStr(f.question) && isStr(f.answer)))) return false;
  if (post.relatedLinks !== undefined && (!Array.isArray(post.relatedLinks) || post.relatedLinks.length > 20 || !post.relatedLinks.every((l) => l && isStr(l.label) && isStr(l.href) && isStr(l.desc)))) return false;
  if (post.relatedArticles !== undefined && (!Array.isArray(post.relatedArticles) || post.relatedArticles.length > 10 || !post.relatedArticles.every((a) => a && isStr(a.title) && isStr(a.href) && isStr(a.tag)))) return false;
  if (post.cta !== undefined && (!post.cta || typeof post.cta !== 'object' || !isStr(post.cta.heading) || !isStr(post.cta.body) || !isStr(post.cta.primaryLabel) || !isStr(post.cta.primaryHref) || (post.cta.secondaryLabel !== undefined && !isStr(post.cta.secondaryLabel)) || (post.cta.secondaryHref !== undefined && !isStr(post.cta.secondaryHref)) || (post.cta.badge !== undefined && !isStr(post.cta.badge)))) return false;
  return true;
}
function shape(row) {
  return { slug: row.slug, source: row.source, post: row.post, revision: row.revision, createdAt: row.created_at, updatedAt: row.updated_at };
}
function failure(res, error) {
  console.error('[Blog posts]', error.message);
  return res.status(503).json({ error: 'NODELKX blog storage is unavailable. Check Supabase and the blog migration.' });
}
const bridge = '/api/sites/:siteId/blog/posts';
const developer = '/api/editor/sites/:siteId/blog/posts';

async function list(req, res) {
  try {
    const rows = [];
    for (let offset = 0; offset < 5000; offset += 200) {
      const { data, error } = await getSupabaseClient().from(TABLE).select('*').eq('site_id', req.params.siteId).order('updated_at', { ascending: false }).order('slug', { ascending: true }).range(offset, offset + 199);
      if (error) return failure(res, error);
      rows.push(...data);
      if (data.length < 200) return res.set('Cache-Control', 'no-store').json({ posts: rows.map(shape) });
    }
    return res.status(503).json({ error: 'Too many posts to list. Contact the NODELKX administrator.' });
  } catch (error) { return failure(res, error); }
}
async function create(req, res) {
  const { post, source } = req.body || {};
  if (!validatePost(post) || (source !== undefined && source !== 'slow-leaks-guide')) return res.status(400).json({ error: 'Invalid blog post' });
  try {
    const row = { site_id: req.params.siteId, slug: post.slug, post, source: source || null };
    const { data, error } = await getSupabaseClient().from(TABLE).insert(row).select().single();
    if (error?.code === '23505') return res.status(409).json({ error: 'A post with this slug already exists.' });
    if (error) return failure(res, error);
    res.status(201).json({ post: shape(data) });
  } catch (error) { return failure(res, error); }
}
async function update(req, res) {
  const { slug } = req.params;
  const { post, revision } = req.body || {};
  if (!slugPattern.test(slug) || !Number.isSafeInteger(revision) || revision < 1 || !validatePost(post) || post.slug !== slug) return res.status(400).json({ error: 'Invalid blog post' });
  try {
    const { data, error } = await getSupabaseClient().from(TABLE).update({ post, revision: revision + 1, updated_at: new Date().toISOString() }).eq('site_id', req.params.siteId).eq('slug', slug).eq('revision', revision).select().maybeSingle();
    if (error) return failure(res, error);
    if (!data) return res.status(409).json({ error: 'Post changed or was removed. Reload before saving; your editor remains open.' });
    res.json({ post: shape(data) });
  } catch (error) { return failure(res, error); }
}
async function get(req, res) {
  const { slug } = req.params;
  if (!slugPattern.test(slug)) return res.status(400).json({ error: 'Invalid slug' });
  try {
    const { data, error } = await getSupabaseClient().from(TABLE).select('*').eq('site_id', req.params.siteId).eq('slug', slug).maybeSingle();
    if (error) return failure(res, error);
    if (!data) return res.status(404).json({ error: 'Post not found' });
    res.set('Cache-Control', 'no-store').json({ post: shape(data) });
  } catch (error) { return failure(res, error); }
}
router.get(bridge, apiKey, site, list);
router.get(`${bridge}/:slug`, apiKey, site, get);
router.post(bridge, apiKey, site, create);
router.put(`${bridge}/:slug`, apiKey, site, update);
router.get(developer, requireAuth, requireRole('developer'), site, list);
module.exports = router;
