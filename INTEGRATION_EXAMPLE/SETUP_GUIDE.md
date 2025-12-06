# How to Connect Your Website (localhost:3000) to NodeLx

This guide shows you how to integrate NodeLx with your existing Node.js website running on `localhost:3000`.

---

## 🎯 What You'll Have When Done

```
┌──────────────────────────────────────┐
│  YOUR WEBSITE (localhost:3000)       │  ← Your actual site
│  - Fetches content from NodeLx       │
│  - Updates in real-time via WebSocket│
└──────────────────────────────────────┘
            ↕️ API + WebSocket
┌──────────────────────────────────────┐
│  NODELX API (localhost:3001)         │  ← Content backend
│  - Serves content via REST API       │
│  - Broadcasts changes                │
└──────────────────────────────────────┘
            ↕️ Updates from
┌──────────────────────────────────────┐
│  NODELX EDITOR (localhost:5173)      │  ← Visual editor
│  - Edit content on left              │
│  - See localhost:3000 on right       │
└──────────────────────────────────────┘
```

---

## 📦 Step 1: Copy the Integration Files

Copy these files to your website project:

### 1.1 Copy the Hook

```bash
# From NodeLx directory
cp INTEGRATION_EXAMPLE/useNodeLxContent.js YOUR_WEBSITE/hooks/
```

Or create `YOUR_WEBSITE/hooks/useNodeLxContent.js` and paste the code from:
`NodeLx/INTEGRATION_EXAMPLE/useNodeLxContent.js`

### 1.2 (Optional) Copy Example Components

```bash
cp INTEGRATION_EXAMPLE/ExampleComponents.jsx YOUR_WEBSITE/components/
```

---

## 🔧 Step 2: Configure Your Website

### 2.1 Add Environment Variable (Optional)

Create or update `.env.local` in your website:

```env
# Point to NodeLx API
NEXT_PUBLIC_NODELX_API=http://localhost:3001

# Or for other frameworks:
REACT_APP_NODELX_API=http://localhost:3001
VITE_NODELX_API=http://localhost:3001
```

The hook will default to `http://localhost:3001` if this isn't set.

---

## 🎨 Step 3: Update Your Components

### Before (Hard-coded content):

```jsx
export default function HomePage() {
  return (
    <div>
      <h1>Welcome to My Site</h1>
      <p>This is my website</p>
    </div>
  );
}
```

### After (NodeLx content):

```jsx
import { useNodeLxContent } from '../hooks/useNodeLxContent';

export default function HomePage() {
  const { content, loading, error } = useNodeLxContent('home-page');

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <h1 data-editable="heroTitle">{content.heroTitle}</h1>
      <p data-editable="heroSubtitle">{content.heroSubtitle}</p>
    </div>
  );
}
```

**Important**: Add `data-editable` attributes to elements you want editable!

---

## 📝 Step 4: Create Content Files

Create a content file in NodeLx that matches your page ID:

### In NodeLx project:

Create `content/home-page.json`:

```json
{
  "heroTitle": "Welcome to My Site",
  "heroSubtitle": "This is my website",
  "heroImage": "/images/hero.jpg",
  "heroImageAlt": "Hero image",
  "ctaText": "Get Started",
  "ctaLink": "/signup"
}
```

**Tip**: The file name (minus `.json`) is your `pageId`. So:
- `home-page.json` → `useNodeLxContent('home-page')`
- `about-page.json` → `useNodeLxContent('about-page')`
- `contact.json` → `useNodeLxContent('contact')`

---

## 🚀 Step 5: Start Everything

You need **3 terminals** running simultaneously:

### Terminal 1: Your Website

```bash
cd YOUR_WEBSITE
npm run dev  # or yarn dev, or pnpm dev
# Should start on http://localhost:3000
```

### Terminal 2: NodeLx API

```bash
cd NodeLx
npm run dev
# Starts API on http://localhost:3001
```

### Terminal 3: NodeLx Editor

```bash
cd NodeLx
npm run client
# Starts editor on http://localhost:5173
```

---

## 🎯 Step 6: Test It!

### 6.1 Open Your Website

Visit: **http://localhost:3000**

You should see content from `content/home-page.json`

### 6.2 Open NodeLx Editor

Visit: **http://localhost:5173**

- Left panel: Content editor
- Right panel: Change the URL to `http://localhost:3000`

### 6.3 Make a Change

1. In the NodeLx editor, change the "heroTitle" field
2. Click "Save"
3. Watch the right panel (your website) update instantly! ✨

---

## 🔍 Troubleshooting

### Problem: "Failed to fetch content"

**Check:**
1. Is NodeLx API running? Visit http://localhost:3001/api/health
2. Does the content file exist? Check `NodeLx/content/home-page.json`
3. Is CORS enabled? Check `NodeLx/server/index.js` line 27

### Problem: "No real-time updates"

**Check:**
1. Open browser console, look for `[NodeLx] WebSocket connected`
2. Check WebSocket connection in Network tab (WS/WSS)
3. Make sure NodeLx API is running on port 3001

### Problem: "Content not found"

**Check:**
1. Page ID matches file name: `useNodeLxContent('home-page')` needs `content/home-page.json`
2. File is valid JSON (no syntax errors)
3. Content Store is watching the correct directory

---

## 📚 Common Patterns

### Pattern 1: Multiple Pages

```jsx
// pages/index.js
import { useNodeLxContent } from '../hooks/useNodeLxContent';

export default function HomePage() {
  const { content } = useNodeLxContent('home-page');
  return <h1>{content?.title}</h1>;
}

// pages/about.js
export default function AboutPage() {
  const { content } = useNodeLxContent('about-page');
  return <h1>{content?.title}</h1>;
}
```

