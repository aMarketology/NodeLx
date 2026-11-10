# zAll.md — NodeLx Live Testing Checklist# zAll.md — NodeLx Site Editing Capabilities Checklist



> **Legend:** ✅ verified working · ⚠️ partial/broken · ❌ missing · 🔲 test live> Master checklist for every site NodeLx is installed on. We go through each

> site, verify each editing capability, and note anything that breaks.

**Last automated audit:** 2026-10-29 — all endpoints green on both sites.>

> **Legend:** ✅ working · ⚠️ partial/broken · ❌ missing · 🔲 not yet tested

---

---

## Automated audit results (already verified)

## 1. William B Construction (Diamond B)

| Check | Modern Parking | William B |

|-------|---------------|-----------|- **Live:** https://www.diamondbctx.com

| Site loads | ✅ 200 | ✅ 200 |- **Repo:** `ironoak-texas/williamb_constuction`

| `/api/admin/session` | ✅ 200 | ✅ 200 |- **Deploy:** Vercel

| `/api/admin/login` (`modern2026`) | ✅ 200 (page_editor) | ✅ 200 (site_admin) |- **Site ID:** `williamb-construction`

| `/api/admin/images` (authed) | ✅ 200 | ✅ 200 |

| `/api/admin/images` (unauth) | ✅ 401 | ✅ 401 |### Editing capabilities

| `/admin/blog` (unauth) | ✅ 200 | ✅ 307 → login |

| `/admin/blog` (authed) | ✅ 200 | ✅ 200 || Capability | Status | Notes |

| NodeLx backend health | ✅ 200 | ✅ 200 ||-----------|--------|-------|

| NodeLx content read | ✅ 200 | ✅ 200 || Admin login (`/admin`) | 🔲 | |

| All public pages | ✅ 200 | ✅ 200 || Admin bar shows (session active) | 🔲 | |

| Git working tree clean | ✅ | ✅ || Mode toggle: Text / Images / Blog | 🔲 | Blog should be greyed out (`ALLOW_BLOG_EDITING=false`) |

| Text editing (inline contenteditable) | 🔲 | |

---| Image swapping (single image) | 🔲 | |

| Image swapping (gallery/lightbox) | 🔲 | |

## 1. Modern Parking Inc.| Hero collage image swap | 🔲 | |

| Navigation editing (site_admin) | 🔲 | |

- **Live:** https://modernparking.com| Blog editor (`/admin/blog`) | 🔲 | Greyed out for now |

- **Login:** `/admin/login` · password `modern2026`| Save → commit → revalidate | 🔲 | |

- **Repo:** `ironoak-texas/modernparking-website`| Logout | 🔲 | |

- **Deploy:** GitHub Actions + self-hosted PM2

### Content files

### Live test checklist`home.json`, `page-about.json`, `page-services.json`, `gallery.json`, `blog.json`, `service-*.json` (many)



| # | Test | Status | Notes |### Notes

|---|------|--------|-------|- Mode toggle added to `AdminBar.tsx` + mode-gating to `NodelxBridge.tsx` (committed `bab560a`).

| 1 | Log in at `/admin/login` | 🔲 | |- ✅ `ALLOW_BLOG_EDITING=false` set in Vercel + redeployed — production session now returns `allowBlogEditing: false` (Blog greyed out).

| 2 | Admin bar appears at top | 🔲 | |- `ImageSwapModal.tsx` redesigned to click-to-select (no Save button) — image swap applies immediately, saved via AdminBar "Save Changes".

| 3 | Mode toggle shows Text / Images / Blog | 🔲 | |- `GalleryCollection.tsx` `slug` prop restored (lightbox editing preserved).

| 4 | **Text mode** — click a heading, edit inline | 🔲 | |

| 5 | **Text mode** — edit a paragraph | 🔲 | |---

| 6 | **Images mode** — click hero background → slideshow popup | 🔲 | 5 slides |

