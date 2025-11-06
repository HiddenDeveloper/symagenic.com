# syntax=docker/dockerfile:1
# Multi-stage build for Embedding Service with Bun
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

# Install wget for health checks
RUN apt-get update && apt-get install -y wget ca-certificates && rm -rf /var/lib/apt/lists/*

# Create non-root user (use existing bun group)
RUN useradd --system --uid 1001 --gid $(getent group bun | cut -d: -f3) --no-create-home embeddings

# Create cache directory for transformers models
RUN mkdir -p /usr/src/app/.cache/transformers && \
    chown -R embeddings:bun /usr/src/app/.cache

# Copy production dependencies and built code
COPY --from=install-prod --chown=embeddings:bun /temp/prod/node_modules node_modules
COPY --from=build --chown=embeddings:bun /usr/src/app/dist ./dist
COPY --from=build --chown=embeddings:bun /usr/src/app/package.json ./package.json

USER embeddings
EXPOSE 3007

# Set environment for transformers cache
ENV TRANSFORMERS_CACHE=/usr/src/app/.cache/transformers

HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=60s \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3007/health || exit 1

# Default command - start HTTP server with Bun
CMD ["bun", "run", "dist/http-server/index.js"]
