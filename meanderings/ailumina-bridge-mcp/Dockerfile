# syntax=docker/dockerfile:1
# Multi-stage build for Ailumina Bridge MCP Server with Bun
FROM oven/bun:1 AS base
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

# ===== Build stage =====
FROM base AS build
COPY --from=install-dev /temp/dev/node_modules node_modules
COPY . .
# Build TypeScript
RUN bun run build

# ===== Final production image =====
FROM base AS release

# Install wget for health checks (lightweight alternative to curl)
RUN apk add --no-cache wget

# Create non-root user
RUN addgroup -g 1001 -S bun && adduser -S mcp -u 1001 -G bun

# Copy production dependencies and built code
COPY --from=install-prod --chown=mcp:bun /temp/prod/node_modules node_modules
COPY --from=build --chown=mcp:bun /usr/src/app/dist ./dist
COPY --from=build --chown=mcp:bun /usr/src/app/package.json ./package.json

# Optional: Copy additional files needed at runtime
COPY --from=build --chown=mcp:bun /usr/src/app/shared ./shared
COPY --from=build --chown=mcp:bun /usr/src/app/CLAUDE.md ./CLAUDE.md
COPY --from=build --chown=mcp:bun /usr/src/app/spec.md ./spec.md

USER mcp
EXPOSE 3004

HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=15s \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3004/health || exit 1

# Default command - start HTTP server with Bun
CMD ["bun", "run", "dist/http-server/index.js"]
