# Qdrant with curl for healthchecks
FROM qdrant/qdrant:v1.12.0

# Switch to root to install packages
USER root

# Install curl for healthcheck support
RUN apt-get update && \
    apt-get install -y curl && \
    rm -rf /var/lib/apt/lists/*

# Stay as root since Qdrant base image expects root
# The base image will handle any necessary user switching in its entrypoint

# Expose standard Qdrant ports
EXPOSE 6333 6334