### Pattern 2: Shared Header/Footer

```jsx
// components/Header.js
import { useNodeLxContent } from '../hooks/useNodeLxContent';

export default function Header() {
  const { content } = useNodeLxContent('global-header');
  
  return (
    <header>
      <h1 data-editable="siteName">{content?.siteName}</h1>
      <nav>
        <a data-editable="navLink1" href={content?.navLink1}>
          {content?.navLabel1}
        </a>
      </nav>
    </header>
  );
}
```

Create `content/global-header.json`:
```json
{
  "siteName": "My Website",
  "navLink1": "/about",
  "navLabel1": "About"
}
```

### Pattern 3: Array/List Content

```jsx
// For a features section
const { content } = useNodeLxContent('features');

return (
  <div>
    <h2 data-editable="featuresTitle">{content?.featuresTitle}</h2>
    <div>
      <div>
        <h3 data-editable="feature1Title">{content?.feature1Title}</h3>
        <p data-editable="feature1Text">{content?.feature1Text}</p>
      </div>
      <div>
        <h3 data-editable="feature2Title">{content?.feature2Title}</h3>
        <p data-editable="feature2Text">{content?.feature2Text}</p>
      </div>
    </div>
  </div>
);
```

`content/features.json`:
```json
{
  "featuresTitle": "Our Features",
  "feature1Title": "Fast",
  "feature1Text": "Lightning fast performance",
  "feature2Title": "Secure",
  "feature2Text": "Bank-level security"
}
```

### Pattern 4: Images

```jsx
const { content } = useNodeLxContent('home-page');

return (
  <img 
    data-editable="heroImage"
    src={content?.heroImage}
    alt={content?.heroImageAlt || ''}
    style={{ width: '100%', height: 'auto' }}
  />
);
```

---

## 🎨 Using NodeLx Editor

### 1. Open Editor
Visit: http://localhost:5173

### 2. Configure Preview URL
- In the right panel URL bar, enter: `http://localhost:3000`
- Hit Enter

### 3. Edit Content
- Left panel shows all editable fields from your content file
- Click a field, type new text
- Click "Save" button

### 4. Watch Live Update
- Your website (in right panel iframe) updates instantly
- If you have your website open in another tab, it updates there too!

### 5. View Console (Optional)
- Click "Debug Console" toggle
- See all API calls, WebSocket events, and updates

---

## 🚀 Next Steps

### 1. Add More Pages

Create more content files:
- `content/about-page.json`
- `content/contact-page.json`
- `content/blog-post-1.json`

Use in components:
```jsx
const { content } = useNodeLxContent('about-page');
const { content } = useNodeLxContent('contact-page');
const { content } = useNodeLxContent('blog-post-1');
```

### 2. Add More Fields

Edit your content JSON files to add more editable fields:

```json
{
  "heroTitle": "Welcome",
  "heroSubtitle": "Subtitle here",
  "heroImage": "/images/hero.jpg",
  "features": [
    { "title": "Fast", "icon": "⚡" },
    { "title": "Secure", "icon": "🔒" }
  ],
  "testimonial": {
    "quote": "Great product!",
    "author": "John Doe"
  }
}
```

### 3. Deploy to Production

When ready for production:

1. **Deploy NodeLx API**:
   - Deploy to Heroku, Railway, Fly.io, or VPS
   - Example: `https://api.yourdomain.com`

2. **Update your website's `.env`**:
   ```env
   NEXT_PUBLIC_NODELX_API=https://api.yourdomain.com
   ```

3. **Password-protect the editor**:
   - Deploy editor to `https://editor.yourdomain.com`
   - Add authentication (coming in Phase 4)

---

## 💡 Pro Tips

### Tip 1: Add a Dev Indicator

Show connection status in development:

```jsx
const { isConnected } = useNodeLxContent('home-page');

{process.env.NODE_ENV === 'development' && (
  <div style={{
    position: 'fixed',
    top: 10,
    right: 10,
    padding: '5px 10px',
    background: isConnected ? 'green' : 'red',
    color: 'white',
    borderRadius: '4px',
  }}>
    {isConnected ? '🟢 NodeLx' : '🔴 Disconnected'}
  </div>
)}
```

### Tip 2: Error Boundaries

Wrap NodeLx content in error boundaries:

```jsx
class ErrorBoundary extends React.Component {
  state = { hasError: false };
  
  static getDerivedStateFromError(error) {
    return { hasError: true };
  }
  
  render() {
    if (this.state.hasError) {
      return <h1>Something went wrong loading content.</h1>;
    }
    return this.props.children;
  }
}

// Use it:
<ErrorBoundary>
  <YourComponentWithNodeLx />
</ErrorBoundary>
```

### Tip 3: Loading States

Make loading states nice:

```jsx
const { content, loading } = useNodeLxContent('home-page');

if (loading) {
  return (
    <div className="animate-pulse">
      <div className="h-8 bg-gray-200 rounded w-3/4 mb-4"></div>
      <div className="h-4 bg-gray-200 rounded w-1/2"></div>
    </div>
  );
}
```

---

## 🎉 You're All Set!

You now have:
- ✅ Your website fetching content from NodeLx
- ✅ Real-time updates via WebSocket
- ✅ Visual editor showing your site in iframe
- ✅ Instant preview of changes

**Edit content → See changes instantly → No code deployment needed!**

---

## 📞 Need Help?

- Check the main [README.md](../README.md)
- See [ARCHITECTURE_PROOF.md](../ARCHITECTURE_PROOF.md) for technical details
- Review [ExampleComponents.jsx](./ExampleComponents.jsx) for more patterns
- Open an issue on GitHub

---

**Happy editing! 🚀**
