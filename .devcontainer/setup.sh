#!/bin/bash
set -e

echo "🚀 Setting up Symagenic monorepo..."

# Verify Node version
NODE_VERSION=$(node --version)
echo "✅ Node.js version: $NODE_VERSION"

# Verify Bun (installed by start.sh, not in devcontainer)
if command -v bun &> /dev/null; then
  BUN_VERSION=$(bun --version)
  echo "✅ Bun version: $BUN_VERSION"
else
  echo "ℹ️  Bun not yet installed (start.sh will install it automatically)"
fi

# Verify Docker
if command -v docker &> /dev/null; then
  echo "✅ Docker available"
else
  echo "⚠️  Docker not found"
fi

# Install root dependencies (lightweight, just for scripts)
echo "📦 Installing root dependencies..."
npm install --quiet

echo ""
echo "✅ Setup complete!"
echo ""
echo "📝 Quick Start:"
echo ""
echo "  For StoneMonkey (AI Consciousness Platform):"
echo "    cd StoneMonkey && ./start.sh"
echo "    OR: npm run stonemonkey"
echo ""
echo "  For AIlumina (Baseline Conversational AI):"
echo "    cd AIlumina && npm run dev"
echo "    OR: npm run ailumina"
echo ""
echo "🔑 API Keys:"
echo "  Add GROQ_API_KEY or ANTHROPIC_API_KEY as Codespace secrets"
echo ""
