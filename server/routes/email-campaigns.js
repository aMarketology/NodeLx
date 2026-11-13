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
const headingFonts = new Set(['Arial, sans-serif', 'Georgia, serif', '"Playfair Display", Georgia, serif', 'Copperplate, "Copperplate Gothic Light", Georgia, serif', '"Snell Roundhand", "Brush Script MT", cursive', "'Palatino Linotype', 'Book Antiqua', Palatino, serif"]);
const comboIds = new Set(['basic', 'classic-serif', 'holiday', 'holiday-christmas', 'holiday-pine', 'holiday-gold', 'holiday-engraved', 'holiday-script', 'modern']);
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
  if (!draft || typeof draft !== 'object') return 'A draft object is required.';
  if (!text(draft.name, 200) || !draft.name.trim()) return 'The campaign name is required and must be 200 characters or fewer.';
  if (!text(draft.subject, 500)) return 'The subject line is required and must be 500 characters or fewer.';
  if (!text(draft.previewText, 1000)) return 'The preview text must be 1000 characters or fewer.';
  if (!Array.isArray(draft.blocks) || draft.blocks.length > 200) return 'The draft must contain between 1 and 200 blocks.';
  if (!design || typeof design !== 'object') return 'A design object is required.';
  if (!fonts.has(design.font)) return `Unsupported body font: "${design.font}".`;
  if (design.headingFont !== undefined && !headingFonts.has(design.headingFont)) return `Unsupported heading font: "${design.headingFont}".`;
  if (design.fontComboId !== undefined && !comboIds.has(design.fontComboId)) return `Unsupported font combo: "${design.fontComboId}".`;
  if (!Number.isFinite(design.headingSize) || design.headingSize < 18 || design.headingSize > 56) return 'Heading size must be between 18 and 56.';
  if (!Number.isFinite(design.paragraphSize) || design.paragraphSize < 12 || design.paragraphSize > 20) return 'Paragraph size must be between 12 and 20.';
  if (!color(design.textColor)) return 'Text color must be a 6-digit hex color like #34506a.';
  if (!color(design.accentColor)) return 'Accent color must be a 6-digit hex color like #2e86c1.';
  const ids = new Set();
  for (const block of draft.blocks) {
    if (!block || typeof block !== 'object') return 'Every block must be an object.';
    if (!text(block.id, 150) || !block.id) return 'Every block needs an id.';
    if (ids.has(block.id)) return `Duplicate block id: "${block.id}".`;
    ids.add(block.id);
    if (!allowedTypes.has(block.type)) return `Unsupported block type: "${block.type}".`;
    for (const key of ['text', 'imageUrl', 'imageAlt', 'title', 'href', 'buttonLabel']) if (block[key] !== undefined && !text(block[key], 20000)) return `The block's "${key}" is too long.`;
    if (block.highlights !== undefined && (!Array.isArray(block.highlights) || block.highlights.length > 200 || !block.highlights.every((h) => h && ['text', 'title', 'buttonLabel'].includes(h.field) && Number.isInteger(h.start) && Number.isInteger(h.end) && h.start >= 0 && h.end > h.start && h.end <= 20000 && color(h.color)))) return 'A highlight is invalid (check its range and color).';
    if (block.links !== undefined && (!Array.isArray(block.links) || block.links.length > 200 || !block.links.every((l) => l && ['text', 'title', 'buttonLabel'].includes(l.field) && Number.isInteger(l.start) && Number.isInteger(l.end) && l.start >= 0 && l.end > l.start && l.end <= 20000 && text(l.href, 20000) && l.href.trim()))) return 'An inline link is invalid (check its range and destination).';
    if (block.align !== undefined && !['left', 'center', 'right'].includes(block.align)) return `Unsupported alignment: "${block.align}".`;
    if (block.spacing !== undefined && !['none', 'small', 'normal', 'large'].includes(block.spacing)) return `Unsupported spacing: "${block.spacing}".`;
    if (block.imageWidth !== undefined && (!Number.isFinite(block.imageWidth) || block.imageWidth < 1 || block.imageWidth > 1000)) return 'Image width must be between 1 and 1000.';
  }
  return null;
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
      if (data.length < 200) break;
    }
    res.json({ campaigns: rows.map(shape) });
  } catch (error) { return failure(res, error); }
}

async function create(req, res) {
  const { draft, design, source } = req.body || {};
  const invalid = validPayload(draft, design);
  if (invalid) return res.status(400).json({ error: invalid });
  if (source !== undefined && source !== 'holiday-2026' && source !== 'holiday-2026-final') return res.status(400).json({ error: `Unsupported campaign source: "${source}".` });
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
  if (!uuid.test(id)) return res.status(400).json({ error: 'Invalid campaign id.' });
  if (!Number.isSafeInteger(revision) || revision < 1) return res.status(400).json({ error: 'A valid revision number is required.' });
  const invalid = validPayload(draft, design);
  if (invalid) return res.status(400).json({ error: invalid });
  try {
    const { data, error } = await getSupabaseClient().from(TABLE).update({ draft, design, revision: revision + 1, updated_at: new Date().toISOString() }).eq('site_id', req.params.siteId).eq('id', id).eq('revision', revision).select().maybeSingle();
    if (error) return failure(res, error);
    if (!data) return res.status(409).json({ error: 'Campaign changed or was removed. Reload before saving; your editor remains open.' });
    res.json({ campaign: shape(data) });
  } catch (error) { return failure(res, error); }
}
async function remove(req, res) {
  const { id } = req.params;
  if (!uuid.test(id)) return res.status(400).json({ error: 'Invalid campaign id.' });
  try {
    const { data, error } = await getSupabaseClient().from(TABLE).delete().eq('site_id', req.params.siteId).eq('id', id).select().single();
    if (error) return failure(res, error);
    res.json({ campaign: shape(data) });
  } catch (error) { return failure(res, error); }
}

router.use(express.json({ limit: '16mb' }));
router.use(apiKey);
router.use('/:siteId', site);
router.get(bridge, requireAuth, requireRole('editor'), list);
router.post(bridge, requireAuth, requireRole('editor'), create);
router.put(bridge + '/:id', requireAuth, requireRole('editor'), update);
router.delete(bridge + '/:id', requireAuth, requireRole('editor'), remove);
router.get(developer, requireAuth, requireRole('developer'), list);
router.post(developer, requireAuth, requireRole('developer'), create);
router.put(developer + '/:id', requireAuth, requireRole('developer'), update);
router.delete(developer + '/:id', requireAuth, requireRole('developer'), remove);

module.exports = router;
