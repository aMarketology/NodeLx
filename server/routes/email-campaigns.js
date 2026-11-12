const express = require('express');
const crypto = require('crypto');
const { getSiteById } = require('../sites');
const { getSupabaseClient } = require('../supabase');
const { requireAuth, requireRole } = require('../auth/middleware');

const router = express.Router();
const TABLE = 'nodelx_email_campaigns';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const allowedTypes = new Set(['heading', 'paragraph', 'image', 'project', 'blog', 'cta', 'divider']);
const fonts = new Set(['Arial, sans-serif', 'Georgia, serif', 'Verdana, sans-serif', "'Palatino Linotype', 'Book Antiqua', Palatino, serif"]);
const color = (value) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
const text = (value, max) => typeof value === 'string' && value.length <= max;

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
function validPayload(draft, design) {
  if (!draft || !text(draft.name, 200) || !draft.name.trim() || !text(draft.subject, 500) || !text(draft.previewText, 1000) || !Array.isArray(draft.blocks) || draft.blocks.length > 200 || !design || !fonts.has(design.font) || !Number.isFinite(design.headingSize) || design.headingSize < 18 || design.headingSize > 36 || !Number.isFinite(design.paragraphSize) || design.paragraphSize < 12 || design.paragraphSize > 20 || !color(design.textColor) || !color(design.accentColor)) return false;
  const ids = new Set();
  return draft.blocks.every((block) => {
    if (!block || !text(block.id, 150) || !block.id || ids.has(block.id) || !allowedTypes.has(block.type)) return false;
    ids.add(block.id);
    for (const key of ['text', 'imageUrl', 'imageAlt', 'title', 'href', 'buttonLabel']) if (block[key] !== undefined && !text(block[key], 20000)) return false;
    if (block.highlights !== undefined && (!Array.isArray(block.highlights) || block.highlights.length > 200 || !block.highlights.every((h) => h && ['text', 'title', 'buttonLabel'].includes(h.field) && Number.isInteger(h.start) && Number.isInteger(h.end) && h.start >= 0 && h.end > h.start && h.end <= 20000 && color(h.color)))) return false;
    if (block.links !== undefined && (!Array.isArray(block.links) || block.links.length > 200 || !block.links.every((l) => l && ['text', 'title', 'buttonLabel'].includes(l.field) && Number.isInteger(l.start) && Number.isInteger(l.end) && l.start >= 0 && l.end > l.start && l.end <= 20000 && text(l.href, 20000) && l.href.trim()))) return false;
    return true;
  });
}
function shape(row) {
  return { id: row.id, source: row.source, draft: row.draft, design: row.design, revision: row.revision, createdAt: row.created_at, updatedAt: row.updated_at };
}
function failure(res, error) {
  console.error('[Email campaigns]', error.message);
  return res.status(503).json({ error: 'NODELKX campaign storage is unavailable. Check Supabase and the email campaign migration.' });
}
const bridge = '/api/sites/:siteId/email/campaigns';
const developer = '/api/editor/sites/:siteId/email/campaigns';

async function list(req, res) {
  try {
    const rows = [];
    for (let offset = 0; offset < 5000; offset += 200) {
      const { data, error } = await getSupabaseClient().from(TABLE).select('*').eq('site_id', req.params.siteId).order('updated_at', { ascending: false }).order('id', { ascending: true }).range(offset, offset + 199);
      if (error) return failure(res, error);
      rows.push(...data);
      if (data.length < 200) return res.set('Cache-Control', 'no-store').json({ campaigns: rows.map(shape) });
    }
    return res.status(503).json({ error: 'Too many campaigns to list. Contact the NODELKX administrator.' });
  } catch (error) { return failure(res, error); }
}
async function create(req, res) {
  const { draft, design, source } = req.body || {};
  if (!validPayload(draft, design) || (source !== undefined && source !== 'holiday-2026' && source !== 'holiday-2026-final')) return res.status(400).json({ error: 'Invalid campaign data' });
  try {
    const row = { site_id: req.params.siteId, id: crypto.randomUUID(), draft, design, source: source || null };
    const { data, error } = await getSupabaseClient().from(TABLE).insert(row).select().single();
    if (error?.code === '23505' && source) return res.status(409).json({ error: 'This starter has already been imported' });
    if (error) return failure(res, error);
    res.status(201).json({ campaign: shape(data) });
  } catch (error) { return failure(res, error); }
}
async function update(req, res) {
  const { id } = req.params;
  const { draft, design, revision } = req.body || {};
  if (!uuid.test(id) || !Number.isSafeInteger(revision) || revision < 1 || !validPayload(draft, design)) return res.status(400).json({ error: 'Invalid campaign data' });
  try {
    const { data, error } = await getSupabaseClient().from(TABLE).update({ draft, design, revision: revision + 1, updated_at: new Date().toISOString() }).eq('site_id', req.params.siteId).eq('id', id).eq('revision', revision).select().maybeSingle();
    if (error) return failure(res, error);
    if (!data) return res.status(409).json({ error: 'Campaign changed or was removed. Reload before saving; your editor remains open.' });
    res.json({ campaign: shape(data) });
  } catch (error) { return failure(res, error); }
}
router.get(bridge, apiKey, site, list);
router.post(bridge, apiKey, site, create);
router.put(`${bridge}/:id`, apiKey, site, update);
router.get(developer, requireAuth, requireRole('developer'), site, list);
module.exports = router;
