# NodeLx — Roadmap

> **Two products, one editing UI.**
>
> **Local Editor (now):** A developer runs `nodelx start` in their Node.js project. NodeLx spawns the dev server, iframes the running site, and overlays a visual editor. Click any text → type → it writes directly into the source code. Click any image → swap it → the `<img src>` updates in the JSX. Pure local files, no database.
>
> **Live Editor (later):** The same UI, deployed at `mysite.com/admin`. Client logs in, edits text and images. Edits go to Supabase. The live site reads content from Supabase at request time.

---

## Mental Model

```
LOCAL EDITOR (this roadmap's focus)

  cd my-nextjs-site
  nodelx start
       ↓
  NodeLx reads package.json → runs `npm run dev` as child process
  NodeLx detects the port (e.g. :3000)
  NodeLx serves its editor UI at :3001
       ↓
  Developer opens http://localhost:3001
       ↓
  Site renders in iframe with NodeLx editing overlay on top
       ↓
  Click headline → contenteditable → type → blur
       ↓
  NodeLx AST writes new text into source .jsx file
       ↓
  Vite/Next HMR reloads the iframe with the change
```

```
LIVE EDITOR (future, separate phase)

  Client visits mysite.com/admin → Supabase auth login
       ↓
  Same editing overlay as local, but writes go to Supabase
       ↓
  Live site reads content from Supabase on every request
```

---

## What's Already Built

| System | Status |
|---|---|
| Express + WebSocket server | Done (port 3001) |
| Babel AST parser | Done — reads/writes JSX |
| AST ops: text, attribute, style, class, insert, move, remove | Done — server APIs exist |
| File CRUD API | Done |
| Content store (JSON, file-watched) | Done |
| Theme manager (colors, typography, fonts) | Done |
| Split-view editor (developer code + preview) | Done — works with iframe |
| Project path config (`--project` CLI flag, UI form) | Done — just wired |
| Site URL auto-detection (`/api/health`) | Done — just wired |

**The hard backend work is mostly done.** What's missing is the visual overlay UX.

---

## Local Editor — Build Phases

---

### Phase 1 — Spawning the Dev Server
**Goal:** `nodelx start` from inside any Node.js project just works.

**Behavior:**
- Read target project's `package.json`
- Detect dev script: `dev` → `start` → `next dev` → fallback prompt
- Spawn it as a child process, pipe stdout/stderr through NodeLx
- Detect the port from output (parse "http://localhost:3000" lines)
- On NodeLx exit, kill the child process cleanly
- If the dev server crashes, surface the error in the NodeLx UI

**New files:**
- `bin/nodelx.js` — CLI entry point (`#!/usr/bin/env node`)
- `server/devServer.js` — child process manager
- Add `"bin": { "nodelx": "./bin/nodelx.js" }` to `package.json`

**Done when:** `cd into-any-nextjs-or-express-project && nodelx start` opens a single browser tab with the editor and the running site.

---

### Phase 2 — Single-Port UI (No Vite Side-Channel)
**Goal:** users only see one NodeLx URL. The editor and the site preview both come through it.

Right now: NodeLx server is on `:3001`, Vite on `:5173`, target site on `:3000`. Three URLs is too many.

**Fix:**
- In production mode: Express serves the built React client from `/client/dist`
- Single command builds the client and starts the server
- The target site stays on its own port — that's fine; we iframe it
- Vite stays for NodeLx development only, not for end users

**Done when:** end user opens `http://localhost:3001`, sees the editor + their site, and never has to know Vite exists.

---

### Phase 3 — Click-to-Edit Text Overlay
**Goal:** the visual representation of code. Click a heading on the page → type → it writes into the `.jsx` source file.

**How it works:**
1. NodeLx injects an editing script into the iframe (via `srcdoc` rewrite or postMessage handshake)
2. Script outlines all editable elements on hover (text nodes, headings, paragraphs, buttons, links)
3. Click → element becomes `contenteditable`
4. On blur or Enter:
   - postMessage → NodeLx parent
   - Parent calls existing `PATCH /api/ast/text` with `{ filePath, targetId, text }`
   - AST updates the source file
   - Dev server's HMR reloads the iframe automatically

**No new APIs needed.** This is purely the overlay UI + the message bus.

**New files:**
- `client/overlay/inject.js` — injected into iframe
- `client/overlay/textEditor.js` — click-to-edit logic
- `client/components/EditorOverlay.jsx` — parent-side message handler

**Done when:** click a headline in the iframe, type new text, see it replace the original — and `git diff` shows the change in the source `.jsx` file.

---

