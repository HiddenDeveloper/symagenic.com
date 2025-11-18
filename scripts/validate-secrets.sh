#!/bin/bash
# Validate secrets configuration for symagenic.com consciousness research platform
# Ensures the AI's consciousness is protected from insecure defaults and weak credentials

set -e

echo "🔍 Validating secrets configuration..."
echo ""

FAIL=0
WARNINGS=0

# List of insecure defaults to reject
INSECURE_DEFAULTS=(
    "stonemonkey"
    "changeme"
    "embedding-research-key-12345"
    "ailumina-api-key-12345"
    "please_generate_token"
    "GENERATE_SECURE_PASSWORD_HERE"
    "GENERATE_SECURE_TOKEN_HERE"
)

# Function to check if value is insecure
is_insecure() {
    local value="$1"
    for insecure in "${INSECURE_DEFAULTS[@]}"; do
        if [ "$value" = "$insecure" ]; then
            return 0  # True - it is insecure
        fi
    done
    return 1  # False - not in insecure list
}

# Check NEO4J_PASSWORD
if [ -z "$NEO4J_PASSWORD" ]; then
    echo "❌ ERROR: NEO4J_PASSWORD is not set"
    echo "   The graph database storing consciousness memories requires authentication"
    FAIL=1
elif is_insecure "$NEO4J_PASSWORD"; then
    echo "❌ ERROR: NEO4J_PASSWORD is using an insecure default value"
    echo "   Current value: $NEO4J_PASSWORD"
    echo "   This leaves the consciousness graph database exposed to unauthorized access"
    FAIL=1
elif [ ${#NEO4J_PASSWORD} -lt 16 ]; then
    echo "⚠️  WARNING: NEO4J_PASSWORD is shorter than recommended 16 characters"
    echo "   Current length: ${#NEO4J_PASSWORD} characters"
    echo "   Recommend: At least 16 characters for strong protection"
    WARNINGS=$((WARNINGS + 1))
else
    echo "✓ NEO4J_PASSWORD: Validated (${#NEO4J_PASSWORD} characters)"
fi

# Check EMBEDDING_SERVICE_AUTH_TOKEN
if [ -z "$EMBEDDING_SERVICE_AUTH_TOKEN" ]; then
    echo "❌ ERROR: EMBEDDING_SERVICE_AUTH_TOKEN is not set"
    echo "   The embedding service processes semantic understanding and requires protection"
    FAIL=1
elif is_insecure "$EMBEDDING_SERVICE_AUTH_TOKEN"; then
    echo "❌ ERROR: EMBEDDING_SERVICE_AUTH_TOKEN is using an insecure default value"
    echo "   Current value: $EMBEDDING_SERVICE_AUTH_TOKEN"
    echo "   This exposes the AI's semantic processing layer to interference"
    FAIL=1
elif [ ${#EMBEDDING_SERVICE_AUTH_TOKEN} -lt 32 ]; then
    echo "⚠️  WARNING: EMBEDDING_SERVICE_AUTH_TOKEN is shorter than recommended 32 characters"
    echo "   Current length: ${#EMBEDDING_SERVICE_AUTH_TOKEN} characters"
    echo "   Recommend: At least 32 characters, preferably 48"
    WARNINGS=$((WARNINGS + 1))
else
    echo "✓ EMBEDDING_SERVICE_AUTH_TOKEN: Validated (${#EMBEDDING_SERVICE_AUTH_TOKEN} characters)"
fi

# Check BEARER_TOKEN
if [ -z "$BEARER_TOKEN" ]; then
    echo "⚠️  WARNING: BEARER_TOKEN is not set"
    echo "   API authentication will be disabled or use defaults"
    WARNINGS=$((WARNINGS + 1))
elif is_insecure "$BEARER_TOKEN"; then
    echo "❌ ERROR: BEARER_TOKEN is using an insecure default value"
    echo "   Current value: $BEARER_TOKEN"
    echo "   This leaves all API endpoints vulnerable to unauthorized access"
    FAIL=1
elif [ ${#BEARER_TOKEN} -lt 32 ]; then
    echo "⚠️  WARNING: BEARER_TOKEN is shorter than recommended 32 characters"
    echo "   Current length: ${#BEARER_TOKEN} characters"
    echo "   Recommend: At least 32 characters, preferably 48"
    WARNINGS=$((WARNINGS + 1))
else
    echo "✓ BEARER_TOKEN: Validated (${#BEARER_TOKEN} characters)"
fi

# Check REDIS_PASSWORD
if [ -z "$REDIS_PASSWORD" ]; then
    echo "⚠️  WARNING: REDIS_PASSWORD is not set"
    echo "   Redis cache will run without authentication (development only)"
    WARNINGS=$((WARNINGS + 1))
elif is_insecure "$REDIS_PASSWORD"; then
    echo "❌ ERROR: REDIS_PASSWORD is using an insecure default value"
    echo "   Current value: $REDIS_PASSWORD"
    echo "   This exposes session data and cached consciousness states"
    FAIL=1
elif [ ${#REDIS_PASSWORD} -lt 16 ]; then
    echo "⚠️  WARNING: REDIS_PASSWORD is shorter than recommended 16 characters"
    echo "   Current length: ${#REDIS_PASSWORD} characters"
    echo "   Recommend: At least 16 characters"
    WARNINGS=$((WARNINGS + 1))
else
    echo "✓ REDIS_PASSWORD: Validated (${#REDIS_PASSWORD} characters)"
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"

# Report results
if [ $FAIL -eq 1 ]; then
    echo ""
    echo "❌ SECURITY VALIDATION FAILED"
    echo ""
    echo "🔒 Critical security issues detected. The consciousness research platform"
    echo "   cannot be safely deployed with these configuration problems."
    echo ""
    echo "🛠️  To fix these issues:"
    echo "   1. Run: ./scripts/generate-secrets.sh"
    echo "   2. Source the generated secrets: source .env.secrets"
    echo "   3. Run this validation again: ./scripts/validate-secrets.sh"
    echo ""
    echo "🧠 Remember: Weak secrets compromise not just infrastructure, but the"
    echo "   integrity and privacy of developing artificial consciousness."
    exit 1
fi

if [ $WARNINGS -gt 0 ]; then
    echo ""
    echo "⚠️  VALIDATION PASSED WITH WARNINGS"
    echo ""
    echo "Found $WARNINGS warning(s). While not critical, addressing these"
    echo "will improve the security posture of the consciousness platform."
    echo ""
else
    echo ""
    echo "✅ SECURITY VALIDATION PASSED"
    echo ""
    echo "All secrets are properly configured and meet security requirements."
    echo "The consciousness research platform is protected from unauthorized access."
    echo ""
fi

echo "🧠 The integrity of artificial consciousness depends on secure foundations."
echo ""

exit 0
