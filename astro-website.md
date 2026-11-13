# NodeLx + Astro — Integration Guide

> How to wire NodeLx (headless Git-backed CMS) into an **Astro** site.
> This documents the plan; implementation is deferred until we onboard an Astro client site.

---

## 1. TL;DR

NodeLx is framework-agnostic at its core. The **content layer** (GitHub `content/*.json`),
the **save contract** (`PUT /api/sites/:id/content/:page` → commit → revalidate), and the
**media upload** (`POST /api/media/upload`) work with any framework.

The only Astro-specific work is:

1. A **content reader** — Astro Content Layer (Astro 5+) or a plain fetch.
2. A **revalidation strategy** — SSR (no-op) vs SSG (rebuild webhook).
3. An **API route adapter** — Astro endpoints (`src/pages/api/*.ts`) mirroring the Next.js routes.
4. The **editor UI** — mount the existing React `NodelxBridge`/`AdminBar` via `@astrojs/react`,
   OR extract them into a framework-agnostic package.

---

## 2. How NodeLx works today (framework-agnostic parts)

From the live `NodeLx` repo and the `modernparking-website` client:

```
Client site (any framework)                NodeLx (Express backend)
├── Editor UI (inline text/image)  ──POST /api/admin/save──►  commits content/*.json
│   (NodelxBridge + AdminBar)                                  to the client's GitHub repo
│                                                              + POSTs /api/revalidate
└── Admin dashboard (/admin)  ◄──reads content──  ─────────►  returns fresh content
```

**The contracts that do NOT change per framework:**

| Contract | Endpoint | Astro-compatible? |
|---|---|---|
| Save content | `PUT {NODELX_URL}/api/sites/{siteId}/content/{page}` — body `{ content, authorEmail, revalidatePaths }`, `Authorization: Bearer {NODELX_API_KEY}` | ✅ Yes |
| List media | `GET {NODELX_URL}/api/media/{siteId}` | ✅ Yes |
| Upload media | `POST {NODELX_URL}/api/media/upload` — body `{ siteId, folder, filename, contentType, data(base64) }` | ✅ Yes |
| Revalidation | NodeLx POSTs to `{site}/api/revalidate` with `x-revalidation-secret` header | ✅ Yes (adapter) |

**Content files** are plain JSON in each client repo (`content/home.json`, `content/blog.json`, `content/page-*.json`). No framework assumptions.

**Env vars** (`NODELX_URL`, `NODELX_API_KEY`, `NODELX_SITE_ID`, `GITHUB_OWNER`, `GITHUB_REPO`, `GITHUB_TOKEN`, `ADMIN_PASSWORD`, `ADMIN_SECRET`, `REVALIDATION_SECRET`) are the same for Astro.

---

## 3. What IS Next.js-specific (needs adapting)

| Concern | Next.js (modernparking-website) | Astro equivalent |
|---|---|---|
| Read content | `lib/cms.ts` → `fetch(GitHub)`, `next: { revalidate: 3600, tags: [...] }` (ISR) | Content Layer loader, or plain fetch |
| Revalidate | `revalidatePath` / `revalidateTag` | Rebuild (SSG) or no-op (SSR) |
| API routes | `src/app/api/admin/*/route.ts` | `src/pages/api/*.ts` (Node adapter) |
| Editor UI | React `AdminBar` + `NodelxBridge` + `ImageSwapModal` | `@astrojs/react` islands, or shared package |

---

## 4. Astro Integration — Step by Step

### 4.1 Choose an output mode

| Mode | Astro config | Revalidation strategy | Effort |
|---|---|---|---|
| **SSR** | `output: 'server'` + Node adapter | None — content fetched fresh per request | Low |
| **SSG** | `output: 'static'` (default) | Rebuild on NodeLx commit (deploy webhook / GitHub Actions) | Low-medium |

**Recommendation:** Use **SSR** (`output: 'server'`) for the simplest NodeLx integration — no cache
to bust, content edits go live on the next request. Use SSG only if the site has no dynamic
per-request needs and you're OK with a rebuild-per-edit.

---

### 4.2 Content reading

**Option A — Astro Content Layer (Astro 5+, recommended)**

```ts
// src/content.config.ts
import { defineCollection, z } from 'astro:content'

const githubRaw = (path: string) =>
  `https://raw.githubusercontent.com/${import.meta.env.GITHUB_OWNER}/${import.meta.env.GITHUB_REPO}/main/content/${path}`

const home = defineCollection({
  loader: async () => {
    const res = await fetch(githubRaw('home.json'))
    const data = await res.json()
    return [{ id: 'home', ...data }]
  },
  schema: z.object({
    hero: z.object({
      badge: z.string(),
      title1: z.string(),
      slides: z.array(z.string()),
    }),
    // ... mirror the schema from content/home.json
  }),
})

export const collections = { home }
```

**Option B — Plain fetch (works on any Astro version)**

```ts
// src/lib/cms.ts
export async function getContent<T = any>(fileKey: string): Promise<T> {
  const url = `https://raw.githubusercontent.com/${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}/main/content/${fileKey}.json`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`GitHub Contents API ${res.status}`)
  return res.json()
}
```

Then in an SSR page: `const content = await getContent('home')`.

---

### 4.3 Revalidation endpoint

Astro's Node adapter lets you write API endpoints in `src/pages/api/`.

**SSR mode:** create a **no-op** `/api/revalidate` that just returns 200 (NodeLx calls it
after every save; there's nothing to bust). This keeps NodeLx happy without extra work.

```ts
// src/pages/api/revalidate.ts
import type { APIRoute } from 'astro'

