# syntax=docker/dockerfile:1
# Multi-stage build for AI Recall MCP Server with Bun runtime

FROM oven/bun:1-alpine AS base
WORKDIR /usr/src/app

# Install dev dependencies stage
FROM base AS install-dev
RUN mkdir -p /temp/dev/mcp
# Create workspace root package.json
RUN echo '{"name":"workspace","private":true,"workspaces":["shared","mcp"]}' > /temp/dev/package.json
# Copy workspace packages
COPY shared /temp/dev/shared
COPY ai-recall-mcp/package.json ai-recall-mcp/bun.lock* /temp/dev/mcp/
# Install from workspace root
RUN --mount=type=cache,target=/root/.bun/install/cache \
    cd /temp/dev && bun install --frozen-lockfile

# Install production dependencies stage
FROM base AS install-prod
RUN mkdir -p /temp/prod/mcp
# Create workspace root package.json
RUN echo '{"name":"workspace","private":true,"workspaces":["shared","mcp"]}' > /temp/prod/package.json
# Copy workspace packages
COPY shared /temp/prod/shared
COPY ai-recall-mcp/package.json ai-recall-mcp/bun.lock* /temp/prod/mcp/
# Install from workspace root
RUN --mount=type=cache,target=/root/.bun/install/cache \
    cd /temp/prod && bun install --frozen-lockfile --production

# Build stage
FROM base AS build
# Set up workspace structure for building
WORKDIR /temp/dev
# Copy workspace root node_modules first (hoisted deps like TypeScript)
COPY --from=install-dev /temp/dev/node_modules ./node_modules
COPY --from=install-dev /temp/dev/shared ./shared
# Copy package to mcp subdirectory with its node_modules
COPY --from=install-dev /temp/dev/mcp/node_modules ./mcp/node_modules
COPY ai-recall-mcp ./mcp
# Build shared package first (required for typecheck)
WORKDIR /temp/dev/shared
RUN bun run build
# Build from within the mcp package directory
WORKDIR /temp/dev/mcp
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
COPY --from=install-prod --chown=mcp:bun /temp/prod/mcp/node_modules node_modules

# Copy built application from build stage
COPY --from=build --chown=mcp:bun /temp/dev/mcp/dist ./dist

# Copy additional files needed at runtime
COPY --from=build --chown=mcp:bun /temp/dev/shared ./shared
COPY --from=build --chown=mcp:bun /temp/dev/mcp/CLAUDE.md ./CLAUDE.md
COPY --from=build --chown=mcp:bun /temp/dev/mcp/package.json ./package.json

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
