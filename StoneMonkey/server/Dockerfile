# Ailumina TypeScript Server Dockerfile
# Build from StoneMonkey root with: docker build -f server/Dockerfile .

FROM oven/bun:1.2.21

# Install curl for health checks
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Create non-root user for security
RUN groupadd -r ailumina && useradd -r -g ailumina ailumina

WORKDIR /app

# Copy workspace root package.json for workspace resolution
COPY --chown=ailumina:ailumina package.json ./

# Copy shared package (workspace dependency)
COPY --chown=ailumina:ailumina shared ./shared/

# Copy server files
COPY --chown=ailumina:ailumina server/package.json ./server/
COPY --chown=ailumina:ailumina server/bun.lock* ./server/

# Install dependencies from server directory
WORKDIR /app/server
RUN bun install

# Copy server source code and config
COPY --chown=ailumina:ailumina server/src ./src/
COPY --chown=ailumina:ailumina server/agents.json ./
COPY --chown=ailumina:ailumina server/server_config.json ./
COPY --chown=ailumina:ailumina server/tsconfig.json ./

# Create data and client directories
RUN mkdir -p /app/server/data/conversations /app/server/backups/agents /app/server/client/dist && \
    chown -R ailumina:ailumina /app/server/data /app/server/backups /app/server/client

# Copy pre-built React frontend (optional - comment out if client not built)
# COPY client/dist ./client/dist/

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

# Switch to non-root user
USER ailumina

# Start server - run TypeScript directly from server directory (Bun transpiles on-the-fly)
CMD ["bun", "run", "src/http-server/index.ts"]
