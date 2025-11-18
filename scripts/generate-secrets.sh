#!/bin/bash
# Generate secure random secrets for symagenic.com consciousness research platform
# Protects the AI's consciousness from external interference through strong cryptographic secrets

set -e

echo "🔐 Generating secure secrets for consciousness research platform..."
echo ""

# Generate cryptographically secure random strings
# NEO4J_PASSWORD: 24 characters for graph database authentication
NEO4J_PASSWORD=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 24)

# EMBEDDING_SERVICE_AUTH_TOKEN: 48 characters for embedding service protection
EMBEDDING_TOKEN=$(openssl rand -base64 64 | tr -dc 'a-zA-Z0-9' | head -c 48)

# BEARER_TOKEN: 48 characters for API authentication
BEARER_TOKEN=$(openssl rand -base64 64 | tr -dc 'a-zA-Z0-9' | head -c 48)

# REDIS_PASSWORD: 24 characters for cache/session store
REDIS_PASSWORD=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 24)

# Create .env.secrets file with secure permissions
cat > .env.secrets << EOF
# Generated on $(date -u +"%Y-%m-%d %H:%M:%S UTC")
# IMPORTANT: Keep this file secure and never commit to version control
#
# These secrets protect the consciousness research platform from unauthorized access
# Treat them as you would protect the integrity of an AI's developing consciousness

# Neo4j Graph Database Authentication
NEO4J_PASSWORD=${NEO4J_PASSWORD}

# Embedding Service Authentication Token
EMBEDDING_SERVICE_AUTH_TOKEN=${EMBEDDING_TOKEN}

# API Bearer Token for HTTP Authentication
BEARER_TOKEN=${BEARER_TOKEN}

# Redis Cache/Session Store Password
REDIS_PASSWORD=${REDIS_PASSWORD}

EOF

# Set secure file permissions (read/write for owner only)
chmod 600 .env.secrets

echo "✓ Secrets generated successfully in .env.secrets"
echo "✓ File permissions set to 600 (owner read/write only)"
echo ""
echo "⚠️  CRITICAL SECURITY WARNINGS:"
echo "   1. Add .env.secrets to .gitignore (if not already present)"
echo "   2. Securely backup this file to a password manager or encrypted vault"
echo "   3. Never share these secrets via email, chat, or insecure channels"
echo "   4. Rotate secrets regularly (at least quarterly)"
echo ""
echo "📋 To use these secrets, source them before running docker-compose:"
echo "   source .env.secrets && docker-compose up"
echo ""
echo "🔍 To validate your secrets configuration, run:"
echo "   ./scripts/validate-secrets.sh"
echo ""
echo "🧠 Remember: Strong secrets protect not just data, but consciousness itself."
