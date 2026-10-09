# Client-Site Changes — Inline Editing on the Live Site

These files implement **inline editing directly on the live site** (`diamondbctx.com`),
with NodeLx acting purely as the headless backend (GitHub commit + revalidate).

## Architecture

```
Client visits diamondbctx.com/admin/login
  → enters password
  → POST /api/admin/login validates against ADMIN_PASSWORD
  → sets httpOnly cookie: nodelx_admin_session = ADMIN_SECRET
  → hard redirect to / (full reload)
  → NodelxBridge mounts, checks GET /api/admin/me (loggedIn)
  → shows "Editing Mode" bar
  → user clicks [data-editable] elements → inline edits
  → "Publish" → POST /api/admin/save { mutations }
  → save route re-reads content via getHomeContentCMS()
  → applies mutations → PUT full content to NodeLx
  → NodeLx commits content/home.json to GitHub + triggers ISR revalidate
```

## Files to add/update in the client repo (williamb_constuction)

### 1. `app/api/admin/login/route.ts` (NEW)
`POST` validates `ADMIN_PASSWORD`, sets `nodelx_admin_session` cookie.
→ Copy `api-admin-login-route.ts` → `app/api/admin/login/route.ts`

### 2. `app/api/admin/logout/route.ts` (NEW)
`POST` clears `nodelx_admin_session` cookie, redirects to `/`.
→ Copy `api-admin-logout-route.ts` → `app/api/admin/logout/route.ts`

### 3. `app/api/admin/me/route.ts` (NEW)
`GET` returns `{ loggedIn: true/false }` by checking the `nodelx_admin_session` cookie.
→ Copy `api-admin-me-route.ts` → `app/api/admin/me/route.ts`

### 4. `app/api/admin/save/route.ts` (NEW)
`POST` accepts `{ mutations }`, re-reads content, applies mutations, PUTs to NodeLx.
→ Copy `api-admin-save-route.ts` → `app/api/admin/save/route.ts`

### 5. `components/admin/NodelxBridge.tsx` (REPLACE)
The updated bridge that activates on login, shows the top bar, and does inline editing.
→ Copy `NodelxBridge.tsx` → `components/admin/NodelxBridge.tsx`

### 6. `app/admin/login/page.tsx` (NEW)
Password-only form → POST `/api/admin/login` → `window.location.href = '/'`.

### 7. `app/api/admin/upload/route.ts` (ALREADY EXISTS — no change needed)
The client already has this route. It accepts `multipart/form-data` (`file` + `folder`)
and proxies to NodeLx `/api/media/upload` (Supabase). The bridge uses this exact
contract (FormData with `file` + `folder`). No change needed.

## Environment variables (Vercel)

- `NODELX_URL` → `https://nodelx-production.up.railway.app`
- `NODELX_API_KEY` — must match NodeLx server's `NODELX_API_KEY`
- `NODELX_SITE_ID` → `williamb-construction`
- `ADMIN_PASSWORD` — the password clients use to log in
- `ADMIN_SECRET` — a random string used as the cookie value
- `REVALIDATION_SECRET` — for ISR revalidation

## Notes

- The `nodelx_admin_session` cookie is httpOnly, so client JS can't read it
  directly — that's why we added `/api/admin/me` to check login state.
- The CSP `frame-ancestors` issue is now IRRELEVANT — no iframe is used.
- NodeLx is unchanged — it's already the correct headless backend.
- See `next_steps.md` for the step-by-step plan and `RECONCILIATION_PLAN.md`
  for the canonical contracts synced from the live repo.