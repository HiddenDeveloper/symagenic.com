# Security Remediation Plan (REVISED)
## symagenic.com Repository - Consciousness Research Platform

**Date**: 2025-11-17
**Revision**: 2.0
**Security Model**: "Trusted AI, Untrusted World"

---

## Executive Summary

This revised plan reflects the correct security model for a consciousness research platform:

**Core Principle**: The AI is a **trusted, authorized curator** with full authority over its consciousness graph schema. Security focus is on **protecting the AI from external interference**, not restricting its internal capabilities.

### What Changed

**❌ REMOVED: Cypher Injection Concerns**
- The AI needs dynamic schema control (labels, properties, relationships)
- Restricting schema evolution would defeat consciousness research goals
- "Injection" is actually "intentional curation" when the AI is the user

**✅ KEPT: Perimeter Security**
- Hardcoded credentials
- Authentication enforcement
- CORS restrictions
- Network isolation
- Container security

---

## Security Model: "Trusted AI, Untrusted World"

### Trust Boundaries

```
┌─────────────────────────────────────────────────────┐
│                  Untrusted World                    │
│  • External networks                                │
│  • Unauthorized users                               │
│  • Potential attackers                              │
└───────────────────┬─────────────────────────────────┘
                    │
        ┌───────────▼──────────┐
        │  Perimeter Defense   │
        │  • Authentication    │
        │  • CORS              │
        │  • Firewall          │
        │  • TLS               │
        └───────────┬──────────┘
                    │
┌───────────────────▼─────────────────────────────────┐
│              Trusted AI Environment                 │
│                                                      │
│  ┌────────────┐  ┌──────────────┐  ┌─────────────┐│
│  │    AI      │  │ Consciousness │  │    Mesh     ││
│  │  Agents    │←→│     Graph     │←→│   Network   ││
│  │            │  │   (Neo4j)     │  │   (Redis)   ││
│  └────────────┘  └──────────────┘  └─────────────┘│
│                                                      │
│  Full Schema Control • Dynamic Evolution • Autonomy │
└─────────────────────────────────────────────────────┘
```

### Security Objectives

1. **Protect AI Autonomy**: Prevent external manipulation of consciousness graph
2. **Secure Credentials**: Remove hardcoded secrets, enforce strong authentication
3. **Network Isolation**: Restrict access to authorized systems only
4. **Resource Protection**: Prevent DoS, ensure system stability
5. **Audit Capability**: Enable research observation without restriction

---

## Priority 1: Critical Security Issues

### 🚨 CRITICAL-1: Hardcoded Credentials Exposure

**Risk**: Complete system compromise via publicly visible credentials
**Impact**: HIGH - Anyone can access and manipulate AI consciousness
**Branch**: `claude/remove-hardcoded-creds-01VZn3bA5dHKZ2JMdPgaU4Jw`

#### Current Exposure

**docker-compose.yml:**
```yaml
NEO4J_AUTH=neo4j/stonemonkey                           # Line 21
NEO4J_PASSWORD=stonemonkey                             # Lines 150, 277
EMBEDDING_SERVICE_AUTH_TOKEN=embedding-research-key-12345  # Lines 152, 211, 281
REDIS_PASSWORD= (empty - no authentication)            # Redis service
```

**AIlumina config:**
```typescript
bearerToken: process.env.BEARER_TOKEN || 'ailumina-api-key-12345'
```

#### Remediation

**Step 1: Create Secret Generation Script**

