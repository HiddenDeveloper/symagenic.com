# syntax=docker/dockerfile:1
# Multi-stage build for AI Recall MCP Server with Bun runtime

FROM oven/bun:1-alpine AS base
WORKDIR /usr/src/app

# Prepare shared package
FROM base AS shared
COPY packages/shared ./temp-shared
RUN cd temp-shared && bun install && bun run build 2>/dev/null || true

# Install dev dependencies - manually handle workspace dependency
FROM base AS install-dev
COPY packages/ai-recall-mcp/package.json ./
# Replace workspace dependency with file path temporarily
RUN sed -i 's|"@ailumina/shared": "workspace:\*"|"@ailumina/shared": "file:../temp-shared"|g' package.json
COPY --from=shared /usr/src/app/temp-shared ../temp-shared
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install

# Install production dependencies
FROM base AS install-prod
COPY packages/ai-recall-mcp/package.json ./
RUN sed -i 's|"@ailumina/shared": "workspace:\*"|"@ailumina/shared": "file:../temp-shared"|g' package.json
COPY --from=shared /usr/src/app/temp-shared ../temp-shared
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --production

# Build stage - just copy source files, Bun can run TypeScript natively
FROM base AS build
COPY --from=install-dev /usr/src/app/node_modules ./node_modules
COPY packages/ai-recall-mcp .
# Copy shared package for runtime imports
COPY --from=shared /usr/src/app/temp-shared ./node_modules/@ailumina/shared

# Production runtime stage
FROM oven/bun:1-alpine AS release

# Install wget for health checks (alpine uses apk)
RUN apk add --no-cache wget

# Create app user (bun group already exists in base image)
RUN adduser -S mcp -u 1001 -G bun

WORKDIR /usr/src/app

# Copy production dependencies from install-prod stage
COPY --from=install-prod --chown=mcp:bun /usr/src/app/node_modules node_modules
# Copy shared package to node_modules for runtime
COPY --from=shared --chown=mcp:bun /usr/src/app/temp-shared node_modules/@ailumina/shared

# Copy source files (Bun runs TypeScript natively)
COPY --from=build --chown=mcp:bun /usr/src/app/http-server ./http-server
COPY --from=build --chown=mcp:bun /usr/src/app/shared ./shared
COPY --from=build --chown=mcp:bun /usr/src/app/CLAUDE.md ./CLAUDE.md
COPY --from=build --chown=mcp:bun /usr/src/app/package.json ./package.json

# Copy MCP configuration
COPY --chown=mcp:bun packages/ai-recall-mcp/.mcp.json /usr/src/app/.mcp.json

# No longer need transformers cache - embedding service handles this

# Switch to non-root user
USER mcp

# Expose port
EXPOSE 3006

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3006/health || exit 1

# Default command - start HTTP server with Bun (runs TypeScript natively)
# For development: mount source directories and this runs your live code
CMD ["bun", "run", "http-server/index.ts"]
