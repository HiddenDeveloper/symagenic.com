# Ailumina TypeScript Server Dockerfile
# Build from StoneMonkey root with: docker build -f server/Dockerfile .

FROM oven/bun:1.2.21

# Install curl for health checks
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy server files
COPY server/package.json ./
COPY server/bun.lock* ./

# Install dependencies
RUN bun install

# Copy server source code and config
COPY server/src ./src/
COPY server/agents.json ./
COPY server/server_config.json ./
COPY server/tsconfig.json ./

# Create data and client directories
RUN mkdir -p /app/data/conversations /app/backups/agents /app/client/dist

# Copy pre-built React frontend (optional - comment out if client not built)
# COPY client/dist ./client/dist/

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

# Start server - run TypeScript directly (Bun transpiles on-the-fly)
CMD ["bun", "run", "src/http-server/index.ts"]
