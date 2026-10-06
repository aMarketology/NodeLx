# NodeLx

A developer-first CMS with live preview and content editing capabilities. Think VS Code meets headless CMS with inline editing for clients.

## 🌐 Network-Enabled Editing

NodeLx now supports **distributed editing** over your local network! Edit from any device while your source code stays on your development machine.

```
Desktop/Tablet  ──HTTP/WS──►  Laptop (Server + Files)
```

[📖 See Network Setup Guide](NETWORK_SETUP.md) for configuration instructions.

## Architecture

### For Developers
- Real-time code editor with live preview
- Cursor-to-DOM element highlighting
- Full control over templates, components, and structure
- React/JSX component system

### For Clients
- Locked-down editing interface
- Only modify content (text, images, links)
- No code exposure
- Changes save to content layer, not codebase

## Project Structure

```
NodeLx/
├── server/                 # Node.js backend
│   ├── index.js           # Main Express server
│   ├── contentStore.js    # In-memory content management
│   ├── sourceMap.js       # JSX-to-DOM mapping
│   └── websocket.js       # WebSocket for live updates
├── client/                # React frontend
│   ├── App.jsx            # Main app with live preview
│   ├── main.jsx           # Entry point
│   ├── components/        # React components (templates)
│   │   └── HomePage.jsx   # Sample component with editable regions
│   ├── editor/            # Developer editor (TODO)
│   └── preview/           # Preview interface (TODO)
├── content/               # JSON content files (dev mode)
│   └── sample-page.json   # Sample content
├── publish/               # Supabase publishing (TODO)
└── public/                # Static assets
```

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

- [x] In-memory content store with file watching
- [x] Source mapping system for JSX
- [x] WebSocket live updates
- [x] Basic React preview
- [ ] Developer editor with syntax highlighting
- [ ] Client editing interface overlay
- [ ] Supabase integration for publishing
- [ ] Authentication and permissions
- [ ] Multi-page support
- [ ] Asset management
- [ ] Version history

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