| 7 | Slideshow popup — swap a slide | 🔲 | |## 2. Modern Parking Inc.

| 8 | Slideshow popup — **upload** a new image | 🔲 | |

| 9 | Slideshow popup — reorder / remove slides | 🔲 | |- **Live:** https://modernparking.com

| 10 | **Images mode** — click About page story image | 🔲 | `about.image` |- **Repo:** `ironoak-texas/modernparking-website`

| 11 | **Images mode** — click Contact page hero | 🔲 | `contact.image` |- **Deploy:** GitHub Actions + self-hosted PM2 (Windows)

| 12 | **Images mode** — click a sector image (4 cards) | 🔲 | `sectors.N.image` |- **Site ID:** `modernparking-website`

| 13 | **Images mode** — click intro image | 🔲 | `intro.image` |

| 14 | **Blog** — open `/admin/blog` | 🔲 | |### Editing capabilities

| 15 | Blog — create a new post | 🔲 | |

| 16 | Blog — rich text toolbar (bold, H2, lists, link) | 🔲 | || Capability | Status | Notes |

| 17 | Blog — author box fields (name, title, image) | 🔲 | ||-----------|--------|-------|

| 18 | Blog — default "Contact Modern Parking" CTA | 🔲 | || Admin login (`/admin/login`) | ✅ | `modern2026` → page_editor |

| 19 | Blog — save → post appears on `/blog` | 🔲 | || Admin bar shows (session active) | ✅ | |

| 20 | **Save Changes** → commits + goes live | 🔲 | || Mode toggle: Text / Images / Blog | ✅ | Blog enabled (editor installed) |

| 21 | **Discard** reverts staged changes | 🔲 | || Text editing (inline contenteditable) | ✅ | |

| 22 | **Logout** clears session | 🔲 | || Image swapping (single image) | ✅ | About/contact/sectors CMS-driven |

| 23 | Contact form sends email | 🔲 | SMTP → EmailJS → Resend || Hero slideshow popup (multi-slide manager) | ✅ | `HeroSlidesModal` + upload button |

| 24 | Site stays online during a save/deploy | 🔲 | || Contact page hero image swap | ✅ | `PageHero` background-image div |

| About page story image swap | ✅ | New `about.image` field |

---| Blog editor (`/admin/blog`) | ✅ | Blog page returns 200 |

| Save → commit → revalidate | ✅ | Verified via GitHub commits |

## 2. William B Construction (Diamond B)| Logout | ✅ | |

| Deploy downtime | ✅ | 44s, site stays 200 throughout (in-place git pull + startOrReload) |

- **Live:** https://www.diamondbctx.com| Blog starter post | ✅ | 1 post live: "How to Choose a Parking Management Company in Los Angeles" |

- **Login:** `/admin` · password `modern2026`

- **Repo:** `ironoak-texas/williamb_constuction`### Content files

- **Deploy:** Vercel`home.json`, `blog.json`



### Live test checklist### Notes

- Contact form: SMTP → EmailJS → Resend. **Do not change.** BCC max@amarketology.com.

| # | Test | Status | Notes |- `hero.slides` corruption bug FIXED (save route type-guard; bridge can't text-edit array fields).

|---|------|--------|-------|- Lazy loading added (`loading="lazy"` + `fetchPriority="low"` on below-fold images).

| 1 | Log in at `/admin` | 🔲 | |- Deploy moved to **in-place git pull** (no workspace wipe → no SWC lock → zero-downtime 44s deploys).

| 2 | Admin bar appears at top | 🔲 | |

| 3 | Mode toggle shows Text / Images / Blog | 🔲 | Blog greyed out |---

| 4 | **Text mode** — edit hero headline | 🔲 | |

| 5 | **Text mode** — edit about paragraphs | 🔲 | |## 3. Austin Web Services

| 6 | **Text mode** — edit a service card | 🔲 | |

