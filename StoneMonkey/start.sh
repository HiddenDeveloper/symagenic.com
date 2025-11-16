#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}🐒 StoneMonkey Startup Script${NC}"
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
  WORKSPACE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fi

STONEMONKEY_ROOT="$WORKSPACE_ROOT/StoneMonkey"
echo -e "${BLUE}📁 StoneMonkey root: $STONEMONKEY_ROOT${NC}"
echo ""

# Change to StoneMonkey directory
cd "$STONEMONKEY_ROOT" || {
  error "Failed to change to StoneMonkey directory"
  exit 1
}

# Step 1: Check/Install Bun
step "Step 1: Checking for Bun runtime..."
if ! command -v bun &> /dev/null; then
  warn "Bun not found, installing..."
  curl -fsSL https://bun.sh/install | bash

  # Source bun environment
  export BUN_INSTALL="$HOME/.bun"
  export PATH="$BUN_INSTALL/bin:$PATH"

  # Also add to bashrc if not already there
  if ! grep -q 'BUN_INSTALL' ~/.bashrc; then
    echo 'export BUN_INSTALL="$HOME/.bun"' >> ~/.bashrc
    echo 'export PATH="$BUN_INSTALL/bin:$PATH"' >> ~/.bashrc
  fi

  if command -v bun &> /dev/null; then
    success "Bun installed successfully ($(bun --version))"
  else
    error "Failed to install Bun"
    exit 1
  fi
else
  success "Bun already installed ($(bun --version))"
fi

# Step 2: Install Dependencies
step "Step 2: Installing dependencies..."

echo "📦 Installing root dependencies..."
npm install

echo "📦 Installing shared package..."
cd shared && npm install && cd ..

echo "📦 Installing server dependencies..."
cd server && npm install && cd ..

echo "📦 Installing client dependencies..."
cd client && npm install && cd ..

success "All dependencies installed"

# Step 3: Build Shared Package
step "Step 3: Building shared package..."
cd shared && npm run build && cd ..
success "Shared package built"

# Step 4: Check Environment Variables
step "Step 4: Checking environment configuration..."

# Check for API keys
if [ -z "$GROQ_API_KEY" ] && [ -z "$ANTHROPIC_API_KEY" ] && [ -z "$OPENAI_API_KEY" ]; then
  warn "No AI provider API key found!"
  warn "Please set one of: GROQ_API_KEY, ANTHROPIC_API_KEY, or OPENAI_API_KEY"
  warn ""
  warn "For Codespaces: Add as a repository secret"
  warn "For local: Add to StoneMonkey/server/.env"
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

# Step 5: Start Infrastructure
step "Step 5: Starting infrastructure (Docker)..."

# Check if Docker is available
if ! command -v docker &> /dev/null; then
  error "Docker not found! Please install Docker first."
  exit 1
fi

# Check if docker daemon is running
if ! docker info &> /dev/null; then
  error "Docker daemon is not running! Please start Docker."
  exit 1
fi

echo "🐳 Starting Docker containers..."
docker-compose up -d

echo "⏳ Waiting for infrastructure to be ready (15 seconds)..."
sleep 15

# Check container status
echo ""
echo "📊 Infrastructure status:"
docker-compose ps

# Count healthy containers
HEALTHY_COUNT=$(docker-compose ps --format json 2>/dev/null | grep -c '"State":"running"' || echo "0")

if [ "$HEALTHY_COUNT" -ge 4 ]; then
  success "All infrastructure services running"
else
  warn "Some infrastructure services may not be ready yet"
  warn "Check with: docker-compose ps"
fi

# Step 6: Build Client
step "Step 6: Building client..."
cd client && npm run build && cd ..
success "Client built"

# Step 7: Deploy Client to Server
step "Step 7: Deploying client to server..."
npm run deploy:client
success "Client deployed to server/dist/client"

# Step 8: Final Summary
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✅ StoneMonkey is ready!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${BLUE}🚀 To start the server:${NC}"
echo ""
echo -e "  ${YELLOW}cd server && bun src/http-server/index.ts${NC}"
echo ""
echo -e "${BLUE}📍 Access URLs:${NC}"
echo ""
echo -e "  • AIlumina UI:        ${GREEN}http://localhost:8000${NC}"
echo -e "  • Neo4j Browser:      ${GREEN}http://localhost:7474${NC} (user: neo4j, pass: stonemonkey)"
echo -e "  • Qdrant Dashboard:   ${GREEN}http://localhost:6333/dashboard${NC}"
echo ""
echo -e "${BLUE}🛠️  Useful commands:${NC}"
echo ""
echo -e "  ${YELLOW}docker-compose ps${NC}              Check infrastructure status"
echo -e "  ${YELLOW}docker-compose logs -f${NC}         View infrastructure logs"
echo -e "  ${YELLOW}docker-compose down${NC}            Stop infrastructure"
echo -e "  ${YELLOW}docker-compose restart${NC}         Restart infrastructure"
echo ""
echo -e "${BLUE}========================================${NC}"
echo ""

# Optional: Auto-start server
read -p "Would you like to start the server now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo ""
  success "Starting server..."
  cd server && bun src/http-server/index.ts
fi
