# syntax=docker/dockerfile:1
# Multi-stage build for AI Memory MCP Server with Bun runtime
# Includes cron for autonomous memory curation and Claude Code for AI-driven maintenance

FROM oven/bun:1 AS base
WORKDIR /usr/src/app

# Prepare shared package
FROM base AS shared
COPY packages/shared ./temp-shared
RUN cd temp-shared && bun install && bun run build 2>/dev/null || true

# Install dev dependencies - manually handle workspace dependency
FROM base AS install-dev
COPY packages/ai-memory-mcp/package.json ./
# Replace workspace dependency with file path temporarily
RUN sed -i 's|"@ailumina/shared": "workspace:\*"|"@ailumina/shared": "file:../temp-shared"|g' package.json
COPY --from=shared /usr/src/app/temp-shared ../temp-shared
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install

# Install production dependencies
FROM base AS install-prod
COPY packages/ai-memory-mcp/package.json ./
RUN sed -i 's|"@ailumina/shared": "workspace:\*"|"@ailumina/shared": "file:../temp-shared"|g' package.json
COPY --from=shared /usr/src/app/temp-shared ../temp-shared
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --production

# Build stage - just copy source files, Bun can run TypeScript natively
FROM base AS build
COPY --from=install-dev /usr/src/app/node_modules ./node_modules
COPY packages/ai-memory-mcp .
# Copy shared package for runtime imports
COPY --from=shared /usr/src/app/temp-shared ./node_modules/@ailumina/shared

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
COPY --from=install-prod --chown=mcp:nodejs /usr/src/app/node_modules node_modules
# Copy shared package to node_modules for runtime
COPY --from=shared --chown=mcp:nodejs /usr/src/app/temp-shared node_modules/@ailumina/shared

# Copy source files (Bun runs TypeScript natively)
COPY --from=build --chown=mcp:nodejs /usr/src/app/http-server ./http-server
COPY --from=build --chown=mcp:nodejs /usr/src/app/stdio-wrapper ./stdio-wrapper
COPY --from=build --chown=mcp:nodejs /usr/src/app/scripts ./scripts
COPY --from=build --chown=mcp:nodejs /usr/src/app/shared ./shared
COPY --from=build --chown=mcp:nodejs /usr/src/app/CLAUDE.md ./CLAUDE.md
COPY --from=build --chown=mcp:nodejs /usr/src/app/package.json ./package.json
COPY --from=build --chown=mcp:nodejs /usr/src/app/tsconfig.json ./tsconfig.json

# Copy MCP configuration
COPY --chown=mcp:nodejs packages/ai-memory-mcp/.mcp.json /usr/src/app/.mcp.json

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
COPY packages/ai-memory-mcp/docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Note: Don't switch to mcp user yet - entrypoint needs root for cron setup
# The entrypoint will use gosu to drop privileges for the main process

# Use entrypoint to setup cron and start services
ENTRYPOINT ["docker-entrypoint.sh"]

# Default command - start HTTP server with Bun (runs TypeScript natively)
# For development: mount source directories and this runs your live code
CMD ["bun", "run", "http-server/index.ts"]
