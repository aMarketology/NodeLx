# NodeLx — 3 Month Plan to Client Readiness

> **Goal:** By **August 4, 2026**, NodeLx is production-ready enough to onboard our first paying client (Austin Remodeling / On Point Construction) with confidence.
>
> **Today:** May 4, 2026
> **Target Launch:** August 4, 2026 (12 weeks / 90 days)

---

## 🎯 Definition of "Client Ready"

We are client-ready when **all** of the following are true:

1. ✅ Client can visit `https://cms.<clientdomain>.com/admin` and **log in**
2. ✅ Client can edit text + images on every page of their site
3. ✅ Client **cannot break** the layout, structure, or code
4. ✅ Every change is **versioned in Git** with the client's name as commit author
5. ✅ Client can preview changes **before publishing** (draft → publish flow)
6. ✅ We (developer) get notified when client submits changes for review
7. ✅ Site is **hosted publicly** with HTTPS, automatic deploys on merge to `main`
8. ✅ Auth is secure: bcrypt passwords, signed JWT cookies, rate-limited login
9. ✅ We have **rollback in one click** if something goes wrong
10. ✅ We have **runbook documentation** for onboarding the next client in <2 hours

---

## 📍 Where We Are Today (May 4, 2026)

### ✅ What Works (Phase 1 — Done)
- In-memory + file-based JSON content store
- AST source mapping (Babel parser)
- WebSocket live updates
- Split-view editor (Monaco)
- Responsive preview modes (mobile/tablet/desktop)
- Debug console
- Local dev server (`npm run dev`)

### ❌ What's Missing (the 90-day gap)
- **No authentication** — anyone can edit
- **No Client Mode UI** — only Developer Mode exists
- **No public hosting** — localhost only
- **No Git integration** — saves are silent overwrites
- **No draft/publish workflow** — every save is live
- **No image upload pipeline** — must manually drop files
- **No multi-tenant story** — one repo = one site
- **No onboarding docs** — tribal knowledge only

### 🎯 The Client (Context)
- **Business:** Austin Remodeling / On Point Construction (residential remodeling)
- **Reference site:** https://www.austinremodeling-onpointconstruction.com/
- **Scope:** Marketing site rebuild — home, services, gallery, about, contact
- **Why NodeLx (not Duda):** Long-term client, agency wants to own the stack, no recurring CMS fees, ability to add custom logic later
- **Risk:** If NodeLx isn't ready by week 10, we fall back to Duda. **Hard deadline.**

---

## 🏛️ Architecture We're Building Toward

```
┌─────────────────────────────────────────────────────────────────┐
│  Public:  https://austinremodeling.com                          │
│           ─ Static React build, deployed on push to main        │
│           ─ Reads content from /content/*.json baked at build   │
└─────────────────────────────────────────────────────────────────┘
                              ▲
                              │ git push (webhook → rebuild)
                              │
┌─────────────────────────────────────────────────────────────────┐
│  Admin:   https://cms.austinremodeling.com/admin                │
│           ─ Login (bcrypt + JWT cookie)                         │
│           ─ Role-gated: client | developer                      │
│                                                                  │
│  /admin/editor   → Client Mode (form-based, locked schema)      │
│  /admin/dev      → Developer Mode (Monaco + AST, dev only)      │
│  /admin/review   → Pending drafts dashboard (dev only)          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ writes
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Storage Layer (Git-backed, file-first)                         │
│  ─ /content/*.json         → page content                       │
│  ─ /content/users.json     → bcrypt hashes + roles              │
│  ─ /content/uploads/*      → images (Git LFS or S3)             │
│  ─ branches:                                                     │
│      main             → published                               │
│      draft/<user>     → pending edits                           │
│  ─ Every save = git commit (author = logged-in user)            │
└─────────────────────────────────────────────────────────────────┘
```

### Key Architectural Decisions (locked in)