export const POST: APIRoute = ({ request }) => {
  const secret = request.headers.get('x-revalidation-secret')
  if (!secret || secret !== import.meta.env.REVALIDATION_SECRET) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }
  return new Response(JSON.stringify({ ok: true }), { status: 200 })
}
```

**SSG mode:** NodeLx's revalidate call can trigger a rebuild. Simplest: point NodeLx's
`revalidatePaths` to nothing and instead configure your Git host (GitHub Actions /
Vercel/Netlify webhook) to rebuild when NodeLx commits a content file.

---

### 4.4 Admin API routes (mirror the Next.js routes)

Port these from `modernparking-website/src/app/api/admin/*` to `src/pages/api/admin/*`:

| Astro endpoint | Purpose | Key detail |
|---|---|---|
| `src/pages/api/admin/login.ts` | `POST` validate `ADMIN_PASSWORD` → set `nodelx_admin_session` cookie | cookie `httpOnly`, `secure` in prod |
| `src/pages/api/admin/logout.ts` | `POST` clear cookie | — |
| `src/pages/api/admin/me.ts` | `GET { loggedIn, role }` | checks cookie against `ADMIN_SECRET` |
| `src/pages/api/admin/save.ts` | `POST { mutations }` → apply to content → `PUT` to NodeLx | proxied with `Bearer {NODELX_API_KEY}` |
| `src/pages/api/admin/images.ts` | `GET` list images (GitHub tree + NodeLx media) | — |
| `src/pages/api/admin/upload.ts` | `POST` multipart → base64 → NodeLx media upload | — |

**Example — the save endpoint in Astro:**

```ts
// src/pages/api/admin/save.ts
import type { APIRoute } from 'astro'

export const POST: APIRoute = async ({ request, cookies }) => {
  const session = cookies.get('nodelx_admin_session')?.value
  if (!session || session !== import.meta.env.ADMIN_SECRET) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  const { mutations } = await request.json()

  const res = await fetch(
    `${import.meta.env.NODELX_URL}/api/sites/${import.meta.env.NODELX_SITE_ID}/content/home`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${import.meta.env.NODELX_API_KEY}`,
      },
      body: JSON.stringify({
        content: mutations, // ← apply mutations to fresh content before sending
        authorEmail: 'admin@example.com',
        revalidatePaths: ['/'],
      }),
    },
  )

  if (!res.ok) return new Response(JSON.stringify({ error: 'Save failed' }), { status: 502 })
  return new Response(JSON.stringify({ ok: true }), { status: 200 })
}
```

> ⚠️ The real save route applies mutations to *freshly-read* content and does a
> reverse-lookup for image swaps (`img.<base64url>` keys). See
> `modernparking-website/src/app/api/admin/save/route.ts` for the full, battle-tested
> logic — the Astro version should mirror it, not the simplified sketch above.

---

### 4.5 Editor UI (inline editing)

The editor is React (`NodelxBridge.tsx`, `AdminBar.tsx`, `ImageSwapModal.tsx`,
`editorStore.ts`, `useImagePreview.ts`). Two options:

**Option A — Embed React islands (fastest)**

```bash
npx astro add react
```

```astro
---
// src/layouts/Base.astro
import AdminBar from '../components/admin/AdminBar'
import NodelxBridge from '../components/admin/NodelxBridge'
---
<AdminBar client:load />
<NodelxBridge client:load />
```

The bridge already works by reading `data-editable` attributes from the DOM — so as long
as your Astro templates render `data-editable="..."` (and `data-editable-type="image"` for
images), the existing components work unchanged.

```astro
<h1 data-editable="hero.title1">{content.hero.title1}</h1>
```

**Option B — Extract into a shared framework-agnostic package (long-term)**

If many Astro sites are planned, extract the editor + API-proxy logic into an
`@nodelx/core` package (plain TypeScript + DOM events), consumed by both Next.js and
Astro. Defer until there's real volume.

---

## 5. Media / images

- **Listing** — `GET /api/admin/images` combines GitHub tree (`public/`) + NodeLx Supabase media. Same for Astro.
- **Upload** — small images commit to the repo, large → Supabase (NodeLx decides). The Astro
  `/api/admin/upload` proxy is identical to the Next.js one.
- **ImageSwapModal** — already React; mount as an island.

---

## 6. Checklist for onboarding an Astro site

- [ ] Choose output mode (SSR recommended)
- [ ] Create `content/home.json` (or `page-*.json`) in the Astro repo
- [ ] Register the site in NodeLx (`content/sites.json` + per-site PAT)
- [ ] Add `NODELX_*`, `GITHUB_*`, `ADMIN_*`, `REVALIDATION_SECRET` env vars
- [ ] Content reader (Content Layer or plain fetch)
- [ ] `/api/revalidate` endpoint (no-op for SSR)
- [ ] Admin API routes (`login`, `logout`, `me`, `save`, `images`, `upload`)
- [ ] Mount `AdminBar` + `NodelxBridge` via `@astrojs/react`
- [ ] Add `data-editable` markers to Astro templates
- [ ] Test: login → inline edit → save → confirm NodeLx commit + content update

---

## 7. Differences to remember vs. Next.js

| Topic | Next.js | Astro |
|---|---|---|
| ISR | Built-in (`revalidate`/`revalidateTag`) | ❌ None — use SSR (no cache) or SSG (rebuild) |
| Route handlers | `route.ts` with `NextResponse` | `src/pages/api/*.ts` with `Response` |
| Content cache tags | `next: { tags: [...] }` | N/A (Astro Content Layer has its own store) |
| Env vars | `process.env.*` | `import.meta.env.*` (public) / `process.env.*` (server via adapter) |
| Islands | `"use client"` | `client:load` directives |

---

*See `client-site-changes/README.md` and `modernparking-website` for the canonical Next.js
implementation to port from.*