| 7 | **Images mode** — click a hero collage tile | 🔲 | Opens collage manager |- **Live:** https://austin-web-services.com

| 8 | Collage manager — shows all 11 images | 🔲 | |- **Repo:** `aMarketology/Austin-Web-Services`

| 9 | Collage manager — swap an image | 🔲 | |- **Deploy:** (verify — likely Railway/Nixpacks)

| 10 | Collage manager — **upload** a new image | 🔲 | |- **Site ID:** `austin-web-services`

| 11 | Collage manager — reorder images | 🔲 | |

| 12 | Collage manager — timer controls (fade/hold/stagger) | 🔲 | |### Editing capabilities

| 13 | **Images mode** — click a gallery photo | 🔲 | |

| 14 | **Images mode** — click a project card image | 🔲 | || Capability | Status | Notes |

| 15 | **Images mode** — lightbox enlarged image swap | 🔲 | ||-----------|--------|-------|

| 16 | **Blog** — open `/admin/blog` | 🔲 | 6 posts || Admin login | 🔲 | |

| 17 | Blog — edit an existing post | 🔲 | || Blog editor (`/admin/blog-editor`) | 🔲 | Phase 1 built |

| 18 | Blog — create a new post | 🔲 | || In-context text editing | ❌ | No `NodelxBridge`/`AdminBar` installed |

| 19 | **Theme** — click NODELKX logo → panel slides in | 🔲 | Phase 2 || In-context image swapping | ❌ | No `NodelxBridge`/`AdminBar` installed |

| 20 | Theme — 3 font combos preview live | 🔲 | || Mode toggle | ❌ | Not installed |

| 21 | Theme — 3 color schemes preview live | 🔲 | || Save → commit → revalidate | 🔲 | Blog only |

| 22 | Theme — save persists to site.json | 🔲 | site_admin only |

| 23 | **Navigation** — edit menu (site_admin) | 🔲 | |### Content files

| 24 | **Save Changes** → commits + goes live | 🔲 | |`blog.json`

| 25 | **Logout** clears session | 🔲 | |

| 26 | Contact form sends email | 🔲 | Resend → WGB_DiamondB@yahoo.com |### Notes

- Only the **blog editor** is installed (Phase 1). No in-context text/image editing yet.

---- Has a separate `/admin` dashboard (website/email tabs) — unrelated to NodeLx in-context editing.



## Known gaps (not yet editable)---



### William B — hardcoded images## Global / Cross-site checks

| Location | What | Priority |

|----------|------|----------|| Check | Status | Notes |

| `app/page.tsx` | Owner portrait (William Brown) ×2 | **High** ||-------|--------|-------|

| `app/about/page.tsx` | 2 images | High || NodeLx backend healthy (Railway) | 🔲 | `https://nodelx-production.up.railway.app/api/health` |

| `app/services/page.tsx` | 1 image | Medium || Per-site PAT resolves | 🔲 | William B: file token · Modern Parking: `MODERN_PAT` env · AWS: ? |

| `app/service-areas/[slug]/page.tsx` | 3 images | Medium || Revalidation works after save | 🔲 | |

| `app/gallery/[slug]/page.tsx` | 1 image | Low || Logout clears cookie (both secure variants) | 🔲 | |

| `app/contact/page.tsx` | 1 image | Low |

---

### Modern Parking

- All key images are editable (hero slides, about, contact, sectors, intro).## Run log



---<!-- Add entries as we test each site. Format:

### YYYY-MM-DD — <site>

## Phase 2 backlog- [x] / [ ] <item> — <result/note>

-->
1. **Theme editor** — ✅ built for William B (fonts + colors)
2. **Austin Web Services** — full in-context editor install + token fix + blog migration
3. **William B hardcoded images** — make owner portrait + page images editable

---

## Run log

<!-- Add dated entries as you test. Format:
### 2026-10-29 — Modern Parking
- [x] #1 Log in — works
- [ ] #2 Admin bar — FAILED: <detail>
-->
