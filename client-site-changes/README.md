# Client-Site Changes — Inline Editing on the Live Site

These files implement **inline editing directly on the live site** (`diamondbctx.com`),
with NodeLx acting purely as the headless backend (GitHub commit + revalidate).

## Architecture

```
Client visits diamondbctx.com (logged in as admin)
  → NodelxBridge detects admin_session cookie (via GET /api/admin/me)
  → Shows "Editing Mode" bar at top
  → Every [data-nodelx-id] / [data-nodelx-field] element is clickable
  → Text: contenteditable inline edit
  → Image: file picker → upload → swap src
  → "Publish" button → POST /api/admin/save → NodeLx → GitHub commit + revalidate
```

## Files to add/update in the client repo (williamb_constuction)

### 1. `app/api/admin/me/route.ts` (NEW)
Returns `{ loggedIn: true/false }` by checking the `admin_session` cookie.
→ Copy `api-admin-me-route.ts` → `app/api/admin/me/route.ts`

### 2. `app/api/admin/content/route.ts` (NEW)
`GET` returns current `content/home.json` (read from NodeLx/GitHub).
→ Copy `api-admin-content-route.ts` → `app/api/admin/content/route.ts`

### 3. `app/api/admin/save/route.ts` (NEW)
`POST` sends full content to NodeLx to commit + revalidate.
→ Copy `api-admin-save-route.ts` → `app/api/admin/save/route.ts`

### 4. `components/admin/NodelxBridge.tsx` (REPLACE)
The updated bridge that activates on login, shows the top bar, and does inline editing.
→ Copy `NodelxBridge.tsx` → `components/admin/NodelxBridge.tsx`

### 5. `app/api/admin/upload/route.ts` (ALREADY EXISTS — no change needed)
The client already has this route. It accepts `multipart/form-data` (`file` + `folder`)
and proxies to NodeLx `/api/media/upload` (Supabase). The bridge uses this exact
contract (FormData with `file` + `folder`). No change needed.

## Environment variables (Vercel)

Only ONE change needed:
- `NODELX_URL` → `https://nodelx-production.up.railway.app`

All other vars (`NODELX_API_KEY`, `NODELX_SITE_ID`, `REVALIDATION_SECRET`,
`ADMIN_PASSWORD`, `ADMIN_SECRET`, Supabase) are already correct.

## Notes

- The `admin_session` cookie is httpOnly, so client JS can't read it directly —
  that's why we added `/api/admin/me` to check login state.
- The CSP `frame-ancestors` issue is now IRRELEVANT — no iframe is used.
- NodeLx is unchanged — it's already the correct headless backend.