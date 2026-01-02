# NodeLx Manifesto

> **A Developer-First CMS That Refuses to Compromise**

---

## 🎯 The Problem We're Solving

Every developer has faced this nightmare:

- Client wants to "just change some text"
- You hand them WordPress/Wix → They break the entire design
- You use a headless CMS → Lock yourself into their pricing/limits/opinions
- You hard-code content → Become a glorified copy-paste assistant
- You build custom admin panels → Waste weeks on CRUD boilerplate
- You want to edit your own code visually → No tool exists for developers

**There had to be a better way.**

---

## 💡 Our Core Belief

### Code and Content Should Be Separate, But Not Distant

**Traditional CMSs got it backwards:**
- They own your content structure
- You fight their constraints
- Your code adapts to their opinions
- You pay monthly for the privilege

**NodeLx flips the script:**
- **You** own the architecture
- **You** define the structure  
- **Your** code is the source of truth
- **Your** content adapts to your code

---

## 🔑 The Two Modes: Developer vs. Client

NodeLx recognizes a fundamental truth: **Developers and clients have different needs.**

### Developer Mode (Default)

```
┌─────────────────────────────────────────────────────────────────────┐
│  🔓 DEVELOPER MODE - Full Power                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ✅ Edit text, images, content                                      │
│  ✅ Add new elements to pages                                       │
│  ✅ Change page structure                                           │
│  ✅ Modify component props                                          │
│  ✅ Access source code directly                                     │
│  ✅ Create new pages and templates                                  │
│  ✅ Full AST-based source code editing                              │
│  ✅ Git integration for version control                             │
│                                                                      │
│  This is YOUR tool. No guardrails. Full control.                    │
└─────────────────────────────────────────────────────────────────────┘
```

**Developer Mode is the default** because NodeLx is built for developers first. We don't hide complexity—we embrace it. You get:

- **Direct source code editing** via Babel AST parsing
- **File system access** to your project
- **Git integration** for safe version control
- **Full component manipulation** (add, remove, reorder)
- **Live preview** of all changes

### Client Mode (Restricted)

```
┌─────────────────────────────────────────────────────────────────────┐
│  🔒 CLIENT MODE - Safe & Simple                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ✅ Edit text and images                                            │
│  ✅ Change content in marked regions                                │
│  ✅ Live preview of changes                                         │
│  ✅ Simple, clean interface                                         │
│                                                                      │
│  ❌ Cannot add new elements                                         │
│  ❌ Cannot change page structure                                    │
│  ❌ Cannot access source code                                       │
│  ❌ Cannot break the site layout                                    │
│                                                                      │
│  Safe for clients. They edit content, you control structure.        │
└─────────────────────────────────────────────────────────────────────┘
```

**Client Mode** is what you share with clients. It uses the **content layer separation** pattern:
- Content stored in JSON files (or database)
- Clients only see editable fields
- Structure is locked—they can't break anything
- Changes are isolated from source code

---

## 🏗️ What NodeLx Is

### A Visual Layer Over Your Codebase

NodeLx is **not** a traditional CMS. It's a **dual-mode editing interface** that:

1. **Developer Mode (Default)**: Full source code editing via AST parsing
2. **Client Mode**: Safe content editing via JSON layer
3. **Reads your React/JSX components** as they are
4. **Extracts editable regions** you define
5. **Provides visual editing** with live preview
6. **Saves changes** to source files OR content layer
7. **Syncs in real-time** via WebSocket
8. **Gets out of your way** when you don't need it

### Think of it as:
- **VS Code in the browser** for developers
- **Squarespace** for clients
- **Both** at the same time
- **Switch modes** based on who's using it

---

## 🌐 Network-First Architecture

### Edit From Anywhere, Files Stay Where They Belong

NodeLx uses a **distributed client-server model** inspired by VS Code Remote Development:

```
┌──────────────────┐         ┌──────────────────┐
│  Desktop/Tablet  │  HTTP   │  Laptop/Server   │
│  (Editor UI)     │ ◄─────► │  (NodeLx Server) │
│                  │  WS     │                  │
│  localhost:5174  │         │  192.168.1.x     │
└──────────────────┘         └──────────────────┘
                                      ↓
                             ┌────────────────┐
                             │  Source Files  │
                             │  (Filesystem)  │
                             └────────────────┘
```

**Why This Matters:**