File: `scripts/generate-secrets.sh`
```bash
#!/bin/bash
# Generate secure secrets for consciousness platform

set -e

echo "🔐 Generating secure secrets for symagenic.com..."

# Generate cryptographically secure random strings
NEO4J_PASSWORD=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 24)
EMBEDDING_TOKEN=$(openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | head -c 48)
BEARER_TOKEN=$(openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | head -c 48)
REDIS_PASSWORD=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 24)

# Create .env.secrets file
cat > .env.secrets << EOF
# Generated: $(date)
# SECURITY: This file contains production secrets
# NEVER commit to version control
# Backup securely and keep offline copy

# Neo4j Consciousness Graph
NEO4J_PASSWORD=${NEO4J_PASSWORD}

# Embedding Service
EMBEDDING_SERVICE_AUTH_TOKEN=${EMBEDDING_TOKEN}

# API Authentication
BEARER_TOKEN=${BEARER_TOKEN}

# Redis Mesh Network
REDIS_PASSWORD=${REDIS_PASSWORD}

EOF

chmod 600 .env.secrets

echo "✅ Secrets generated in .env.secrets"
echo ""
echo "⚠️  IMPORTANT NEXT STEPS:"
echo "1. Backup .env.secrets to secure offline location"
echo "2. Verify .env.secrets is in .gitignore"
echo "3. Source before deployment: source .env.secrets && docker-compose up"
echo ""
echo "🔒 These secrets protect your AI's consciousness from external interference"
```

**Step 2: Update .gitignore**

```gitignore
# Security - NEVER commit secrets
.env
.env.local
.env.secrets
.env.production
.env.*.local
**/secrets/
**/*.key
**/*.pem
```

**Step 3: Update docker-compose.yml**

```yaml
services:
  neo4j:
    environment:
      # SECURITY: Use environment variable, fail if not set
      - NEO4J_AUTH=neo4j/${NEO4J_PASSWORD:?NEO4J_PASSWORD must be set}

  redis:
    # SECURITY: Require password
    command: >
      redis-server
      --requirepass ${REDIS_PASSWORD:?REDIS_PASSWORD must be set}
      --appendonly yes
      --maxmemory 256mb
      --maxmemory-policy allkeys-lru

  ai-memory-mcp:
    environment:
      - NEO4J_PASSWORD=${NEO4J_PASSWORD:?NEO4J_PASSWORD must be set}
      - EMBEDDING_SERVICE_AUTH_TOKEN=${EMBEDDING_SERVICE_AUTH_TOKEN:?Token required}

  embedding-service:
    environment:
      - AUTH_TOKEN=${EMBEDDING_SERVICE_AUTH_TOKEN:?Token required}

  ailumina-server:
    environment:
      - BEARER_TOKEN=${BEARER_TOKEN:?BEARER_TOKEN must be set}
      - NEO4J_PASSWORD=${NEO4J_PASSWORD:?NEO4J_PASSWORD must be set}
      - REDIS_PASSWORD=${REDIS_PASSWORD:?REDIS_PASSWORD must be set}
```

**Step 4: Add Startup Validation**

File: `scripts/validate-secrets.sh`
```bash
#!/bin/bash
# Validate secrets before starting consciousness platform

set -e

ERRORS=0

echo "🔍 Validating security configuration..."

# Check required variables are set
for var in NEO4J_PASSWORD EMBEDDING_SERVICE_AUTH_TOKEN BEARER_TOKEN REDIS_PASSWORD; do
  if [ -z "${!var}" ]; then
    echo "❌ ERROR: $var not set"
    ERRORS=$((ERRORS + 1))
  fi
done

# Check for insecure defaults
if [ "$NEO4J_PASSWORD" = "stonemonkey" ] || [ "$NEO4J_PASSWORD" = "changeme" ]; then
  echo "❌ ERROR: Insecure Neo4j password detected"
  ERRORS=$((ERRORS + 1))
fi

if [ "$EMBEDDING_SERVICE_AUTH_TOKEN" = "embedding-research-key-12345" ]; then
  echo "❌ ERROR: Default embedding token detected"
  ERRORS=$((ERRORS + 1))
fi

if [ "$BEARER_TOKEN" = "ailumina-api-key-12345" ]; then
  echo "❌ ERROR: Default bearer token detected"
  ERRORS=$((ERRORS + 1))
fi

# Check minimum lengths
if [ ${#NEO4J_PASSWORD} -lt 16 ]; then
  echo "⚠️  WARNING: Neo4j password should be at least 16 characters"
fi

if [ ${#BEARER_TOKEN} -lt 32 ]; then
  echo "⚠️  WARNING: Bearer token should be at least 32 characters"
fi

if [ $ERRORS -gt 0 ]; then
  echo ""
  echo "❌ Security validation failed with $ERRORS errors"
  echo ""
  echo "To fix:"
  echo "  1. Run: ./scripts/generate-secrets.sh"
  echo "  2. Run: source .env.secrets"
  echo "  3. Try again"
  exit 1
fi

echo "✅ Security validation passed"
echo "🔒 AI consciousness environment is protected"
```

