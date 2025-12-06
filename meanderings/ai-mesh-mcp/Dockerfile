# syntax=docker/dockerfile:1
# Multi-stage build for AI Mesh MCP Server with Bun
FROM oven/bun:1-alpine AS base
WORKDIR /usr/src/app

# ===== Install dev dependencies (for building) =====
FROM base AS install-dev
RUN mkdir -p /temp/dev
COPY package.json bun.lock* /temp/dev/
# Use BuildKit cache mount for faster rebuilds
RUN --mount=type=cache,target=/root/.bun/install/cache \
    cd /temp/dev && bun install --frozen-lockfile

# ===== Install production dependencies =====
FROM base AS install-prod
RUN mkdir -p /temp/prod
COPY package.json bun.lock* /temp/prod/
# Use BuildKit cache mount for faster rebuilds
RUN --mount=type=cache,target=/root/.bun/install/cache \
    cd /temp/prod && bun install --frozen-lockfile --production

# ===== Build stage - just copy source files, Bun can run TypeScript natively =====
FROM base AS build
COPY --from=install-dev /temp/dev/node_modules node_modules
COPY . .

# ===== Final production image =====
FROM base AS release

# Install curl for health checks
RUN apk add --no-cache curl

# Create non-root user
RUN adduser -S mcp -u 1001 -G bun

# Copy production dependencies and source code
COPY --from=install-prod --chown=mcp:bun /temp/prod/node_modules node_modules
COPY --from=build --chown=mcp:bun /usr/src/app/src ./src
COPY --from=build --chown=mcp:bun /usr/src/app/shared ./shared
COPY --from=build --chown=mcp:bun /usr/src/app/package.json ./package.json
COPY --from=build --chown=mcp:bun /usr/src/app/CLAUDE.md ./CLAUDE.md

USER mcp
EXPOSE 3002

HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=15s \
  CMD curl -f http://localhost:3002/health || exit 1

# Default command - start HTTP server with Bun (runs TypeScript natively)
# For development: mount source directories and this runs your live code
CMD ["bun", "run", "src/http-server/index.ts"]