1. **Code Lives on Development Machine**  
   Your source files stay on your primary dev machine (laptop, server, etc.). No syncing, no conflicts.

2. **Edit From Any Device**  
   Use your desktop, tablet, or even phone to edit. Just point the editor to your server's IP.

3. **Real-Time Collaboration**  
   Multiple team members can connect to the same NodeLx server simultaneously. WebSocket keeps everyone in sync.

4. **No File Mounting Required**  
   Unlike SMB/NFS shares, NodeLx operates over HTTP/WebSocket. No network filesystem latency or locking issues.

5. **Works Like VS Code Remote**  
   Same proven pattern used by JetBrains Gateway, VS Code Remote Development, and SSH terminals.

**Security Model:**
- **Local Network**: Safe for LAN use (192.168.x.x)
- **Token Auth** (coming soon): Secure access for remote editing
- **HTTPS** (production): Encrypted connections for public deployments

---

## 🎨 Design Philosophy

### 1. **Developer Experience First**

```jsx
// This is all you need to make something editable:
<h1 data-editable="heroTitle">
  {content.heroTitle}
</h1>
```

No special components. No magic imports. No framework lock-in.  
**Just a data attribute.**

### 2. **Content is Data, Not Code**

Your content lives in JSON:
```json
{
  "pageId": "home",
  "content": {
    "heroTitle": "Welcome to NodeLx"
  }
}
```

- Versionable
- Portable
- Database-ready
- Framework-agnostic
- **Yours**

### 3. **Live Preview is Non-Negotiable**

Clients shouldn't have to:
- Hit "Preview"
- Open another tab
- Refresh manually
- Imagine how it looks

**They should see changes as they type.**  
Period.

### 4. **Zero Abstraction Penalty**

NodeLx doesn't wrap your components.  
It doesn't inject middleware.  
It doesn't force a rendering strategy.

**Your code runs exactly as you wrote it.**

NodeLx is a **sidecar**, not a **framework**.

---

## 🚀 What NodeLx Does

### For Developers (Developer Mode - Default)

✅ **Full Source Code Editing**: Modify JSX files directly via AST  
✅ **Add/Remove Elements**: Insert new components, delete old ones  
✅ **Change Structure**: Reorder, nest, restructure pages  
✅ **Live Preview**: See changes as you make them  
✅ **Git Integration**: Every change tracked in version control  
✅ **No Abstraction Penalty**: Your code runs exactly as written  
✅ **WebSocket Sync**: Real-time updates across all clients  
✅ **Monaco Editor**: Full VS Code editing experience in browser  

### For Clients (Client Mode)

✅ **Visual Editor**: Simple form-based content editing  
✅ **Locked Down**: Can't see or break code  
✅ **Point & Click**: Edit text, images, links inline  
✅ **Instant Preview**: See changes before saving  
✅ **Responsive Views**: Mobile/tablet/desktop preview modes  
✅ **No Training Needed**: Familiar CMS-like interface  
✅ **Can't Break Layouts**: Structure is protected  

### For Projects

✅ **Dual-Mode Architecture**: Developer power + client safety  
✅ **Content/Code Separation**: When you need it (Client Mode)  
✅ **Direct Code Access**: When you want it (Developer Mode)  
✅ **Version Control Ready**: Git integration built-in  
✅ **Database Migration Path**: Start local, move to Supabase/Postgres  
✅ **Multi-Environment**: Dev uses files, prod uses DB  
✅ **Collaboration**: Multiple editors, real-time sync  

---

## 🔮 What NodeLx Will Do

### Phase 1: Foundation (Current)
- [x] In-memory content store
- [x] File-based content (JSON)
- [x] Source mapping (AST parsing)
- [x] WebSocket live updates
- [x] Split-view editor
- [x] Responsive preview modes
- [x] Debug console

### Phase 2: Dual-Mode Architecture
- [ ] **Developer Mode (Default)**
  - [ ] Full AST-based source code editing
  - [ ] Add/remove elements in JSX
  - [ ] Change component structure
  - [ ] Monaco Editor integration
  - [ ] Git integration (commit, branch, diff)
  - [ ] File tree navigation
  - [ ] Component props editing
- [ ] **Client Mode**
  - [ ] Content layer separation (JSON)
  - [ ] Simple form-based editing
  - [ ] Locked structure (read-only layout)
  - [ ] Image upload only (no code access)
  - [ ] Mode toggle with password protection

