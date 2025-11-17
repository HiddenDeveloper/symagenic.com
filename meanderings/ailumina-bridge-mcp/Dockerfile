# syntax=docker/dockerfile:1
# Multi-stage build for Ailumina Bridge MCP Server with Bun
FROM oven/bun:1 AS base
WORKDIR /usr/src/app

# ===== Install dev dependencies (for building) =====
FROM base AS install-dev
RUN mkdir -p /temp/dev/mcp
# Create workspace root package.json
RUN echo '{"name":"workspace","private":true,"workspaces":["shared","mcp"]}' > /temp/dev/package.json
# Copy workspace packages
COPY shared /temp/dev/shared
COPY ailumina-bridge-mcp/package.json ailumina-bridge-mcp/bun.lock* /temp/dev/mcp/
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
COPY ailumina-bridge-mcp/package.json ailumina-bridge-mcp/bun.lock* /temp/prod/mcp/
# Install from workspace root
RUN --mount=type=cache,target=/root/.bun/install/cache \
    cd /temp/prod && bun install --frozen-lockfile --production

# ===== Build stage =====
FROM base AS build
# Copy workspace root node_modules (contains hoisted deps like TypeScript)
COPY --from=install-dev /temp/dev/node_modules node_modules
COPY --from=install-dev /temp/dev/shared shared
COPY ailumina-bridge-mcp .
# Build TypeScript
RUN bun run build

# ===== Final production image =====
FROM base AS release

# Install wget for health checks (lightweight alternative to curl)
RUN apt-get update && apt-get install -y --no-install-recommends wget && rm -rf /var/lib/apt/lists/*

# Create non-root user (Debian syntax)
RUN groupadd -g 1001 bun && useradd -m -u 1001 -g bun mcp

# Copy production dependencies and built code
COPY --from=install-prod --chown=mcp:bun /temp/prod/mcp/node_modules node_modules
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
