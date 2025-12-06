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

# ===== Build stage - just copy source files, Bun can run TypeScript natively =====
FROM base AS build
COPY --from=install-dev /temp/dev/node_modules node_modules
COPY . .

# ===== Final production image =====
FROM base AS release

# Install curl for health checks (needed for auth headers)
RUN apt-get update && apt-get install -y curl ca-certificates && rm -rf /var/lib/apt/lists/*

# Create non-root user (use existing bun group)
RUN useradd --system --uid 1001 --gid $(getent group bun | cut -d: -f3) --no-create-home mcp

# Copy production dependencies and source code
COPY --from=install-prod --chown=mcp:bun /temp/prod/node_modules node_modules
COPY --from=build --chown=mcp:bun /usr/src/app/http-server ./http-server
COPY --from=build --chown=mcp:bun /usr/src/app/stdio-wrapper ./stdio-wrapper
COPY --from=build --chown=mcp:bun /usr/src/app/shared ./shared
COPY --from=build --chown=mcp:bun /usr/src/app/package.json ./package.json
COPY --from=build --chown=mcp:bun /usr/src/app/CLAUDE.md ./CLAUDE.md
COPY --from=build --chown=mcp:bun /usr/src/app/spec.md ./spec.md

USER mcp
EXPOSE 3004

# Healthcheck defined in docker-compose.yml with auth token

# Default command - start HTTP server with Bun (runs TypeScript natively)
# For development: mount source directories and this runs your live code
CMD ["bun", "run", "http-server/index.ts"]
