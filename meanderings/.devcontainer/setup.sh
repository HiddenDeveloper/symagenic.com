#!/bin/bash
set -e

echo "🚀 Setting up AIlumina development environment..."

# Install Bun
echo "📦 Installing Bun..."
curl -fsSL https://bun.sh/install | bash
export PATH="$HOME/.bun/bin:$PATH"

# Install root dependencies
echo "📦 Installing root dependencies..."
npm install

# Install and build shared dependencies
echo "📦 Installing and building shared package..."
cd shared && npm install && npm run build && cd ..

# Install server dependencies
echo "📦 Installing server dependencies..."
cd server && npm install && cd ..

# Install client dependencies
echo "📦 Installing client dependencies..."
cd client && npm install && cd ..

# Set up demo agents configuration
echo "⚙️  Setting up Groq demo configuration..."
cp server/agents.demo.json server/agents.json

echo "✅ Setup complete!"
echo ""
echo "🎯 Quick Start:"
echo "  npm run dev        - Start both backend and frontend"
echo "  npm run dev:server - Start backend only"
echo "  npm run dev:client - Start frontend only"
echo ""
echo "🔑 Environment Variables:"
echo "  GROQ_API_KEY - Required for AI inference (get free key from console.groq.com)"
echo ""
echo "📚 Ports:"
echo "  3000 - Backend WebSocket server"
echo "  5173 - Frontend Vite dev server"