| Decision | Choice | Rationale |
|---|---|---|
| Storage | **Files + Git** (no DB for v1) | Versioning free, portable, manifesto-aligned |
| Auth | **bcrypt + JWT cookies** | No third-party dep, self-hostable |
| Git library | **`simple-git`** | Pure JS, no native bindings |
| Image storage | **Local `/uploads` + Git LFS** | Defer S3 to v2 |
| Hosting | **Single VPS (Hetzner/DO)** + Caddy for HTTPS | $5–10/mo, full control |
| Deploy | **Webhook → `git pull` → `npm run build` → restart** | No CI/CD complexity |
| Multi-tenant | **One VPS, one repo per client** (v1) | Simple isolation |

---

## 🗓️ The 12-Week Plan

Each milestone has a **demo-able outcome**. If we can't demo it, it's not done.

---

### 🏗️ MILESTONE 1 — Auth Foundation (Weeks 1–2)
**Dates:** May 5 – May 18
**Demo:** "I can log in at `/admin`, see my role, and log out."

#### Week 1 — Auth Plumbing
- [ ] Add `bcrypt`, `jsonwebtoken`, `cookie-parser` to `package.json`
- [ ] `server/auth/users.js` — read/write `content/users.json`
- [ ] `server/auth/hash.js` — bcrypt wrapper
- [ ] `server/auth/jwt.js` — sign/verify with `JWT_SECRET` env var
- [ ] `server/auth/middleware.js` — `requireAuth`, `requireRole(role)`
- [ ] `scripts/create-user.js` — CLI: `npm run user:create -- --email=x --role=client`
- [ ] Seed first developer user (you)

#### Week 2 — Admin Shell
- [ ] `POST /api/auth/login` — accepts email/password, sets HTTP-only cookie
- [ ] `POST /api/auth/logout` — clears cookie
- [ ] `GET /api/auth/me` — returns current user
- [ ] `public/admin/login.html` — minimal styled login page
- [ ] Rate limit login: 5 attempts per IP per 15 min (`express-rate-limit`)
- [ ] `/admin` redirects: not logged in → login; client → `/admin/editor`; dev → `/admin/dev`
- [ ] Existing editor moved to `/admin/dev` and gated behind `requireRole('developer')`

**Exit criteria:** Two users (`dev@nodelx`, `client@test`) can log in and land on different pages. Wrong password is rate-limited.

---

### 🔒 MILESTONE 2 — Git as Audit Log (Week 3)
**Dates:** May 19 – May 25
**Demo:** "Every save shows up in `git log` with the editor's name."

- [ ] Install `simple-git`
- [ ] `server/git/commit.js` — wraps `add → commit` with author from session
- [ ] Hook into existing `PUT /api/content/:page` → commit after write
- [ ] Commit message format: `content: edit <page> (<field>) by <email>`
- [ ] `GET /api/history/:page` — returns last 50 commits for a file
- [ ] `.gitignore` audit: ensure `node_modules`, `.env`, secrets excluded
- [ ] Auto-init repo on first run if not present

**Exit criteria:** Edit a field → `git log content/home.json` shows commit with correct author + message.

---

### 🧑‍💼 MILESTONE 3 — Client Mode Editor (Weeks 4–5)
**Dates:** May 26 – June 8
**Demo:** "Client logs in, sees a form for the home page, edits hero title, sees live preview, saves."

#### Week 4 — Schema-Driven Form
- [ ] `server/schema/derive.js` — infer schema from existing JSON (string/text/image/url)
- [ ] Field type heuristics: keys ending in `Image`/`Photo` → image; values >100 chars → textarea; URLs → link
- [ ] `client/components/ClientEditor.jsx` — renders form from schema
- [ ] `GET /api/content/:page/schema` endpoint
- [ ] Client Mode UI: page selector + form + live preview iframe (right side)

#### Week 5 — Save + Validate
- [ ] `PUT /api/content/:page` validates: rejects unknown keys, type mismatches
- [ ] "Saved ✓" toast + dirty-state warning on navigation
- [ ] WebSocket: client save → preview iframe updates
- [ ] Page switcher: dropdown of all `content/*.json`
- [ ] Hide all Developer Mode controls in Client UI (CSS + server-side render guard)

**Exit criteria:** Test client account can edit home/services/about pages, cannot access dev tools, cannot break structure.

---

