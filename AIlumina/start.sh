#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}🌟 AIlumina Startup Script${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Function to print step headers
step() {
  echo ""
  echo -e "${BLUE}==>${NC} ${GREEN}$1${NC}"
}

# Function to print warnings
warn() {
  echo -e "${YELLOW}⚠️  $1${NC}"
}

# Function to print errors
error() {
  echo -e "${RED}❌ $1${NC}"
}

# Function to print success
success() {
  echo -e "${GREEN}✅ $1${NC}"
}

# Detect if we're in Codespaces
if [ ! -z "$CODESPACES" ]; then
  echo -e "${BLUE}🌐 Detected GitHub Codespaces environment${NC}"
  WORKSPACE_ROOT="/workspaces/$(basename $GITHUB_REPOSITORY 2>/dev/null || echo 'symagenic.com')"
else
  echo -e "${BLUE}💻 Detected local environment${NC}"
  WORKSPACE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/..)" && pwd)"
fi

AILUMINA_ROOT="$WORKSPACE_ROOT/AIlumina"
echo -e "${BLUE}📁 AIlumina root: $AILUMINA_ROOT${NC}"
echo ""

# Change to AIlumina directory
cd "$AILUMINA_ROOT" || {
  error "Failed to change to AIlumina directory"
  exit 1
}

# Step 1: Install Dependencies
step "Step 1: Installing dependencies..."

echo "📦 Installing shared package..."
cd shared && npm install && cd ..

echo "📦 Installing server dependencies..."
cd server && npm install && cd ..

echo "📦 Installing client dependencies..."
cd client && npm install && cd ..

success "All dependencies installed"

# Step 2: Build Shared Package
step "Step 2: Building shared package..."
cd shared && npm run build && cd ..
success "Shared package built"

# Step 3: Check Environment Variables
step "Step 3: Checking environment configuration..."

# Check for API keys
if [ -z "$GROQ_API_KEY" ] && [ -z "$ANTHROPIC_API_KEY" ] && [ -z "$OPENAI_API_KEY" ]; then
  warn "No AI provider API key found!"
  warn "Please set one of: GROQ_API_KEY, ANTHROPIC_API_KEY, or OPENAI_API_KEY"
  warn ""
  warn "For Codespaces: Add as a repository secret"
  warn "For local: Add to AIlumina/server/.env"
else
  if [ ! -z "$GROQ_API_KEY" ]; then
    success "Groq API key detected"
  fi
  if [ ! -z "$ANTHROPIC_API_KEY" ]; then
    success "Anthropic API key detected"
  fi
  if [ ! -z "$OPENAI_API_KEY" ]; then
    success "OpenAI API key detected"
  fi
fi

# Create/update server .env
if [ ! -f server/.env ]; then
  echo "Creating server/.env from template..."
  cp server/.env.example server/.env

  # Add API keys from environment
  if [ ! -z "$GROQ_API_KEY" ]; then
    echo "GROQ_API_KEY=$GROQ_API_KEY" >> server/.env
  fi
  if [ ! -z "$ANTHROPIC_API_KEY" ]; then
    echo "ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY" >> server/.env
  fi
  if [ ! -z "$OPENAI_API_KEY" ]; then
    echo "OPENAI_API_KEY=$OPENAI_API_KEY" >> server/.env
  fi

  success "server/.env created"
else
  success "server/.env already exists"
fi

# Create/update client .env
if [ ! -f client/.env ]; then
  echo "Creating client/.env..."

  # In Codespaces, don't set VITE_WS_URL - let it auto-detect from window.location
  # In local dev, use ws://localhost:8000
  if [ ! -z "$CODESPACES" ]; then
    echo "# In Codespaces, WebSocket URL is auto-detected from the forwarded port" > client/.env
    echo "# VITE_WS_URL=" >> client/.env
  else
    echo "VITE_WS_URL=ws://localhost:8000" > client/.env
  fi

  echo "VITE_USE_AZURE_TTS=false" >> client/.env
  success "client/.env created"
else
  success "client/.env already exists"
fi

# Step 4: Build Client
step "Step 4: Building client..."
cd client && npm run build && cd ..
success "Client built"

# Step 5: Deploy Client to Server
step "Step 5: Deploying client to server..."
npm run deploy:client
success "Client deployed to server/dist/client"

# Step 6: Final Summary
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✅ AIlumina is ready!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${BLUE}🚀 To start the server:${NC}"
echo ""
echo -e "  ${YELLOW}cd server && node src/http-server/index.js${NC}"
echo ""
echo -e "${BLUE}📍 Access URLs:${NC}"
echo ""
echo -e "  • AIlumina UI:        ${GREEN}http://localhost:8000${NC}"
echo ""
echo -e "${BLUE}🔧 Configuration:${NC}"
echo ""
echo -e "  • API Provider:       Edit ${YELLOW}server/agents.json${NC}"
echo -e "  • See examples:       ${YELLOW}server/agents.demo.json${NC}"
echo ""
echo -e "${BLUE}📝 Switching Providers:${NC}"
echo ""
echo -e "  Default: GROQ (free tier, llama-3.3-70b-versatile)"
echo ""
echo -e "  To use Anthropic Claude:"
echo -e "    ${YELLOW}cp server/agents.demo.json server/agents.json${NC}"
echo -e "    Edit to use AIlumina-Claude configuration"
echo ""
echo -e "  To use OpenAI GPT-4:"
echo -e "    Edit ${YELLOW}server/agents.json${NC}"
echo -e "    Change: \"service_provider\": \"OPENAI\""
echo -e "    Change: \"model_name\": \"gpt-4-turbo-preview\""
echo ""
echo -e "${BLUE}========================================${NC}"
echo ""

# Optional: Auto-start server
read -p "Would you like to start the server now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo ""
  success "Starting server..."
  cd server && node src/http-server/index.js
fi
