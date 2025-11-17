# syntax=docker/dockerfile:1
# Multi-stage build for AI Memory MCP Server with Bun runtime
# Includes cron for autonomous memory curation and Claude Code for AI-driven maintenance

FROM oven/bun:1 AS base
WORKDIR /usr/src/app

# Install dev dependencies stage
FROM base AS install-dev
RUN mkdir -p /temp/dev
# Create workspace root package.json so bun recognizes shared as a workspace
RUN echo '{"name":"workspace","workspaces":["shared","."]}' > /temp/dev/package.json
# Copy workspace shared package first
COPY shared /temp/dev/shared
# Copy ai-memory-mcp package files
COPY ai-memory-mcp/package.json ai-memory-mcp/bun.lock* /temp/dev/
RUN --mount=type=cache,target=/root/.bun/install/cache \
    cd /temp/dev && bun install --frozen-lockfile

# Install production dependencies stage
FROM base AS install-prod
RUN mkdir -p /temp/prod
# Create workspace root package.json so bun recognizes shared as a workspace
RUN echo '{"name":"workspace","workspaces":["shared","."]}' > /temp/prod/package.json
# Copy workspace shared package first
COPY shared /temp/prod/shared
# Copy ai-memory-mcp package files
COPY ai-memory-mcp/package.json ai-memory-mcp/bun.lock* /temp/prod/
RUN --mount=type=cache,target=/root/.bun/install/cache \
    cd /temp/prod && bun install --frozen-lockfile --production

# Build stage
FROM base AS build
COPY --from=install-dev /temp/dev/node_modules node_modules
COPY --from=install-dev /temp/dev/shared shared
COPY ai-memory-mcp .

# Build TypeScript (using bun build for multiple entry points)
RUN bun run typecheck && \
    bun build http-server/index.ts --outdir dist/http-server --target bun && \
    bun build stdio-wrapper/index.ts --outdir dist/stdio-wrapper --target bun && \
    bun build scripts/start-both.ts --outdir dist/scripts --target bun

# Production runtime stage
FROM oven/bun:1 AS release

# Install system dependencies for cron, gosu, curl, ca-certificates, git
# Use Debian package manager (oven/bun:1 is Debian-based)
RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
    cron \
    git \
    gosu \
  && rm -rf /var/lib/apt/lists/*

# Install Node.js and npm for Claude Code (Claude Code requires Node)
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

# Install Claude Code globally via npm
RUN npm install -g @anthropic-ai/claude-code

# Create app user and group (Debian syntax) with proper home directory
RUN groupadd -g 1001 nodejs || true && \
    useradd -m -u 1001 -g nodejs -d /home/mcp -s /bin/bash mcp && \
    mkdir -p /home/mcp && \
    chown -R mcp:nodejs /home/mcp

WORKDIR /usr/src/app

# Copy production dependencies from install-prod stage
COPY --from=install-prod --chown=mcp:nodejs /temp/prod/node_modules node_modules

# Copy built application from build stage
COPY --from=build --chown=mcp:nodejs /usr/src/app/dist ./dist

# Copy additional files needed at runtime
COPY --from=build --chown=mcp:nodejs /usr/src/app/shared ./shared
COPY --from=build --chown=mcp:nodejs /usr/src/app/CLAUDE.md ./CLAUDE.md
COPY --from=build --chown=mcp:nodejs /usr/src/app/package.json ./package.json

# Copy curation scripts and MCP configuration
COPY --chown=mcp:nodejs ai-memory-mcp/scripts/ /usr/src/app/scripts/
COPY --chown=mcp:nodejs ai-memory-mcp/.mcp.json /usr/src/app/.mcp.json

# Create cron log directory
RUN mkdir -p /usr/src/app/logs && \
    touch /usr/src/app/logs/cron.log && \
    touch /usr/src/app/logs/memory-curation.log && \
    touch /usr/src/app/logs/memory-reflection.log && \
    chown -R mcp:nodejs /usr/src/app/logs

# Copy MCP configuration to mcp user's home for Claude Code
RUN mkdir -p /home/mcp/.config && \
    cp /usr/src/app/.mcp.json /home/mcp/.mcp.json && \
    chown -R mcp:nodejs /home/mcp

# No longer need transformers cache - embedding service handles this
# Optional: limit memory usage (though Bun already more efficient than Node)
ENV NODE_OPTIONS=--max-old-space-size=1024

# Expose port
EXPOSE 3003

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:3003/health || exit 1

# Copy and setup entrypoint (must be before USER directive)
COPY ai-memory-mcp/docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Note: Don't switch to mcp user yet - entrypoint needs root for cron setup
# The entrypoint will use gosu to drop privileges for the main process

# Use entrypoint to setup cron and start services
ENTRYPOINT ["docker-entrypoint.sh"]

# Default command - start HTTP server with Bun
CMD ["bun", "run", "dist/http-server/index.js"]
