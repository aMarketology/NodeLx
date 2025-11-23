# NodeLx

A developer-first CMS with live preview and content editing capabilities. Think VS Code meets headless CMS with inline editing for clients.

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

Run both the backend server and Vite dev server:

```bash
npm run dev:all
```

Or run them separately:

```bash
# Terminal 1: Backend server (port 3000)
npm run dev

# Terminal 2: Vite dev server (port 5173)
npm run client
```

### How It Works

1. **Backend Server** (http://localhost:3000)
   - Serves content via REST API
   - Manages in-memory content store
   - Parses JSX files for source mapping
   - WebSocket for live updates

2. **Vite Dev Server** (http://localhost:5173)
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
