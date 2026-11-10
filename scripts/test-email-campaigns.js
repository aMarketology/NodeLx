// Isolated API contract test: mocks Supabase and site registry; no external writes.
const assert = require('node:assert/strict');
const express = require('express');
const sitesPath = require.resolve('../server/sites');
const supabasePath = require.resolve('../server/supabase');
const rows = [];
require.cache[sitesPath] = { id: sitesPath, filename: sitesPath, loaded: true, exports: { getSiteById: (id) => ['site-a', 'site-b'].includes(id) ? { id } : null } };
class Query {
  constructor() { this.filters = []; this.op = 'select'; }
  select() { return this; }
  eq(k, v) { this.filters.push((r) => r[k] === v); return this; }
  order() { return this; }
  range(start, end) { this.start = start; this.end = end; return this; }
  insert(value) { this.op = 'insert'; this.value = value; return this; }
  update(value) { this.op = 'update'; this.value = value; return this; }
  single() { return this.execute(); }
  maybeSingle() { return this.execute(); }
  then(resolve, reject) { return this.execute().then(resolve, reject); }
  async execute() {
    if (this.op === 'insert') {
      if (this.value.source && rows.some((r) => r.site_id === this.value.site_id && r.source === this.value.source)) return { data: null, error: { code: '23505' } };
      const row = { ...this.value, revision: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }; rows.push(row); return { data: row, error: null };
    }
    const matching = rows.filter((row) => this.filters.every((fn) => fn(row)));
    if (this.op === 'update') { if (!matching[0]) return { data: null, error: null }; Object.assign(matching[0], this.value); return { data: matching[0], error: null }; }
    return { data: matching.slice(this.start || 0, (this.end ?? 999) + 1), error: null };
  }
}
require.cache[supabasePath] = { id: supabasePath, filename: supabasePath, loaded: true, exports: { getSupabaseClient: () => ({ from: () => new Query() }) } };
process.env.NODELX_API_KEY = 'test-only-key';
const app = express(); app.use(express.json()); app.use(require('../server/routes/email-campaigns'));
const server = app.listen(0, '127.0.0.1', async () => {
  const base = `http://127.0.0.1:${server.address().port}/api/sites`;
  const request = (path, method = 'GET', body, key = 'test-only-key') => fetch(base + path, { method, headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const draft = { name: 'Example', subject: 'Hello', previewText: '', blocks: [{ id: 'one', type: 'paragraph', text: 'Text' }] };
  const design = { font: 'Arial, sans-serif', headingSize: 25, paragraphSize: 15, textColor: '#34506a', accentColor: '#2e86c1' };
  try {
    assert.equal((await request('/site-a/email/campaigns', 'GET', null, 'wrong')).status, 401);
    assert.equal((await request('/missing/email/campaigns')).status, 404);
    assert.equal((await request('/site-a/email/campaigns', 'POST', { draft: {}, design })).status, 400);
    const created = await request('/site-a/email/campaigns', 'POST', { draft, design, source: 'holiday-2026' }); assert.equal(created.status, 201);
    const { campaign } = await created.json(); assert.equal(campaign.revision, 1);
    assert.equal((await request('/site-a/email/campaigns', 'POST', { draft, design, source: 'holiday-2026' })).status, 409);
    assert.equal((await (await request('/site-b/email/campaigns')).json()).campaigns.length, 0);
    assert.equal((await request(`/site-b/email/campaigns/${campaign.id}`, 'PUT', { draft, design, revision: 1 })).status, 409);
    const updated = await request(`/site-a/email/campaigns/${campaign.id}`, 'PUT', { draft: { ...draft, name: 'Updated' }, design, revision: 1 }); assert.equal(updated.status, 200); assert.equal((await updated.json()).campaign.revision, 2);
    assert.equal((await request(`/site-a/email/campaigns/${campaign.id}`, 'PUT', { draft, design, revision: 1 })).status, 409);
    const list = await (await request('/site-a/email/campaigns')).json(); assert.equal(list.campaigns[0].draft.name, 'Updated'); assert.deepEqual(list.campaigns[0].design, design);
    console.log('Email campaign API: auth, validation, tenant isolation, import uniqueness, persistence and conflicts passed.');
  } catch (err) { console.error(err); process.exitCode = 1; } finally { server.close(); }
});
