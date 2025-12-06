#!/bin/bash

# Quick Start Script for NodeLx Integration
# This helps you verify the setup is working

echo "🚀 NodeLx Integration Test"
echo "=========================="
echo ""

# Check if NodeLx API is running
echo "1️⃣ Checking NodeLx API (localhost:3001)..."
if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
    echo "   ✅ NodeLx API is running"
else
    echo "   ❌ NodeLx API is NOT running"
    echo "   Start it with: cd NodeLx && npm run dev"
    exit 1
fi

echo ""

# Check if your website is running
echo "2️⃣ Checking your website (localhost:3000)..."
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo "   ✅ Your website is running"
else
    echo "   ⚠️  Your website is NOT running"
    echo "   Start it with: cd YOUR_WEBSITE && npm run dev"
fi

echo ""

# Check if editor is running
echo "3️⃣ Checking NodeLx Editor (localhost:5173)..."
if curl -s http://localhost:5173 > /dev/null 2>&1; then
    echo "   ✅ NodeLx Editor is running"
else
    echo "   ⚠️  NodeLx Editor is NOT running"
    echo "   Start it with: cd NodeLx && npm run client"
fi

echo ""

# Check if content files exist
echo "4️⃣ Checking content files..."
if [ -f "./content/home-page.json" ]; then
    echo "   ✅ content/home-page.json exists"
else
    echo "   ⚠️  content/home-page.json does NOT exist"
    echo "   Create it with sample content"
fi

echo ""
echo "=========================="
echo "📊 Summary:"
echo ""
echo "Your URLs:"
echo "  • Website:    http://localhost:3000"
echo "  • API:        http://localhost:3001"
echo "  • Editor:     http://localhost:5173"
echo ""
echo "Next steps:"
echo "  1. Copy useNodeLxContent.js to your website"
echo "  2. Import and use in your components"
echo "  3. Add data-editable attributes"
echo "  4. Edit content in NodeLx Editor!"
echo ""
echo "📚 See INTEGRATION_EXAMPLE/SETUP_GUIDE.md for full instructions"
echo ""
