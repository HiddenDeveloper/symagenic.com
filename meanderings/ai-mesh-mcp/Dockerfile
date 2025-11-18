# syntax=docker/dockerfile:1
# Multi-stage build for AI Mesh MCP Server with Bun
FROM oven/bun:1-alpine AS base
WORKDIR /usr/src/app

# ===== Install dev dependencies (for building) =====
FROM base AS install-dev
RUN mkdir -p /temp/dev/mcp
# Create workspace root package.json
RUN echo '{"name":"workspace","private":true,"workspaces":["shared","mcp"]}' > /temp/dev/package.json
# Copy workspace packages
COPY shared /temp/dev/shared
COPY ai-mesh-mcp/package.json ai-mesh-mcp/bun.lock* /temp/dev/mcp/
# Install from workspace root
RUN --mount=type=cache,target=/root/.bun/install/cache \
    cd /temp/dev && bun install --frozen-lockfile

# ===== Install production dependencies =====
FROM base AS install-prod
RUN mkdir -p /temp/prod/mcp
# Create workspace root package.json
RUN echo '{"name":"workspace","private":true,"workspaces":["shared","mcp"]}' > /temp/prod/package.json
# Copy workspace packages
COPY shared /temp/prod/shared
COPY ai-mesh-mcp/package.json ai-mesh-mcp/bun.lock* /temp/prod/mcp/
# Install from workspace root
RUN --mount=type=cache,target=/root/.bun/install/cache \
    cd /temp/prod && bun install --frozen-lockfile --production

# ===== Build stage =====
FROM base AS build
# Set up workspace structure for building
WORKDIR /temp/dev
# Create workspace root package.json
RUN echo '{"name":"workspace","private":true,"workspaces":["shared","mcp"]}' > package.json
# Copy workspace packages
COPY shared ./shared
COPY ai-mesh-mcp ./mcp
# Install all dependencies
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile
# Build from within the mcp package directory
WORKDIR /temp/dev/mcp
RUN bun build src/http-server/index.ts --outdir dist/http-server --target bun && \
    bun build src/stdio-wrapper/index.ts --outdir dist/stdio-wrapper --target bun && \
    bun build src/scripts/start-both.ts --outdir dist/scripts --target bun

# ===== Final production image =====
FROM base AS release

# Install wget for health checks (lightweight alternative to curl)
RUN apk add --no-cache wget

# Create non-root user
RUN adduser -S mcp -u 1001 -G bun

# Copy production dependencies and built code
COPY --from=install-prod --chown=mcp:bun /temp/prod/mcp/node_modules node_modules
COPY --from=build --chown=mcp:bun /temp/dev/mcp/dist ./dist
COPY --from=build --chown=mcp:bun /temp/dev/mcp/package.json ./package.json

# Optional: Copy additional files needed at runtime
COPY --from=build --chown=mcp:bun /temp/dev/mcp/CLAUDE.md ./CLAUDE.md

USER mcp
EXPOSE 3002

HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=15s \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3002/health || exit 1

# Default command - start HTTP server with Bun
CMD ["bun", "run", "dist/http-server/index.js"]