### Phase 3: Visual Editing
- [ ] Click-to-edit on iframe elements
- [ ] Drag-to-reorder components (Developer Mode)
- [ ] Add new components from library (Developer Mode)
- [ ] Visual image cropping
- [ ] Link picker with preview
- [ ] Rich text editor (markdown-based)
- [ ] Color picker for theme values

### Phase 3: Content Management
- [ ] Multi-page dashboard
- [ ] Content search & filter
- [ ] Bulk operations
- [ ] Content templates
- [ ] Draft/publish workflow
- [ ] Version history with rollback

### Phase 4: Collaboration
- [ ] User authentication
- [ ] Role-based permissions (admin/editor/viewer)
- [ ] Conflict resolution
- [ ] Change notifications
- [ ] Activity logs
- [ ] Comment threads on content

### Phase 5: Production Ready
- [ ] Supabase integration
- [ ] PostgreSQL adapter
- [ ] CDN integration for assets
- [ ] Image optimization pipeline
- [ ] Backup/restore system
- [ ] API rate limiting
- [ ] Multi-tenant support

### Phase 6: Advanced Features
- [ ] A/B testing for content
- [ ] Scheduled publishing
- [ ] Content analytics
- [ ] SEO preview & optimization
- [ ] i18n/multi-language support
- [ ] Content relationships & references
- [ ] Custom field types
- [ ] Plugin/extension system

---

## 🎯 What NodeLx Will NEVER Do

### We Refuse To:

❌ **Own Your Content Structure**  
   → You define schemas, we adapt

❌ **Force a Frontend Framework**  
   → React, Vue, Svelte, vanilla JS—we don't care

❌ **Lock You Into Our Hosting**  
   → Self-host forever, we'll never paywall it

❌ **Dictate Your Rendering Strategy**  
   → SSR, SSG, CSR, ISR—all yours to choose

❌ **Require Special Components**  
   → Plain HTML + data attributes = editable

❌ **Charge Per Seat/Request/Project**  
   → Open source, self-hostable, yours to scale

❌ **Hide Code From Developers**  
   → Full transparency, no magic, no black boxes

❌ **Dumb Down the Developer Experience**  
   → Power users first, abstractions second

---

## 🏛️ Architecture Principles

### 1. **Separation of Concerns**
- **Content Layer**: JSON files or database
- **Code Layer**: React/JSX components
- **Bridge Layer**: NodeLx server (API + WebSocket)
- **Edit Layer**: Visual editor interface

### 2. **Progressive Enhancement**
- Works with plain HTML
- Better with data attributes
- Even better with WebSocket
- Best with full integration

### 3. **Real-Time First**
- File changes → instant updates
- Content changes → broadcast to all clients
- Editor actions → reflected in preview immediately
- Cursor moves → highlight corresponding element

### 4. **Developer Ergonomics**
```jsx
// Bad (other CMSs):
<CMSRichText fieldId="hero" />
<CMSImage fieldId="banner" transform="crop" />

// Good (NodeLx):
<h1 data-editable="hero">{content.hero}</h1>
<img data-editable="banner" src={content.banner} />
```

### 5. **Client Safety (Client Mode)**
- Clients can't see code
- Clients can't break layouts
- Clients can't create pages (unless you allow it)
- Clients can only edit what you mark as editable
- Content changes never touch source files

### 6. **Developer Power (Developer Mode)**
- Full access to source code
- Add, remove, reorder any element
- Direct AST manipulation
- Git integration for every change
- No restrictions, no guardrails

---

## 🌍 Use Cases

### Perfect For:

✅ **Agency Projects**  
   → Build custom sites, hand off content editing to clients

✅ **Marketing Sites**  
   → Devs own code, marketing owns content

✅ **Client Portfolios**  
   → Let clients update projects without touching code

✅ **Small Business Sites**  
   → Simple content updates without developer intervention

✅ **Landing Pages**  
   → A/B test copy without redeploying

✅ **Documentation Sites**  
   → Technical structure + non-technical content editing

### Not Ideal For:

❌ **Complex E-commerce** (use Shopify/WooCommerce)  
❌ **Enterprise Content Teams** (use Contentful/Sanity)  
❌ **No-Code Users** (use Webflow/Squarespace)  
❌ **Blog-Only Sites** (use WordPress/Ghost)  

