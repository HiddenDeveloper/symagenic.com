# syntax=docker/dockerfile:1
# Multi-stage build for AI Recall MCP Server with Bun runtime

FROM oven/bun:1-alpine AS base
WORKDIR /usr/src/app

# Install dev dependencies stage
FROM base AS install-dev
RUN mkdir -p /temp/dev
# Create workspace root package.json so bun recognizes shared as a workspace
RUN echo '{"name":"workspace","workspaces":["shared","."]}' > /temp/dev/package.json
# Copy workspace shared package first
COPY shared /temp/dev/shared
# Copy ai-recall-mcp package files
COPY ai-recall-mcp/package.json ai-recall-mcp/bun.lock* /temp/dev/
RUN --mount=type=cache,target=/root/.bun/install/cache \
    cd /temp/dev && bun install --frozen-lockfile

# Install production dependencies stage
FROM base AS install-prod
RUN mkdir -p /temp/prod
# Create workspace root package.json so bun recognizes shared as a workspace
RUN echo '{"name":"workspace","workspaces":["shared","."]}' > /temp/prod/package.json
# Copy workspace shared package first
COPY shared /temp/prod/shared
# Copy ai-recall-mcp package files
COPY ai-recall-mcp/package.json ai-recall-mcp/bun.lock* /temp/prod/
RUN --mount=type=cache,target=/root/.bun/install/cache \
    cd /temp/prod && bun install --frozen-lockfile --production

# Build stage
FROM base AS build
COPY --from=install-dev /temp/dev/node_modules node_modules
COPY --from=install-dev /temp/dev/shared shared
COPY ai-recall-mcp .

# Build TypeScript
RUN bun run typecheck && \
    bun build http-server/index.ts --outdir dist/http-server --target bun

# Production runtime stage
FROM oven/bun:1-alpine AS release

# Install wget for health checks (alpine uses apk)
RUN apk add --no-cache wget

# Create app user (bun group already exists in base image)
RUN adduser -S mcp -u 1001 -G bun

WORKDIR /usr/src/app

# Copy production dependencies from install-prod stage
COPY --from=install-prod --chown=mcp:bun /temp/prod/node_modules node_modules

# Copy built application from build stage
COPY --from=build --chown=mcp:bun /usr/src/app/dist ./dist

# Copy additional files needed at runtime
COPY --from=build --chown=mcp:bun /usr/src/app/shared ./shared
COPY --from=build --chown=mcp:bun /usr/src/app/CLAUDE.md ./CLAUDE.md
COPY --from=build --chown=mcp:bun /usr/src/app/package.json ./package.json

# Copy MCP configuration
COPY --chown=mcp:bun ai-recall-mcp/.mcp.json /usr/src/app/.mcp.json

# No longer need transformers cache - embedding service handles this

# Switch to non-root user
USER mcp

# Expose port
EXPOSE 3006

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3006/health || exit 1

# Default command - start HTTP server with Bun
CMD ["bun", "run", "dist/http-server/index.js"]