### 🌿 MILESTONE 4 — Draft / Publish Workflow (Week 6)
**Dates:** June 9 – June 15
**Demo:** "Client saves to draft, dev sees pending changes, dev clicks Publish, site updates."

- [ ] Client saves go to branch `draft/<user-email-slug>` (not `main`)
- [ ] `GET /api/drafts` — list branches with pending changes vs `main`
- [ ] `/admin/review` page (dev only) — diff view per draft
- [ ] `POST /api/drafts/:branch/publish` — merges draft → main, deletes branch
- [ ] `POST /api/drafts/:branch/reject` — closes draft with note
- [ ] Email notification on submit (use Resend or SMTP — pick simplest)
- [ ] Client sees "Pending review" banner until merged

**Exit criteria:** Client edits → submits → dev gets email → dev approves → public site rebuilds within 2 minutes.

---

### 🖼️ MILESTONE 5 — Image Upload Pipeline (Week 7)
**Dates:** June 16 – June 22
**Demo:** "Client uploads a JPEG in the editor, sees it appear in preview, it's committed to repo."

- [ ] `POST /api/upload` — multipart, validates type/size (5MB max, jpg/png/webp)
- [ ] Store in `content/uploads/<page>/<timestamp>-<slug>.<ext>`
- [ ] Auto-resize on upload (sharp): generate `@1x`, `@2x`, max 2000px wide
- [ ] Image picker component in Client Editor: drag-drop + URL input
- [ ] Optional: set up Git LFS for `content/uploads/**`
- [ ] EXIF strip for privacy

**Exit criteria:** Client uploads a 4MB iPhone photo, it's resized + committed, appears in preview, total flow <10s.

---

### 🌍 MILESTONE 6 — Hosting + HTTPS + Domain (Week 8)
**Dates:** June 23 – June 29
**Demo:** "Live URL with valid cert, login works, edits persist across server restart."

- [ ] Provision VPS (Hetzner CX22 or DO equivalent, ~$5/mo)
- [ ] Install Node 20, Caddy, Git, Git LFS
- [ ] `Caddyfile` — auto HTTPS via Let's Encrypt
- [ ] `systemd` service for NodeLx server with auto-restart
- [ ] `.env` template + secrets management (`/etc/nodelx/env`)
- [ ] Deploy script: `scripts/deploy.sh` — pull, install, build, restart
- [ ] GitHub webhook → SSH → `deploy.sh`
- [ ] DNS: `cms.<domain>` → VPS IP
- [ ] Backup cron: daily `git push` to GitHub backup remote + tarball of `/uploads`

**Exit criteria:** `https://cms.staging.nodelx.dev/admin` loads, login works, restart preserves data.

---

### 🧱 MILESTONE 7 — Build the Client's Site (Weeks 9–10)
**Dates:** June 30 – July 13
**Demo:** "Austin Remodeling site fully built in React, content extracted to JSON, deployed."

- [ ] Audit reference site: list every page, every editable region
- [ ] Build React components for each page (hero, services grid, gallery, testimonials, contact form)
- [ ] Mark editable regions with `data-editable="..."` per manifesto pattern
- [ ] Extract initial content into `content/*.json`
- [ ] Image assets: download from reference, optimize, commit to `/uploads`
- [ ] Mobile responsive QA (real devices)
- [ ] Lighthouse score >90 on home page
- [ ] Contact form → email forwarder (Formspree or our own)
- [ ] SEO basics: meta tags, OG images, sitemap, robots.txt

**Exit criteria:** Site is visually 1:1 with reference, fully responsive, all content editable in Client Mode.

---

### 🛡️ MILESTONE 8 — Hardening + Onboarding Docs (Week 11)
**Dates:** July 14 – July 20
**Demo:** "Hand the runbook to a stranger; they onboard a fake client end-to-end."

