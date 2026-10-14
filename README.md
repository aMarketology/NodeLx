# NodeLx

A **headless content backend** for client websites. Think of it as a Git-backed CMS: developers connect a client's GitHub repo, and clients edit their content (text, images, blog posts) inline on their own live site — every save becomes a GitHub commit that goes live in seconds.

## How it works

```
Client site (Next.js)                     NodeLx (Express backend)
├── NodelxBridge / AdminBar  ──POST /api/admin/save──►  commits content/*.json
│   (inline text + image editing)                          to the client's GitHub repo
│                                                          + POSTs /api/revalidate
└── Admin dashboard (/admin)  ◄──reads content──  ───────►  returns fresh content
    (homepage, media, blog)
```

- **Content lives in `content/*.json`** in each client's own GitHub repo (not in a database).
- **NodeLx is stateless** — it has no database; it just commits files and revalidates.
- **The editing UI lives on the client site**, not in NodeLx.
- **Media** small images commit to the repo; large images/videos go to Supabase.

## Architecture

### For Clients
- Locked-down editing on their own site (inline text, image swap)
- A dedicated admin dashboard for structured content (homepage, media, blog)
- No code exposure — changes save to `content/*.json`, not code

### For Developers / Super Admins
- A dashboard to onboard new client sites (GitHub repo + PAT)
- A debug traffic panel to inspect every request/response between NodeLx and a client site
- An iframe editor (`/admin/editor`) with a postMessage preview bridge

## Project Structure

```
NodeLx/
├── server/                 # Node.js (Express) backend
│   ├── index.js           # Main Express server + routes
│   ├── gitSync.js         # GitHub Contents API (commit/read content files)
│   ├── mediaStore.js      # Supabase media uploads
│   ├── revalidate.js      # ISR revalidation calls to client sites
│   ├── siteTokens.js      # Per-site GitHub PAT store (gitignored)
│   ├── sites.js           # Site registry (content/sites.json)
│   ├── auth/              # JWT auth (developer/client roles)
│   └── routes/            # admin, sites, media routers
├── client/admin/          # React admin SPA (Vite)
│   ├── api.js             # API client (debug-instrumented)
│   ├── debugLog.js        # Traffic log for the Debug panel
│   ├── pages/             # Dashboard, Onboarding, Editor, Login
│   └── components/        # Layout, Brand, DebugPanel
├── content/               # sites.json (registry) + .site-tokens.json (gitignored)
└── public/                # Static assets + edit-mode scripts
```

> **Note:** the cloning/source-mapping/WebSocket features described in older
> sections of this README are **legacy** — NodeLx now uses a headless
> Git-backed model. See "Roadmap" below for current status.

## Key Concepts

### Editable Regions

Mark any JSX element with `data-editable` to make it client-editable:

```jsx
<h1 data-editable="heroTitle">
  {content.heroTitle}
</h1>
```

### Content Schema

Content lives in JSON files during development:

```json
{
  "pageId": "home",
  "content": {
    "heroTitle": "Welcome to NodeLx",
    "heroSubtitle": "Build beautiful sites",
    "heroImage": "/images/hero.jpg"
  }
}
```

### Source Mapping

The system automatically parses JSX files to create mappings between:
- Code position (line, column)
- DOM elements (data-editable IDs)

This enables cursor-to-preview highlighting.

## Getting Started

### Installation

```bash
npm install
```

### Development Mode

### Single-Process Mode (Recommended)

NodeLx serves the admin SPA from the same Express process. Build once, then run one command:

```bash
npm run build   # builds the React admin SPA into dist/
npm run dev     # single process: Express serves API + admin UI on :9000
```

Open **http://localhost:9000** — the admin panel, API, and WebSocket all come from one process.

### Development Mode (Vite hot-reload)

When iterating on the admin UI, run Vite alongside:

```bash
npm run dev:all   # Express on :9000 + Vite dev server on :5173
```

Then open **http://localhost:5173/admin.html** for hot-reloaded UI development. The Express server on :9000 still serves the last built version.