### Phase 4 — Click-to-Swap Images
**Goal:** click any `<img>` → upload or paste URL → the `src` updates in source code.

**How it works:**
1. Click on `<img>` in iframe → NodeLx side panel opens
2. Three options: Upload, From URL, Image Library
3. Upload → file saved to target project's `/public/uploads/` (or configured dir)
4. NodeLx calls `PATCH /api/ast/attribute` with `{ filePath, targetId, attribute: 'src', value: newPath }`
5. HMR reloads, image swaps live

**New files:**
- `client/overlay/imageSwap.js` — click handler in iframe
- `client/components/ImagePanel.jsx` — upload UI in side panel
- `server/uploads.js` — multipart upload handler writing to target project

**Done when:** click hero image, upload a new JPG, watch it appear, see new file in `/public/uploads/` and updated `src=` in source.

---

### Phase 5 — Inline Style Editing
**Goal:** select any element → side panel shows font, color, padding, margin → change values → source updates.

The AST APIs for `spacing`, `style`, `class` already exist. This phase is purely the panel UI.

**Panel sections by element type:**
- Text: font-family, size, weight, color, alignment
- Box: padding, margin, background, border
- Button: same as text + box + link URL
- Image: alt text, width, fit

**Done when:** select any element, change padding to 32px in a slider, see source `className` or inline style update.

---

### Phase 6 — Pages Panel & Multi-File Navigation
**Goal:** see all editable pages in the project, switch between them.

- Sidebar: file tree filtered to page-level components (`pages/*`, `app/**/page.tsx`, top-level routes)
- Click page → iframe navigates to its route → editing overlay rebinds
- "What changed" indicator per page (git status)

**Done when:** developer can edit homepage, click "About" in pages panel, edit that, both changes save independently.

---

### Phase 7 — Undo / Redo / History
**Goal:** edits feel safe.

- Every AST write logs to `nodelx-history.json` in the target project
- Undo: replay previous state via AST
- Redo: same in reverse
- "Recent edits" timeline in the side panel

**Done when:** developer makes 3 edits, hits Ctrl+Z three times, all reverse cleanly.

---

### Phase 8 — Works on Any Node.js Site
**Goal:** drop NodeLx into any Node.js project — Next.js, Vite+React, Astro, plain Express+EJS, etc.

**Auto-detection:**
- Next.js: scan `app/` and `pages/` for `page.tsx` / `page.jsx`
- Vite + React: scan `src/` for component files
- Express + EJS/Pug: parse template files
- Add a `nodelx.config.js` for projects that need explicit pointers

**Heuristic editable detection:**
- All `<h1>`–`<h6>`, `<p>`, `<a>`, `<button>`, `<img>` are auto-editable by default
- Developers can opt out with `data-nodelx="ignore"`
- Developers can mark complex containers with `data-nodelx="region"` to expose them

**Done when:** `nodelx start` works in three different framework templates without config.

---

## Live Editor — Future Phase (Not Now)

Once the local editor is solid, we layer the deployed `/admin` version:

| Capability | Local | Live |
|---|---|---|
| Editing UI | Same | Same |
| Where text/image edits go | Source files via AST | Supabase rows |
| Site reads content from | Source files (HMR) | Supabase at request time |
| Auth | None | Supabase magic-link login |
| Who edits | Developer | Client |

**This is a separate codebase concern.** The editor UI from Phases 3–7 is reusable. The persistence layer swaps out:
- Local: AST writes to `.jsx`
- Live: Supabase writes to `articles.content_html` (or equivalent)

We'll spec this fully when we get there.

---

## Priority Order

| Phase | Status | Estimate |
|---|---|---|
| **1** — Spawn dev server | Next | 1–2 days |
| **2** — Single-port UI | After 1 | 1 day |
| **3** — Click-to-edit text | The big one | 3 days |
| **4** — Image swap | After 3 | 2 days |
| **5** — Style editing panel | After 4 | 3–4 days |
| **6** — Pages panel | After 5 | 1–2 days |
| **7** — Undo/redo | After 6 | 2 days |
| **8** — Multi-framework | Polish phase | Ongoing |
| **Live (DB)** | Future | Separate roadmap |

**Phases 1–4 = the local editor is real.** A developer can spawn any project and visually edit it. That's the milestone before live mode is even worth designing.

---

## Tech Stack

- **Backend:** Node.js, Express, WebSocket (`ws`), Chokidar
- **Frontend:** React, Vite (dev only)
- **Parsing:** Babel AST (working)
- **Storage:** Source files (local) → Supabase (live, future)
- **Auth (live, future):** Supabase magic-link

---

*NodeLx — April 2026*