- [ ] Security audit: helmet, CSRF tokens, XSS sanitization on all content rendering
- [ ] Logging: structured logs to file, rotate daily
- [ ] Error tracking: Sentry free tier OR self-hosted
- [ ] Backup verification: test restore from yesterday's tarball
- [ ] One-click rollback: `scripts/rollback.sh <commit-sha>` reverts main + redeploys
- [ ] **`docs/ONBOARDING.md`** — step-by-step new client setup
- [ ] **`docs/CLIENT_GUIDE.md`** — what to send the client (login URL, how to edit, screenshots)
- [ ] **`docs/RUNBOOK.md`** — common ops: reset password, rollback, restore backup
- [ ] Update `MANIFESTO.md` checkboxes for Phase 2 items now done

**Exit criteria:** Following only `ONBOARDING.md`, a new client site can be live in under 2 hours.

---

### 🚀 MILESTONE 9 — Client Onboarding (Week 12)
**Dates:** July 21 – August 3
**Demo:** "Client is logged in, has made their first edit, has approved go-live."

- [ ] Walk client through login + editor (30 min Zoom + recorded video)
- [ ] Client makes 3 test edits to confirm comfort
- [ ] Set up monitoring: uptime check (UptimeRobot free)
- [ ] Set up alerts: email on server down or error spike
- [ ] Final DNS cutover to client's domain
- [ ] Send welcome packet + invoice + support SLA
- [ ] **Retrospective:** what to fix before client #2

**Exit criteria:** Client signs off. Site is live. We are paid. Champagne.

---

## 🚦 Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Client Mode UX is too rough by week 10 | Medium | High | Soft launch with us editing on client's behalf for first 2 weeks |
| Git LFS / image bloat | Medium | Medium | Switch to S3 in week 7 if repo >500MB |
| Auth bug exposes editor publicly | Low | Critical | External pen-test in week 11 (or at minimum, OWASP ZAP scan) |
| Client wants features we don't have (blog, forms, etc.) | High | Medium | Scope lock with client in writing by May 11 |
| Solo dev burnout | Medium | High | Hard stop at 40hr/week. Skip Phase 6 features ruthlessly. |
| We miss the deadline | Medium | High | **Hard fallback: deploy on Duda by July 28** if Milestone 7 isn't done |

---

## ❌ Explicitly Out of Scope (For 90 Days)

These are **deferred to v2**. Do not build them. Do not let scope creep.

- ❌ Multiple simultaneous editors (last-write-wins is fine)
- ❌ Comment threads / collaboration features
- ❌ A/B testing
- ❌ i18n / multi-language
- ❌ Database adapter (Postgres/Supabase) — files only
- ❌ Plugin system
- ❌ Custom field types beyond text/textarea/image/url
- ❌ Drag-to-reorder in Client Mode
- ❌ Visual page builder (no adding new sections)
- ❌ Analytics dashboard
- ❌ Content templates
- ❌ Scheduled publishing
- ❌ Multi-site management UI

If the client asks for any of these, the answer is **"v2, Q4 2026."**

---

## 📊 Weekly Cadence

- **Monday:** Plan the week's tasks against current milestone
- **Wednesday:** Mid-week checkpoint — am I on track?
- **Friday:** Demo the week's outcome (record video, even if just for self)
- **Sunday:** Update this doc — check boxes, log blockers, adjust

---

## 🎯 Success Looks Like

> On August 4, 2026, the owner of Austin Remodeling logs into `cms.theirdomain.com`, changes their phone number, clicks Save, gets a confirmation, and 90 seconds later their public site shows the new number — without us touching a thing.
>
> No CMS subscription. No vendor lock-in. Their content lives in a Git repo we control. Every change is auditable. Every mistake is reversible.
>
> **That's NodeLx delivering on its manifesto.**

---

## 🔗 Related Docs

- [`MANIFESTO.md`](./MANIFESTO.md) — Why we're building this
- [`ARCHITECTURE_PROOF.md`](./ARCHITECTURE_PROOF.md) — Technical foundations
- [`ROADMAP.md`](./ROADMAP.md) — Long-term vision (post-90-day)
- [`NEXT_STEPS.md`](./NEXT_STEPS.md) — Tactical next actions
- `docs/ONBOARDING.md` — *(to be created in Milestone 8)*
- `docs/RUNBOOK.md` — *(to be created in Milestone 8)*

---

*Created: May 4, 2026*
*Owner: @aMarketology*
*Next review: May 11, 2026 (end of Week 1)*