**NodeLx is for developers who want control without becoming content gatekeepers.**

---

## 🎓 Philosophy in Practice

### The "Data Attribute" Decision

We could have built:
```jsx
<NodeLxText field="hero" />
<NodeLxImage field="banner" />
```

But that would mean:
- Import our components everywhere
- Lock you into our API
- Force you to learn our abstractions
- Make your code dependent on NodeLx

Instead, we chose:
```jsx
<h1 data-editable="hero">{content.hero}</h1>
<img data-editable="banner" src={content.banner} />
```

Because:
- Works with any framework
- No imports needed
- Remove NodeLx anytime
- Your code stays clean
- **HTML is the API**

### The "Split View" Decision

We could have built a separate editor at `/admin`.

But clients should **see what they're editing** as they edit it.

So we built a **split-view interface**:
- Left: Edit fields
- Right: Live preview of your actual site
- Changes sync in real-time
- What you see is what you get

**Because context matters.**

### The "JSON Content" Decision

We could have stored content in:
- A proprietary database
- A binary format
- Our cloud service

But content should be:
- Version controllable (Git)
- Human readable
- Database agnostic
- Portable

**So we chose JSON files that can migrate to any database.**

---

## 🔥 Why NodeLx Exists

### The Story

I was tired of:
- Paying $300/month for Contentful
- Fighting WordPress's opinions
- Building admin panels from scratch
- Being stuck between "no-code" and "all-code"

**So I built what I wanted:**

A system where:
- I write React components
- Clients edit content
- Neither of us is blocked
- Nobody pays a subscription

### The Bet

**We bet that developers want:**
1. Full control over code
2. Zero vendor lock-in
3. Simple client handoff
4. Real-time collaboration
5. Self-hosting options

**If we're right, NodeLx becomes essential.**  
**If we're wrong, at least we tried.**

---

## 🎯 Success Metrics

NodeLx succeeds when:

✅ Developers say: *"This is how all CMSs should work"*  
✅ Clients say: *"I can finally update my site myself"*  
✅ Agencies say: *"This saves us 10 hours per project"*  
✅ Projects say: *"We're no longer blocked on content updates"*  

**NodeLx fails if it becomes what it set out to replace.**

---

## 🤝 Invitation

This is **your** CMS as much as it's mine.

### If you're a developer:
- Use it on projects
- Fork it, customize it
- Contribute features
- Report bugs
- Share ideas

### If you're an agency:
- Test it on client work
- Give feedback
- Request features
- Help prioritize roadmap

### If you're a client:
- Tell us what's confusing
- Show us what's missing
- Help us make it better

---

## 📜 Core Promises

We promise to:

1. **Stay Open Source**  
   Forever MIT licensed, no bait-and-switch

2. **Prioritize Self-Hosting**  
   Cloud is optional, local is first-class

3. **Respect Your Architecture**  
   We adapt to you, not the other way

4. **Keep It Simple**  
   More features ≠ better, focus matters

5. **Never Paywall Core Features**  
   Everything you need should be free

6. **Listen to Developers**  
   Your workflows guide our roadmap

7. **Document Everything**  
   No magic, no surprises, no guessing

8. **Maintain Backward Compatibility**  
   Your content, your code, your trust

---

## 🌟 The Vision

**In 5 years, we want NodeLx to be:**

The **default choice** when developers need to make their React components editable.

Not because it's trendy.  
Not because it's marketed well.  
Not because it's free.

**Because it's the right tool for the job.**

---

## 🚀 Join Us

NodeLx is just getting started.

We're building **the CMS developers deserve**:
- No vendor lock-in
- No monthly fees
- No compromises
- No bullshit

**Just code that works and clients who can edit.**

---

*Built with frustration, caffeine, and a refusal to accept the status quo.*

**— The NodeLx Project**

---

## 📞 Get Involved

- **GitHub**: [github.com/aMarketology/NodeLx](https://github.com/aMarketology/NodeLx)
- **Issues**: Report bugs, request features
- **Discussions**: Share ideas, ask questions
- **Pull Requests**: Contribute code

**Star the repo if you believe in the mission.**  
**Fork it if you want to customize.**  
**Use it if you're tired of the alternatives.**

---

*Last Updated: December 6, 2025*  
*Version: 1.0.0 (Foundation Phase)*
