const express = require('express');
const crypto = require('crypto');
const { getSiteById } = require('../sites');
const { getSupabaseClient } = require('../supabase');

const router = express.Router();
const TABLE = 'nodelx_calendar_items';
const kinds = new Set(['event', 'social']);
const idPattern = /^[a-z0-9_-]{1,120}$/i;
const isStr = (v, max) => typeof v === 'string' && v.length <= max;
const isDate = (v) => typeof v === 'string' && !Number.isNaN(Date.parse(v));

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

function validItem(kind, payload) {
  if (!kinds.has(kind) || !payload || typeof payload !== 'object') return false;
  if (kind === 'event') return isStr(payload.id, 120) && isStr(payload.title, 500) && payload.title.trim() && isDate(payload.date) && isStr(payload.color, 20);
  if (kind === 'social') return isStr(payload.id, 120) && isStr(payload.channel, 40) && isStr(payload.text, 2000) && payload.text.trim() && isDate(payload.scheduledFor);
  return false;
}

function shape(row) {
  return { kind: row.kind, id: row.id, ...row.payload, createdAt: row.created_at, updatedAt: row.updated_at };
}

function failure(res, error) {
  console.error('[Calendar items]', error.message);
  return res.status(503).json({ error: 'NODELKX calendar storage is unavailable. Check Supabase and the calendar migration.' });
}

const bridge = '/api/sites/:siteId/calendar/items';

async function list(req, res) {
  try {
    const rows = [];
    for (let offset = 0; offset < 5000; offset += 200) {
      const { data, error } = await getSupabaseClient().from(TABLE).select('*').eq('site_id', req.params.siteId).order('updated_at', { ascending: false }).range(offset, offset + 199);
      if (error) return failure(res, error);
      rows.push(...data);
      if (data.length < 200) return res.set('Cache-Control', 'no-store').json({ items: rows.map(shape) });
    }
    return res.status(503).json({ error: 'Too many calendar items to list.' });
  } catch (error) { return failure(res, error); }
}

async function create(req, res) {
  const { kind, item } = req.body || {};
  if (!validItem(kind, item)) return res.status(400).json({ error: 'Invalid calendar item' });
  try {
    const row = { site_id: req.params.siteId, kind, id: item.id, payload: item };
    const { data, error } = await getSupabaseClient().from(TABLE).insert(row).select().single();
    if (error?.code === '23505') return res.status(409).json({ error: 'This item already exists.' });
    if (error) return failure(res, error);
    res.status(201).json({ item: shape(data) });
  } catch (error) { return failure(res, error); }
}

async function update(req, res) {
  const { kind, id } = req.params;
  const { item } = req.body || {};
  if (!idPattern.test(id) || !validItem(kind, item) || item.id !== id) return res.status(400).json({ error: 'Invalid calendar item' });
  try {
    const { data, error } = await getSupabaseClient().from(TABLE).update({ payload: item, updated_at: new Date().toISOString() }).eq('site_id', req.params.siteId).eq('kind', kind).eq('id', id).select().maybeSingle();
    if (error) return failure(res, error);
    if (!data) return res.status(404).json({ error: 'Item not found' });
    res.json({ item: shape(data) });
  } catch (error) { return failure(res, error); }
}

async function remove(req, res) {
  const { kind, id } = req.params;
  if (!idPattern.test(id)) return res.status(400).json({ error: 'Invalid id' });
  try {
    const { data, error } = await getSupabaseClient().from(TABLE).delete().eq('site_id', req.params.siteId).eq('kind', kind).eq('id', id).select();
    if (error) return failure(res, error);
    if (!data || data.length === 0) return res.status(404).json({ error: 'Item not found' });
    res.json({ ok: true });
  } catch (error) { return failure(res, error); }
}

router.get(bridge, apiKey, site, list);
router.post(bridge, apiKey, site, create);
router.put(`${bridge}/:kind/:id`, apiKey, site, update);
router.delete(`${bridge}/:kind/:id`, apiKey, site, remove);

module.exports = router;
