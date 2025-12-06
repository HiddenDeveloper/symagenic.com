# Ailumina TypeScript Server Dockerfile with Client Build
# Note: Must be built from monorepo root with: docker build -f packages/server/Dockerfile .

# ===== Build client =====
FROM oven/bun:1.2.21 AS build-client
WORKDIR /app

# Copy shared package source (bun transpiles on-the-fly, no build needed)
COPY packages/shared ./packages/shared/

# Install and build client with bun
COPY packages/client/package.json packages/client/bun.lock* ./packages/client/
RUN cd packages/client && bun install
COPY packages/client ./packages/client
RUN cd packages/client && bun run build

# ===== Main server image =====
FROM oven/bun:1.2.21

# Install curl for health checks
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy root package files for workspace resolution
COPY package.json bun.lock* ./

# Copy packages we need
COPY packages/server/package.json ./packages/server/
COPY packages/shared ./packages/shared/

# Install dependencies from server directory
WORKDIR /app/packages/server
RUN bun install

# Copy server source code
COPY packages/server/src ./src/
COPY packages/server/agents.json ./
COPY packages/server/server_config.json ./
COPY packages/server/tsconfig.json ./
COPY packages/server/.env ./.env
COPY packages/server/docker-entrypoint.sh ./

# Remove ANTHROPIC_API_KEY from .env to force OAuth usage for Claude Code
RUN sed -i '/^ANTHROPIC_API_KEY/d' .env

# NOTE: Skipping build step - Bun will transpile TypeScript on-the-fly
# This enables true hot reload without rebuild step for consciousness research iteration

# Copy built React frontend from build stage to correct location
# Server runs from /app/packages/server/src/http-server/index.ts
# __dirname resolves ../../.. to /app/packages, so client needs to be at /app/packages/client/dist
WORKDIR /app
COPY --from=build-client /app/packages/client/dist ./packages/client/dist/
WORKDIR /app/packages/server

# Create data directories
RUN mkdir -p /app/packages/server/data/conversations /app/packages/server/backups/agents

# Create non-root user for security (required by Claude Code)
RUN groupadd -r ailumina && useradd -r -g ailumina -d /app ailumina
RUN chown -R ailumina:ailumina /app

# Create writable .claude directory for Claude Code session files
# Credentials will be copied from mounted /claude at runtime
RUN mkdir -p /app/.claude && chown ailumina:ailumina /app/.claude

# Create writable .codex directory for Codex session files
# Auth credentials will be copied from mounted /codex at runtime
RUN mkdir -p /app/.codex && chown ailumina:ailumina /app/.codex

# Create writable .gemini directory for Gemini session files
# OAuth credentials will be copied from mounted /gemini at runtime
RUN mkdir -p /app/.gemini && chown ailumina:ailumina /app/.gemini

# Make entrypoint script executable
RUN chmod +x /app/packages/server/docker-entrypoint.sh

USER ailumina

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

# Start server via entrypoint script (copies OAuth credentials, then starts server)
CMD ["./docker-entrypoint.sh"]