### How It Works

1. **Express Server** (http://localhost:9000)
   - Serves the built admin SPA from `dist/`
   - Serves content via REST API
   - Manages in-memory content store
   - Parses JSX files for source mapping
   - WebSocket for live updates

2. **Admin SPA** (served by Express)
   - React app with live preview
   - Connects to backend via WebSocket
   - Real-time content updates
   - Element highlighting

3. **Content Management**
   - Edit `content/*.json` files
   - Changes auto-reload in preview
   - No database needed in development

### Creating New Pages

1. Create a content file:
```bash
echo '{
  "pageId": "about",
  "content": {
    "title": "About Us"
  }
}' > content/about.json
```

2. Create a React component:
```jsx
// client/components/AboutPage.jsx
function AboutPage({ content }) {
  return (
    <h1 data-editable="title">{content.title}</h1>
  );
}
```

3. The source mapper will automatically parse it
4. The content store will automatically load it

## API Endpoints

### Content
- `GET /api/content` - Get all content
- `GET /api/content/:pageId` - Get specific page content
- `PATCH /api/content/:pageId` - Update page content

### Source Mapping
- `GET /api/sourcemap` - Get full source map
- `GET /api/sourcemap/:filename` - Get map for specific file
- `POST /api/sourcemap/find-element` - Find element at cursor position

### Health
- `GET /api/health` - Server health check

## WebSocket Events

### Client → Server
- `cursor-position` - Editor cursor moved
- `content-update` - Content changed

### Server → Client
- `highlight-element` - Highlight element in preview
- `content-store-update` - Content file changed
- `reload` - Full page reload

## Roadmap

**NodeLx is now a headless content backend** — it no longer uses the WebSocket/source-mapping model described above. It commits `content/*.json` to each client's GitHub repo and revalidates the live site on every save. The editing UX lives on the client site itself (Inline Editor + Admin Dashboard).

### The three editing capabilities

Each capability is independently permissioned per client:

| Capability | Status | Where it runs |
|---|---|---|
| **Text editing** | ✅ Done | Client site inline editor (`NodelxBridge`) |
| **Image swapping** | ✅ Done | Client site inline editor (`ImageSwapModal`) |
| **Blog writing** | ✅ Done (williamb) | Client admin dashboard (`/admin/blog`) |

### Core (done)

- [x] Headless Git-backed publishing (commit `content/*.json` → client GitHub repo)
- [x] ISR revalidation (call `/api/revalidate` on the client after each commit)
- [x] Media upload (small images → GitHub, large/video → Supabase)
- [x] Multi-site registry (`content/sites.json`)
- [x] Per-site GitHub PAT store (`content/.site-tokens.json`)
- [x] Bridge API (`NODELX_API_KEY`) for the client's own admin panel
- [x] Client-side inline editor (`NodelxBridge` + `AdminBar`) — text + images
- [x] Admin dashboard (`/admin`) with homepage + media + blog editors
- [x] Debug traffic panel (NodeLx editor, super-admin only)
- [x] postMessage preview bridge (`nodelx-preview.js`) for iframe editing

### In progress / next

- [ ] Per-capability permission flags (text / image / blog toggle per client)
- [ ] Blog editor: full body blocks (numberedItems, FAQ, CTA) — currently metadata + intro only
- [ ] Version history (audit trail of commits per content file)

### Not started

- [ ] Supabase row-level auth (optional future)
- [ ] Developer code editor with syntax highlighting (deprioritized — editing is content-only)

## Production Deployment

When ready to deploy:

1. Content and templates get pushed to Supabase
2. Site connects to a domain
3. Client editing interface enabled for production

(Implementation coming soon in `publish/` directory)

## Tech Stack

- **Backend**: Node.js, Express, WebSocket (ws)
- **Frontend**: React, Vite
- **Parsing**: Babel (AST parsing for source maps)
- **File Watching**: Chokidar
- **Production**: Supabase (planned)

## License

ISC
