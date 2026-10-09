# Reconciliation Plan — Sync `client-site-changes/` to the Live Repo

**Decision:** Option A — the live repo (`ironoak-texas/williamb_constuction`) is the
canonical source of truth for schema & contracts. Our `client-site-changes/` files
must be corrected to match it exactly, then copied over without conflict.

---

## 1. Canonical Content Schema — `lib/content.ts` (live)

This is the single source of truth for `content/home.json`. Do **not** recreate it.

```ts
interface HomeContent {
  hero: {
    badge:        string                  // eyebrow above H1
    h1:           [string, string, string] // 3 headline lines
    body:         string
    ctaPrimary:   string
    ctaSecondary: string
    heroImage:    string                  // e.g. "/511_Pebblestone/Pebblestone-2.jpg"
  }
  stats:    Array<{ val: string; label: string; icon?: string }>
  services: Array<{ slug: string; title: string; desc: string; img: string }>
  projects: Array<{ slug: string; title: string; sub: string; desc: string; galleryName: string; img: string }>
  why:      Array<{ icon: string; title: string; body: string }>
  about:    { heading: string; paragraphs: string[]; image: string; imageCaption: string }
  quote:    { text: string; author: string; role: string; image: string }
  cta:      { heading: string; body: string; buttonText: string; buttonHref: string }
}
```

---

## 2. Canonical Contracts (live)

| Concern | Canonical behavior (live repo) |
|---|---|
| **Auth** | `nodelx_admin_session` cookie === `ADMIN_SECRET`. Login POST validates `ADMIN_PASSWORD`, sets cookie. Logout is **POST** (SignOutButton) |
| **Element addressing** | Priority: `data-editable` (primary) → `data-nodelx-id` → `data-nodelx-section`/`data-nodelx-field`. Images use `data-editable-type="image"` |
| **Mutation paths** | Dot-notation: `about.heading`, `why.0.title`, `projects.0.img`, and `hero.h1_0` (array index via `_N`) |
| **Save (bridge)** | `POST /api/admin/save` body `{ mutations: Record<string,string> }` → route re-reads content via `getHomeContentCMS()`, applies mutations, then PUTs full content to NodeLx |
| **Save (form)** | `app/admin/home/actions.ts` `saveHome(HomeContent)` server action → PUT full content to NodeLx (separate path, already correct) |
| **NodeLx write** | `PUT /api/sites/:siteId/content/home` body `{ content, authorEmail, revalidatePaths: ['/'] }` + `Bearer NODELX_API_KEY` |
| **Revalidate** | `POST /api/revalidate` header `x-revalidation-secret: REVALIDATION_SECRET` body `{ paths: ['/'] }` |

---

## 3. Critical Discrepancies → Resolution

| # | Our file | Discrepancy | Resolution |
|---|---|---|---|
| 1 | `NodelxBridge.tsx` | Only resolves `data-nodelx-id`/`data-nodelx-field`; live primary is `data-editable` (+ `data-editable-type="image"`) | **UPDATE** `resolveId()` to check `data-editable` first, then `data-nodelx-id`, then section/field |
| 2 | `NodelxBridge.tsx` | `publish()` sends `{ content }` | **UPDATE** to send `{ mutations }` (live save route contract) |
| 3 | `NodelxBridge.tsx` | Staged edits store `id → value` only | **UPDATE** pending shape is fine, but publish must map to `{ mutations }` |
| 4 | `api-admin-save-route.ts` | Accepts `{ content }` (full object) | **UPDATE** to accept `{ mutations }`, load via `getHomeContentCMS()`, apply, then PUT full content to NodeLx |
| 5 | `api-admin-logout-route.ts` | We wrote **GET** | **UPDATE** to **POST** (live SignOutButton does POST) |
| 6 | `api-admin-content-route.ts` | GET proxy to NodeLx — redundant | **REMOVE** (live save route re-reads content itself via `getHomeContentCMS()`) |
| 7 | `api-admin-me-route.ts` | Matches live | ✅ KEEP as-is |
| 8 | `api-admin-login-route.ts` | Matches live (POST, ADMIN_PASSWORD → nodelx_admin_session=ADMIN_SECRET) | ✅ KEEP as-is |

---

## 4. File Dispositions

| File | Action |
|---|---|
| `api-admin-login-route.ts` | ✅ Keep (matches live) |
| `api-admin-me-route.ts` | ✅ Keep (matches live) |
| `api-admin-logout-route.ts` | 🔧 Update → POST |
| `api-admin-save-route.ts` | 🔧 Update → mutations contract |
| `api-admin-content-route.ts` | ❌ Remove (redundant) |
| `NodelxBridge.tsx` | 🔧 Update → `data-editable` priority + `{ mutations }` publish |
| `next_steps.md` | 🔧 Update → reflect synced contracts |

---

## 5. Order of Work

1. Update `api-admin-save-route.ts` → mutations-based
2. Update `NodelxBridge.tsx` → `data-editable` priority + publish `{ mutations }`
3. Update `api-admin-logout-route.ts` → POST
4. Remove `api-admin-content-route.ts`
5. Update `next_steps.md` / `README.md`
