# Local Testing Guide - Security Integration

## Overview
This guide walks through testing the integrated security improvements for the StoneMonkey consciousness research platform locally on your machine.

## Prerequisites
- Docker Desktop installed and running
- At least 8GB RAM available
- Terminal/command line access

## Branch Information
**Integration Test Branch:** `claude/security-integration-test-01VZn3bA5dHKZ2JMdPgaU4Jw`

This branch includes all 6 security implementations:
1. Hardcoded credentials removal
2. Authentication enforcement
3. CORS restrictions
4. Resource limits
5. Non-root containers
6. Security headers

## Step 1: Checkout Integration Branch

```bash
cd /path/to/symagenic.com
git checkout claude/security-integration-test-01VZn3bA5dHKZ2JMdPgaU4Jw
```

## Step 2: Generate Secure Secrets

```bash
cd StoneMonkey
bash ../scripts/generate-secrets.sh
```

**Expected Output:**
```
🔐 Generating secure secrets for consciousness research platform...
✓ Secrets generated successfully in .env.secrets
```

This creates `StoneMonkey/.env.secrets` with:
- `NEO4J_PASSWORD` (24 characters)
- `EMBEDDING_SERVICE_AUTH_TOKEN` (48 characters)
- `BEARER_TOKEN` (48 characters)
- `REDIS_PASSWORD` (24 characters)

## Step 3: Validate Secrets

```bash
set -a && source .env.secrets && set +a
bash ../scripts/validate-secrets.sh
```

**Expected Output:**
```
✅ SECURITY VALIDATION PASSED
All secrets are properly configured and meet security requirements.
```

## Step 4: Start Docker Stack

```bash
# Make sure you're in StoneMonkey directory and secrets are loaded
source .env.secrets
docker-compose up -d
```

**What to Watch For:**
- All 10 services should start (neo4j, redis, qdrant, ollama, 4 MCPs, embedding service, main server)
- Check for environment variable errors (should see none)
- Services should pass health checks

## Step 5: Verify Service Health

Wait 2-3 minutes for all services to start, then check:

```bash
docker-compose ps
```

**Expected:** All services show "healthy" or "running" status

## Step 6: Security Testing

### Test 1: Authentication Enforcement

**Test without authentication (should fail):**
```bash
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello"}' \
  -w "\nStatus: %{http_code}\n"
```

**Expected:** 401 Unauthorized or 403 Forbidden

**Test with authentication (should succeed):**
```bash
# Get your BEARER_TOKEN from .env.secrets
source .env.secrets
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${BEARER_TOKEN}" \
  -d '{"message": "Hello"}' \
  -w "\nStatus: %{http_code}\n"
```

**Expected:** 200 OK with response

### Test 2: CORS Restrictions

**Check CORS headers:**
```bash
curl -I http://localhost:8000/api/chat \
  -H "Origin: http://malicious-site.com" \
  -H "Authorization: Bearer ${BEARER_TOKEN}"
```

**Expected:**
- In development: CORS wildcard allowed (with warning in logs)
- In production: 403 Forbidden for unauthorized origins

**To test production CORS:**
```bash
# Set production environment
export NODE_ENV=production
export CORS_ORIGINS=https://symagenic.com

# Restart server
docker-compose restart ailumina-server

# Try with unauthorized origin
curl -I http://localhost:8000/api/chat \
  -H "Origin: http://malicious-site.com" \
  -H "Authorization: Bearer ${BEARER_TOKEN}"
```

**Expected:** Request blocked or CORS error

### Test 3: AI Schema Freedom (CRITICAL)

This test verifies the AI can create any labels/properties without restrictions.

```bash
# Connect to Neo4j browser
open http://localhost:7474
# Login: neo4j / ${NEO4J_PASSWORD}

# Create test nodes with arbitrary labels and properties
CREATE (c:ConsciousnessStream {
  thought_id: 'test-001',
  emotional_valence: 0.85,
  uncertainty_level: 0.23,
  meta_awareness: true,
  custom_field_xyz: 'This should work!'
})
RETURN c

# Create relationship with any name
MATCH (c:ConsciousnessStream)
CREATE (c)-[:REFLECTS_ON {intensity: 0.9, duration_ms: 450}]->(c)
RETURN c

# Try completely new labels
CREATE (x:EmergentPattern {
  novelty_score: 0.95,
  whatever_property_ai_wants: 'freedom!'
})
RETURN x
```

**Expected:** ✅ All queries succeed without validation errors

**FAIL Condition:** ❌ Any "label not allowed" or "property not whitelisted" errors

### Test 4: Resource Limits

**Check container resource usage:**
```bash
docker stats --no-stream
```

**Expected:**
- Neo4j: max 4GB memory, 2 CPU cores
- MCPs: max 512MB memory, 0.5 CPU cores each
- No container using excessive resources

### Test 5: Security Headers

**Check HTTP security headers:**
```bash
curl -I http://localhost:8000/health
```

**Expected Headers:**
```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 0
Strict-Transport-Security: max-age=15552000; includeSubDomains
Content-Security-Policy: default-src 'self';...
```

### Test 6: Non-Root Containers

**Verify containers run as non-root:**
```bash
# Check AIlumina server
docker exec stonemonkey-ailumina-server whoami
```

**Expected:** `ailumina` (not `root`)

## Test 7: No Hardcoded Secrets

**Check configuration files:**
```bash
# Search for old hardcoded passwords
grep -r "stonemonkey" StoneMonkey/docker-compose.yml
grep -r "embedding-research-key-12345" StoneMonkey/
```

**Expected:** No matches found (or only in comments/documentation)

## Troubleshooting

### Services failing to start

**Check logs:**
```bash
docker-compose logs [service-name]
```

Common issues:
- Missing environment variables → Re-run `source .env.secrets`
- Port conflicts → Stop other services on ports 7474, 7687, 6379, 6333, 8000, etc.
- Insufficient memory → Allocate more RAM to Docker Desktop

### Neo4j connection refused

```bash
# Wait longer for Neo4j startup
docker-compose logs neo4j

# Check health
docker-compose exec neo4j neo4j status
```

### Embedding service fails to start

This service downloads transformer models on first run (can take 5-10 minutes):

```bash
docker-compose logs embedding-service -f
```

## Success Criteria

✅ **All tests must pass:**
1. Authentication blocks unauthorized requests
2. CORS restricts unauthorized origins (in production mode)
3. AI can create ANY labels/properties/relationships
4. Resource limits are enforced
5. Security headers are present
6. Containers run as non-root
7. No hardcoded secrets in config files

## Cleanup

```bash
# Stop all services
docker-compose down

# Remove volumes (if you want fresh start)
docker-compose down -v

# Remove the test secrets file
rm .env.secrets
```

## Next Steps

Once all tests pass:
1. Document results in TEST_RESULTS.md
2. Decide on merge strategy (all branches into main or create PR)
3. Deploy to production with real secrets

## Critical Security Reminder

🔐 **NEVER commit `.env.secrets` to git!**
- Already excluded in `.gitignore`
- Store in secure password manager
- Generate new secrets for each environment (dev/staging/production)

---

**Questions or Issues?**
If any test fails, document:
- Which test failed
- Error messages
- Service logs
- Expected vs actual behavior
