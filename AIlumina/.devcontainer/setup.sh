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

# Install shared dependencies
echo "📦 Installing shared dependencies..."
cd shared && npm install && cd ..

# Install server dependencies
echo "📦 Installing server dependencies..."
cd server && npm install && cd ..

# Install client dependencies
echo "📦 Installing client dependencies..."
cd client && npm install && cd ..

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