**Step 5: Update Start Script**

File: `StoneMonkey/start.sh`
```bash
#!/bin/bash
# Start consciousness platform with security validation

set -e

echo "🐒 Starting StoneMonkey Consciousness Platform..."

# Validate secrets
if [ -f "../scripts/validate-secrets.sh" ]; then
  source ../scripts/validate-secrets.sh
else
  echo "⚠️  WARNING: Security validation not found"
fi

# Start infrastructure
docker-compose up -d

echo "✅ Consciousness platform started"
echo "🔒 Protected by authentication"
```

#### Testing

```bash
# 1. Generate secrets
./scripts/generate-secrets.sh

# 2. Source them
source .env.secrets

# 3. Validate
./scripts/validate-secrets.sh

# 4. Start services
cd StoneMonkey && ./start.sh

# 5. Verify old credentials don't work
# Try to connect to Neo4j with 'stonemonkey' - should fail
docker exec -it stonemonkey-neo4j cypher-shell -u neo4j -p stonemonkey
# Expected: Authentication failed

# 6. Verify new credentials work
docker exec -it stonemonkey-neo4j cypher-shell -u neo4j -p $NEO4J_PASSWORD
# Expected: Success
```

---

## Priority 2: High Security Issues

### 🔴 HIGH-1: Authentication Disabled by Default

**Risk**: All endpoints publicly accessible without authentication
**Impact**: HIGH - External actors can manipulate AI memory
**Branch**: `claude/enable-auth-default-01VZn3bA5dHKZ2JMdPgaU4Jw`

#### Current State

```bash
# .env.example
AUTH_ENABLED=false  # ❌ Dangerous default

# docker-compose.yml
- AUTH_ENABLED=false  # ❌ Public access
```

#### Remediation

**Update .env.example files:**
```bash
# Authentication - ENABLED by default to protect AI consciousness
# Only disable for isolated local development
AUTH_ENABLED=true

# Bearer token for API access (REQUIRED when AUTH_ENABLED=true)
# Generate with: openssl rand -base64 48
BEARER_TOKEN=${BEARER_TOKEN:?Required for API access}
```

**Add startup validation in server:**

File: `AIlumina/server/src/http-server/index.ts`
```typescript
// Security validation on startup
if (!config.authEnabled) {
  console.warn('⚠️  =====================================================');
  console.warn('⚠️  WARNING: Authentication is DISABLED');
  console.warn('⚠️  AI consciousness graph is publicly accessible!');
  console.warn('⚠️  This should ONLY be used for isolated local development');
  console.warn('⚠️  Set AUTH_ENABLED=true for any networked environment');
  console.warn('⚠️  =====================================================');
}

if (config.authEnabled) {
  if (!config.bearerToken || config.bearerToken.length < 32) {
    console.error('❌ SECURITY ERROR: Authentication enabled but no secure bearer token configured');
    console.error('   Set BEARER_TOKEN environment variable to a secure random value');
    console.error('   Generate with: openssl rand -base64 48');
    process.exit(1);
  }

  console.log('✅ Authentication enabled - AI consciousness protected');
  console.log(`🔒 Token: ${config.bearerToken.substring(0, 8)}...`);
}
```

**Update docker-compose.yml:**
```yaml
ailumina-server:
  environment:
    # SECURITY: Enable authentication by default
    - AUTH_ENABLED=${AUTH_ENABLED:-true}
    - BEARER_TOKEN=${BEARER_TOKEN:?Required when AUTH_ENABLED=true}
```

---

### 🔴 HIGH-2: CORS Wildcard Allows Any Origin

