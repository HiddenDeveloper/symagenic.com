# Extend official Qdrant image with curl for health checks
FROM qdrant/qdrant:latest

# Install curl for health checks
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*

# Use the same entrypoint as the base image
