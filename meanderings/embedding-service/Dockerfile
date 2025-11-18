# syntax=docker/dockerfile:1
# Multi-stage build for Embedding Service with Bun
FROM oven/bun:1 AS base
WORKDIR /usr/src/app

# ===== Install dev dependencies (for building) =====
FROM base AS install-dev
# Install Node.js, npm and build tools for native modules (sharp dependency from @xenova/transformers)
RUN apt-get update && apt-get install -y \
    curl \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*
# Install Node.js and npm
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*
RUN mkdir -p /temp/dev
COPY package.json bun.lock* /temp/dev/
# Use BuildKit cache mount for faster rebuilds
RUN --mount=type=cache,target=/root/.bun/install/cache \
    cd /temp/dev && bun install --frozen-lockfile
# Explicitly rebuild sharp native bindings (bun doesn't always run install scripts)
RUN cd /temp/dev && npm rebuild sharp --verbose

# ===== Install production dependencies =====
FROM base AS install-prod
# Install Node.js, npm and build tools for native modules (sharp dependency from @xenova/transformers)
RUN apt-get update && apt-get install -y \
    curl \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*
# Install Node.js and npm
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*
RUN mkdir -p /temp/prod
COPY package.json bun.lock* /temp/prod/
# Use BuildKit cache mount for faster rebuilds
RUN --mount=type=cache,target=/root/.bun/install/cache \
    cd /temp/prod && bun install --frozen-lockfile --production
# Explicitly rebuild sharp native bindings (bun doesn't always run install scripts)
RUN cd /temp/prod && npm rebuild sharp --verbose

# ===== Build stage =====
FROM base AS build
COPY --from=install-dev /temp/dev/node_modules node_modules
COPY . .
# Build TypeScript
RUN bun run build

# ===== Final production image =====
FROM base AS release

# Install wget for health checks, build tools for sharp rebuild
RUN apt-get update && apt-get install -y \
    wget \
    ca-certificates \
    curl \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js and npm for rebuilding sharp
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

# Create non-root user (use existing bun group)
RUN useradd --system --uid 1001 --gid $(getent group bun | cut -d: -f3) --no-create-home embeddings

# Create cache directory for transformers models
RUN mkdir -p /usr/src/app/.cache/transformers && \
    chown -R embeddings:bun /usr/src/app/.cache

# Copy production dependencies and built code
COPY --from=install-prod --chown=embeddings:bun /temp/prod/node_modules node_modules
COPY --from=build --chown=embeddings:bun /usr/src/app/dist ./dist
COPY --from=build --chown=embeddings:bun /usr/src/app/package.json ./package.json

# Rebuild sharp for the target architecture (works on both ARM64 and AMD64)
# The --platform flag in docker-compose.yml determines which architecture to build for
RUN npm rebuild sharp --verbose

USER embeddings
EXPOSE 3007

# Set environment for transformers cache
ENV TRANSFORMERS_CACHE=/usr/src/app/.cache/transformers

HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=60s \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3007/health || exit 1

# Default command - start HTTP server with Bun
CMD ["bun", "run", "dist/http-server/index.js"]