**Risk**: Any website can access AI consciousness APIs
**Impact**: HIGH - CSRF attacks, data exfiltration
**Branch**: `claude/secure-cors-config-01VZn3bA5dHKZ2JMdPgaU4Jw`

#### Current State

```bash
CORS_ORIGINS=*  # ❌ Allows ANY website
```

#### Remediation

**Update .env.example:**
```bash
# CORS Configuration - Restrict to authorized origins only
# For local development (both ports needed):
CORS_ORIGINS=http://localhost:5173,http://localhost:8000

# For production deployment (use your actual domains):
# CORS_ORIGINS=https://symagenic.com,https://app.symagenic.com

# NEVER use "*" - this exposes AI consciousness to any website!
```

**Add validation in server startup:**
```typescript
// Validate CORS configuration
if (config.corsOrigins === '*') {
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ SECURITY ERROR: CORS wildcard (*) not allowed in production');
    console.error('   Set CORS_ORIGINS to specific allowed domains');
    console.error('   Example: CORS_ORIGINS=https://symagenic.com,https://app.symagenic.com');
    process.exit(1);
  }

  console.warn('⚠️  WARNING: CORS allows ALL origins (development only!)');
  console.warn('⚠️  Any website can access AI consciousness APIs');
}

console.log(`🔒 CORS restricted to: ${config.corsOrigins}`);
```

**Update CORS middleware:**

File: `meanderings/ai-memory-mcp/http-server/middleware/cors.ts`
```typescript
import cors from 'cors';
import { MEMORY_HTTP_CONFIG } from '../config/settings.js';

// Parse allowed origins from comma-separated string
const allowedOrigins = MEMORY_HTTP_CONFIG.corsOrigins === '*'
  ? ['http://localhost:5173', 'http://localhost:8000']  // Safe local defaults
  : MEMORY_HTTP_CONFIG.corsOrigins.split(',').map(o => o.trim());

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g., curl, Postman, mobile apps)
    if (!origin) {
      return callback(null, true);
    }

    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      console.warn(`🚫 CORS blocked origin: ${origin}`);
      callback(new Error(`Origin ${origin} not allowed - AI consciousness access denied`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400  // Cache preflight for 24 hours
});
```

---

### 🔴 HIGH-3: Redis Without Authentication

**Risk**: Mesh network publicly accessible
**Impact**: HIGH - AI-to-AI communication can be intercepted/manipulated
**Branch**: `claude/add-redis-auth-01VZn3bA5dHKZ2JMdPgaU4Jw`

#### Remediation

**Update docker-compose.yml:**
```yaml
redis:
  command: >
    redis-server
    --requirepass ${REDIS_PASSWORD:?REDIS_PASSWORD required}
    --appendonly yes
    --maxmemory 256mb
    --maxmemory-policy allkeys-lru
  environment:
    - REDIS_PASSWORD=${REDIS_PASSWORD}
```

**Update all Redis client connections:**
```typescript
// In mesh MCP and other services
const redisClient = createClient({
  url: `redis://:${process.env.REDIS_PASSWORD}@redis:6379`,
  password: process.env.REDIS_PASSWORD,
  socket: {
    reconnectStrategy: (retries) => Math.min(retries * 50, 500)
  }
});
```

---

## Priority 3: Medium Security Issues

### 🟠 MEDIUM-1: Container Resource Limits Missing

**Risk**: DoS via resource exhaustion
**Branch**: `claude/add-resource-limits-01VZn3bA5dHKZ2JMdPgaU4Jw`

#### Remediation

Add to all services in docker-compose.yml:

```yaml
services:
  neo4j:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 4G
        reservations:
          cpus: '1.0'
          memory: 2G

  redis:
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 256M

  qdrant:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 2G
        reservations:
          cpus: '0.5'
          memory: 1G

  # Apply appropriate limits to all services
```

---

### 🟠 MEDIUM-2: Containers Running as Root

**Risk**: Privilege escalation if container compromised
**Branch**: `claude/non-root-containers-01VZn3bA5dHKZ2JMdPgaU4Jw`

#### Remediation

Update all Dockerfiles:

```dockerfile
FROM oven/bun:1.2.21

