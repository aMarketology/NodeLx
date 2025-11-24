# NodeLx + Austin Crate Integration Guide

## Setup Complete! ✅

NodeLx is now configured to work alongside your Austin Crate Next.js website.

## What Changed

### 1. **Port Configuration**
- **NodeLx Backend**: Now runs on port `3001` (was 3000)
- **Your Next.js Site**: Stays on port `3000`
- No conflicts between the two servers

### 2. **CORS Enabled**
- NodeLx accepts requests from `localhost:3000` (your Next.js site)
- NodeLx accepts requests from `localhost:5173` (NodeLx frontend)

### 3. **Content Created**
- Created `content/austin-crate-home.json` with all your page content
- Includes: headlines, descriptions, phone number, stats, service titles, etc.

### 4. **Visual Editor Built**
- New `ContentEditor` component for editing content visually
- Click-to-edit any field
- Real-time save with WebSocket updates

---

## How to Use

### Step 1: Start NodeLx
```powershell
# In the NodeLx directory
npm run dev:all
```

This starts:
- Backend API on `http://localhost:3001`
- Frontend Editor on `http://localhost:5173`

### Step 2: View the Editor
Open `http://localhost:5173` in your browser

You'll see two tabs:
- **Preview**: Shows the sample HomePage (with editable content)
- **Content Editor**: Visual form to edit all content fields

### Step 3: Edit Content
1. Click "Content Editor" tab
2. Click "Edit" on any field
3. Modify the text
4. Press Enter or click "Save"
5. Changes are saved to `content/austin-crate-home.json`

---

## Next Steps: Connect to Your Austin Crate Site

To make your Austin Crate website editable through NodeLx:

### Option A: Fetch from NodeLx API

Add this to your Austin Crate `page.tsx`:

```typescript
'use client'

import { useState, useEffect } from 'react'

export default function Home() {
  const [content, setContent] = useState<any>(null)

  useEffect(() => {
    // Fetch from NodeLx
    fetch('http://localhost:3001/api/content/austin-crate-home')
      .then(res => res.json())
      .then(data => setContent(data.content))
  }, [])

  if (!content) return <div>Loading...</div>

  return (
    <div>
      <h1 data-editable="mainHeadline">{content.mainHeadline}</h1>
      <h2 data-editable="subHeadline">{content.subHeadline}</h2>
      <p data-editable="heroDescription">{content.heroDescription}</p>
      {/* ... rest of your content using content.fieldName */}
    </div>
  )
}
```

### Option B: Visual Editing with Click-to-Edit

Add NodeLx's client library to your Austin Crate site to enable:
- Click any element to edit
- Live preview updates
- Save directly from your site

---

## API Endpoints

NodeLx provides these endpoints:

### Get Content
```
GET http://localhost:3001/api/content/austin-crate-home
```

### Update Content
```
PATCH http://localhost:3001/api/content/austin-crate-home
Content-Type: application/json

{
  "content": {
    "mainHeadline": "New Headline"
  }
}
```

### List All Content
```
GET http://localhost:3001/api/content
```

---

## Visual Editor Features

✅ **Click-to-Edit**: Click "Edit" on any field to modify
✅ **Real-time Save**: Changes save immediately to JSON files
✅ **Live Updates**: WebSocket notifies all connected clients
✅ **Field Search**: All content fields listed in one place
✅ **Keyboard Shortcuts**: Enter to save, Esc to cancel

---

## File Structure

```
NodeLx/
├── content/
│   ├── sample-page.json          # Original demo content
│   └── austin-crate-home.json    # Your Austin Crate content ✨
├── server/
│   └── index.js                  # Backend on port 3001 ✨
├── client/
│   ├── App.jsx                   # Updated for port 3001 ✨
│   └── components/
│       ├── ContentEditor.jsx     # New visual editor ✨
│       └── ContentEditor.css     # Editor styling ✨
```

---

## Testing the Setup

1. **Start NodeLx**: `npm run dev:all`
2. **Open Editor**: http://localhost:5173
3. **Switch to "Content Editor" tab**
4. **Edit any field** (e.g., change "Austin Crate" to "Austin Crate Test")
5. **Save the change**
6. **Check the file**: Open `content/austin-crate-home.json` to see the update

---

## Next: Making Austin Crate Editable

Would you like me to:
1. **Create the modified Austin Crate page.tsx** that fetches from NodeLx?
2. **Add inline editing** to your Austin Crate site?
3. **Create more content files** for other pages?

Let me know what you'd like to tackle next!
