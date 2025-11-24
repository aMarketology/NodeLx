# 🎉 Split View Editor - Setup Complete!

## What You Just Built

A **professional split-view editor** with:
- ✅ Live iframe preview of your Austin Crate site
- ✅ Side-by-side content editing
- ✅ Responsive viewport controls (Desktop/Tablet/Mobile)
- ✅ Auto-refresh on save
- ✅ Clean, modern UI

---

## 🚀 How to Use It

### Step 1: Start NodeLx
```powershell
cd "C:\Users\Allied Gaming\Documents\GitHub\NodeLx"
npm run dev:all
```

**This starts:**
- Backend API: `http://localhost:3001`
- Editor Interface: `http://localhost:5173`

---

### Step 2: Start Your Austin Crate Site
```powershell
cd "C:\Users\Allied Gaming\Documents\GitHub\austin-crate"
npm run dev
```

**This starts:**
- Your Website: `http://localhost:3000`

---

### Step 3: Open the Split View Editor

1. **Open browser**: `http://localhost:5173`
2. **Click "Split View" tab** at the top
3. **See your Austin Crate site** in the right panel
4. **Edit content** in the left panel

---

## 🎨 Using the Editor

### Left Panel - Content Editor
- Browse all content fields
- Click "✎ Edit" on any field
- Type new content
- Press **Enter** to save (or click Save button)
- Changes auto-refresh the preview!

### Right Panel - Live Preview
- Shows your actual site running on localhost:3000
- **Viewport Toggle**: 📱 Mobile | 📱︎ Tablet | 🖥️ Desktop
- **Refresh Button**: Manually reload preview
- **URL Bar**: Change preview URL if needed

---

## ✨ Key Features

### 1. **Real-Time Preview**
Edit → Save → Preview refreshes automatically

### 2. **Responsive Testing**
Test how content looks on different devices instantly

### 3. **Side-by-Side Workflow**
No more switching tabs - edit and see results together

### 4. **Keyboard Shortcuts**
- **Enter**: Save changes
- **Esc**: Cancel editing

---

## 📝 Current Status

### ✅ What's Working
- Split view layout
- Content editing
- Live iframe preview
- Auto-refresh on save
- Responsive viewport controls
- URL customization

### 🔄 Next Steps (Optional Enhancements)
- Image upload support
- Rich text editor
- Click-to-edit on the iframe
- Multi-page management
- Undo/Redo

---

## 🎯 The Workflow

```
1. Edit content in left panel
   ↓
2. Click Save
   ↓
3. Content saved to JSON
   ↓
4. Preview auto-refreshes
   ↓
5. See changes instantly!
```

---

## 🐛 Troubleshooting

### Preview shows "Cannot connect"
- Make sure your Austin Crate site is running on `localhost:3000`
- Check the URL in the preview bar

### Changes not showing
- Click the "↻ Refresh" button
- Make sure you clicked "Save" after editing

### Split view not appearing
- Click "Split View" tab at the top
- Refresh the page if needed

---

## 🎬 Ready to Test!

1. **Both servers running?** ✓
2. **Open** `http://localhost:5173`
3. **Click** "Split View" tab
4. **Start editing!**

The split view should show:
- Left: Content fields for austin-crate-home
- Right: Your Austin Crate website in an iframe

**Try editing the "mainHeadline" field and watch it update in the preview!**

---

## What's Next?

Once you've tested the split view, let me know if you want to add:
- **Image uploads** (change logos/photos visually)
- **Click-to-edit** on the preview itself
- **Multiple pages** support
- Or any other feature!