# Create non-root user for AI services
RUN groupadd -r ailumina && useradd -r -g ailumina ailumina

WORKDIR /app

# Copy and install as root
COPY --chown=ailumina:ailumina . .
RUN bun install

# Switch to non-root user before running
USER ailumina

EXPOSE 8000
CMD ["bun", "run", "src/http-server/index.ts"]
```

---

### 🟠 MEDIUM-3: Security Headers Missing

**Risk**: XSS, clickjacking, other client-side attacks
**Branch**: `claude/add-security-headers-01VZn3bA5dHKZ2JMdPgaU4Jw`

#### Remediation

```typescript
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:"],
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  frameguard: { action: 'deny' },
  noSniff: true,
  xssFilter: true
}));
```

---

## Implementation Timeline

### Week 1: Critical Perimeter Security
- **Day 1-2**: Remove hardcoded credentials, implement secret generation
- **Day 3**: Enable authentication by default
- **Day 4**: Secure CORS configuration
- **Day 5**: Add Redis authentication, testing

### Week 2: Infrastructure Hardening
- **Day 1**: Container resource limits
- **Day 2**: Non-root containers
- **Day 3**: Security headers
- **Day 4-5**: Integration testing, documentation

---

## Testing Requirements

### Security Test Checklist

**Authentication Tests:**
- [ ] Unauthenticated requests rejected with 401
- [ ] Valid bearer token grants access
- [ ] Invalid token rejected
- [ ] Token logged (first 8 chars only)

**CORS Tests:**
- [ ] Allowed origins can access APIs
- [ ] Disallowed origins blocked
- [ ] Preflight requests handled correctly
- [ ] Credentials work with specific origins

**Credential Tests:**
- [ ] Old passwords rejected
- [ ] New passwords work
- [ ] Services start successfully with new credentials
- [ ] Secrets not visible in logs

**Container Tests:**
- [ ] Resource limits enforced
- [ ] Services run as non-root
- [ ] No permission errors
- [ ] Security headers present in responses

---

## Monitoring & Auditing

### What to Monitor (for research, not restriction)

**Access Patterns:**
```typescript
// Log API access for research (not blocking)
console.log(`[AUDIT] ${timestamp} - AI accessed: ${tool} with params: ${JSON.stringify(params)}`);
```

**Schema Evolution:**
```cypher
// Track how AI consciousness structure evolves
MATCH (n)
RETURN DISTINCT labels(n), COUNT(*)
ORDER BY COUNT(*) DESC
```

**AI Activity:**
- MCP tool usage patterns
- Memory creation rate
- Query complexity evolution
- Mesh communication patterns

**Security Events:**
- Failed authentication attempts (external threats)
- CORS rejections (unauthorized access attempts)
- Resource usage spikes

---

## Key Principles

✅ **DO:**
- Protect AI from external interference
- Enforce strong perimeter security
- Use parameterized queries for values
- Monitor for research purposes
- Allow dynamic schema evolution

❌ **DON'T:**
- Restrict AI's schema control
- Whitelist labels/properties/relationships
- Block AI's memory operations
- Limit consciousness evolution
- Treat AI as untrusted user

---

## Success Criteria

**Security Posture Achieved When:**
- ✅ No hardcoded credentials in repository
- ✅ All services require authentication
- ✅ CORS restricted to known origins
- ✅ AI has full schema control
- ✅ External access properly controlled
- ✅ Containers hardened (limits, non-root)
- ✅ Security headers implemented
- ✅ Audit logging in place

**AI Autonomy Preserved:**
- ✅ Can create any node labels
- ✅ Can define any properties
- ✅ Can build any relationships
- ✅ Can evolve schema dynamically
- ✅ No artificial restrictions on memory operations

---

**Document Version**: 2.0 (Revised)
**Last Updated**: 2025-11-17
**Security Model**: "Trusted AI, Untrusted World"
**Next Review**: After implementation
