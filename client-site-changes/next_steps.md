# Next Steps — Client-Site Inline Editing Setup

This document tracks the step-by-step implementation of inline editing on
`diamondbctx.com`, powered by the NodeLx headless backend.

> **PRIORITY:** Before any new features, we must reconcile our
> `client-site-changes/` files with the live repo's canonical contracts.
> See `RECONCILIATION_PLAN.md` for full details. The reconciliation steps below
> (Phase 0) must be completed **first**.

---

## Architecture Recap (canonical)

```
User visits diamondbctx.com/admin/login
  → enters password
  → POST /api/admin/login validates against ADMIN_PASSWORD env var
  → sets httpOnly cookie: nodelx_admin_session = ADMIN_SECRET
  → redirects to diamondbctx.com/ (homepage)
  → NodelxBridge mounts, checks GET /api/admin/me (loggedIn)
  → shows "Editing Mode" bar
  → user clicks [data-editable] elements → inline edits
  → "Publish" → POST /api/admin/save { mutations }
  → save route re-reads content via getHomeContentCMS()
  → applies mutations → PUT full content to NodeLx
  → NodeLx commits content/home.json to GitHub + triggers ISR revalidate
```

---

## PHASE 0 — Reconcile with Live Repo (DO FIRST)

The live repo (`ironoak-texas/williamb_constuction`) is canonical. Fix these
discrepancies before continuing:

- [x] **0.1** Update `api-admin-save-route.ts` → accept `{ mutations }` (not `{ content }`)
- [x] **0.2** Update `NodelxBridge.tsx` → `data-editable` priority + publish `{ mutations }`
- [x] **0.3** Update `api-admin-logout-route.ts` → POST (not GET)
- [x] **0.4** Remove `api-admin-content-route.ts` (redundant)

---

## Phase 1 — Auth API Routes

- [x] **`app/api/admin/login/route.ts`** ← `api-admin-login-route.ts` (matches live)
- [x] **`app/api/admin/me/route.ts`** ← `api-admin-me-route.ts` (matches live)
- [ ] **`app/api/admin/logout/route.ts`** ← `api-admin-logout-route.ts` (POST after Phase 0.3)

---

## Phase 2 — Save API Route

- [ ] **`app/api/admin/save/route.ts`** ← `api-admin-save-route.ts` (mutations contract)

---

## Phase 3 — NodelxBridge Component

- [ ] **`components/admin/NodelxBridge.tsx`** ← `NodelxBridge.tsx`
  - resolve priority: `data-editable` → `data-nodelx-id` → section/field
  - images via `data-editable-type="image"`
  - publish sends `{ mutations }`

---

## Phase 4 — Login Page UI

- [x] **`app/admin/login/page.tsx`** (NEW) ← created as `admin-login-page.tsx`
  - **Simple UI**: single password input + inline error handling
  - **Submission**: POSTs `{ password }` directly to `/api/admin/login`
  - **Cookie handshake**: on `200 OK`, `/api/admin/login` sets the session cookie
  - **Hard redirect**: `window.location.href = '/'` (NOT client-side router nav)
    → forces a full document reload so `NodelxBridge` re-evaluates the auth
    cookie on mount and immediately shows the top admin bar
  - Dark theme matching bridge bar

> ✅ **Cookie name standardized:** `nodelx_admin_session` is now used
> consistently across all four routes (`login`/`me`/`save`/`logout`) and the
> bridge. No further action needed.

---

## Phase 5 — Environment Variables (Vercel)

- [x] **`env.example`** created as reference for the client repo's `.env.local`
- [ ] `NODELX_URL` = `https://nodelx-production.up.railway.app`
- [ ] `NODELX_API_KEY` — must match NodeLx server's `NODELX_API_KEY`
- [ ] `NODELX_SITE_ID` = `williamb-construction`
- [ ] `ADMIN_PASSWORD` — the password clients use to log in
- [ ] `ADMIN_SECRET` — a random string used as the cookie value
- [ ] `REVALIDATION_SECRET` — for ISR revalidation
- [ ] `GITHUB_OWNER` / `GITHUB_REPO` — defaults already hardcoded in `lib/cms.ts`

---

## Phase 6 — Test End-to-End

### Security Fix (DONE — session cookie is the single gate)

- [x] **Removed `?edit=true` bypass** from `NodelxBridge.tsx`
  - `NodelxBridge` now activates ONLY on a valid `nodelx_admin_session` cookie
    (checked via `/api/admin/session`), matching `AdminBar`.
  - `?edit=true` is now a no-op — it does NOT enable editing.
  - Reference file: `client-site-changes/NodelxBridge-secure.tsx`
    → drop into `components/admin/NodelxBridge.tsx`

### Local Testing (CURRENT — first live repo test)

Two servers must run simultaneously:

```bash
# Terminal 1 — NodeLx backend (port 9000)
cd /Users/thelegendofzjui/Documents/GitHub/NodeLkx
npm start

# Terminal 2 — Client site (Next.js, port 3000)
cd /Users/thelegendofzjui/Documents/GitHub/websites-TWS/williamb_constuction
npm run dev
```

Test flow (login is now REQUIRED — no `?edit=true` bypass):
1. Visit `http://localhost:3000/admin/login` → password `diamondb2026`
2. Redirect to `/` → **AdminBar appears** + inline editing active
3. Click any text → becomes editable (contenteditable)
4. Type → "Save Changes" appears in the top AdminBar
5. Click "Save Changes" → POST `/api/admin/save` → NodeLx → GitHub commit

**Known blocker:** Supabase URL `yzsasiprcsosvkjjtrav.supabase.co` does not
resolve — image uploads fail, but **text editing is unaffected**.

### Production (Vercel)

- [ ] Deploy to Vercel
- [ ] Visit `diamondbctx.com/admin/login`
- [ ] Enter password → redirects to homepage
- [ ] "Editing Mode" bar appears
- [ ] Hover `[data-editable]` elements → blue outline
- [ ] Click text → inline edit
- [ ] Click image (`data-editable-type="image"`) → swap
- [ ] "Publish" → commit to GitHub → live in ~5s

---

## NodeLx Server (Already Ready)

- ✅ `PUT /api/sites/:id/content/:page` — commit + revalidate
- ✅ `GET /api/sites/:id/content/:page` — read from GitHub
- ✅ `NODELX_API_KEY` auth
- ✅ Site `williamb-construction` registered in `content/sites.json`
- ✅ Running at `https://nodelx-production.up.railway.app`

---

## Current Step: Phase 6 — Local Testing (login required)

Security fix applied: `?edit=true` bypass removed. Session cookie is the single
gate. Log in at `/admin/login` to test inline text editing + save.