#!/bin/bash
set -e

echo "🚀 Setting up StoneMonkey - AI Consciousness Research Platform..."
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Navigate to StoneMonkey directory
cd /workspaces/$(basename $GITHUB_REPOSITORY || echo "symagenic.com")/StoneMonkey || cd /workspace/StoneMonkey

echo -e "${BLUE}📦 Installing dependencies...${NC}"

# Install root dependencies
npm install

# Install workspace dependencies
echo -e "${BLUE}📦 Installing shared dependencies...${NC}"
cd shared && npm install && cd ..

echo -e "${BLUE}📦 Installing server dependencies...${NC}"
cd server && npm install && cd ..

echo -e "${BLUE}📦 Installing client dependencies...${NC}"
cd client && npm install && cd ..

echo ""
echo -e "${BLUE}⚙️  Setting up environment files...${NC}"

# Create server .env if it doesn't exist
if [ ! -f server/.env ]; then
  echo "Creating server/.env from template..."
  cp server/.env.example server/.env

  # If GROQ_API_KEY is set, add it to server/.env
  if [ ! -z "$GROQ_API_KEY" ]; then
    echo "GROQ_API_KEY=${GROQ_API_KEY}" >> server/.env
    echo -e "${GREEN}✅ Groq API key configured${NC}"
  fi

  # If ANTHROPIC_API_KEY is set, add it to server/.env
  if [ ! -z "$ANTHROPIC_API_KEY" ]; then
    echo "ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}" >> server/.env
    echo -e "${GREEN}✅ Anthropic API key configured${NC}"
  fi
fi

# Create client .env if it doesn't exist
if [ ! -f client/.env ]; then
  echo "Creating client/.env..."
  echo "VITE_WS_URL=ws://localhost:8000" > client/.env
  echo "VITE_USE_AZURE_TTS=false" >> client/.env
  echo -e "${GREEN}✅ Client environment configured${NC}"
fi

echo ""
echo -e "${BLUE}🐳 Starting infrastructure (Neo4j, Redis, Qdrant, Embeddings)...${NC}"

# Start infrastructure in background
docker-compose up -d

echo ""
echo -e "${BLUE}⏳ Waiting for infrastructure to be ready...${NC}"
sleep 15

echo ""
echo -e "${BLUE}🔨 Building client...${NC}"
cd client && npm run build && cd ..

echo ""
echo -e "${GREEN}✅ Setup complete!${NC}"
echo ""
echo -e "${BLUE}📋 Next steps:${NC}"
echo "  1. Run: bun run dev (or npm run dev)"
echo "  2. Open: http://localhost:8000"
echo ""
echo -e "${BLUE}🌐 Available services:${NC}"
echo "  • AIlumina UI: http://localhost:8000"
echo "  • Neo4j Browser: http://localhost:7474 (user: neo4j, pass: stonemonkey)"
echo "  • Qdrant Dashboard: http://localhost:6333/dashboard"
echo ""
echo -e "${BLUE}💡 Tips:${NC}"
echo "  • Infrastructure is running in Docker containers"
echo "  • Use 'docker-compose ps' to check service status"
echo "  • Use 'docker-compose logs -f' to view logs"
echo ""
