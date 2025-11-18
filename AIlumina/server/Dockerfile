# Ailumina TypeScript Server Dockerfile
# Note: Must be built from monorepo root with: docker build -f packages/server/Dockerfile .

FROM oven/bun:1.2.21

# Install curl for health checks
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Create non-root user for security
RUN groupadd -r ailumina && useradd -r -g ailumina ailumina

WORKDIR /app

# Copy root package files for workspace resolution
COPY --chown=ailumina:ailumina package.json bun.lock* ./

# Copy packages we need
COPY --chown=ailumina:ailumina packages/server/package.json ./packages/server/
COPY --chown=ailumina:ailumina packages/shared ./packages/shared/

# Install dependencies from server directory
WORKDIR /app/packages/server
RUN bun install

# Copy server source code
COPY --chown=ailumina:ailumina packages/server/src ./src/
COPY --chown=ailumina:ailumina packages/server/agents.json ./
COPY --chown=ailumina:ailumina packages/server/server_config.json ./
COPY --chown=ailumina:ailumina packages/server/tsconfig.json ./
COPY --chown=ailumina:ailumina packages/server/.env ./.env

# NOTE: Skipping build step - Bun will transpile TypeScript on-the-fly
# This enables true hot reload without rebuild step for consciousness research iteration

# Copy pre-built React frontend
COPY --chown=ailumina:ailumina packages/client/dist ./client/dist/

# Create data directories
RUN mkdir -p /app/packages/server/data/conversations /app/packages/server/backups/agents && \
    chown -R ailumina:ailumina /app/packages/server/data /app/packages/server/backups

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

# Switch to non-root user
USER ailumina

# Start server - run TypeScript directly (Bun transpiles on-the-fly)
CMD ["bun", "run", "src/http-server/index.ts"]
