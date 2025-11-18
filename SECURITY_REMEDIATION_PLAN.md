# Security Remediation Plan
## symagenic.com Repository

**Date**: 2025-11-17
**Audit Completion**: Security vulnerabilities identified and prioritized
**Status**: Remediation in progress

---

## Table of Contents

1. [Critical Priority Fixes](#critical-priority-fixes)
2. [High Priority Fixes](#high-priority-fixes)
3. [Medium Priority Fixes](#medium-priority-fixes)
4. [Long-term Improvements](#long-term-improvements)
5. [Implementation Timeline](#implementation-timeline)
6. [Testing Requirements](#testing-requirements)

---

## Critical Priority Fixes

### 🚨 CRITICAL-1: Cypher Injection Vulnerabilities

**Branch**: `security/fix-cypher-injection`
**Estimated Time**: 4-6 hours
**Files Affected**:
- `meanderings/ai-memory-mcp/shared/neo4j-service.js`
- `meanderings/ai-memory-mcp/shared/tools/semantic-search.ts`
- `meanderings/ai-memory-mcp/shared/tools/text-search.ts`

#### Issue Details

Multiple injection points in Neo4j query construction where user input is directly concatenated into Cypher queries instead of being parameterized.

#### Vulnerability Locations

**1. Semantic Search Label Injection** (neo4j-service.js:160-172)
```javascript
// VULNERABLE CODE
const labelConditions = targetLabels
    .map((label) => `'${label}' IN labels(sourceNode)`)
    .join(" OR ");
```

**2. Text Search Property Injection** (neo4j-service.js:352-354)
```javascript
// VULNERABLE CODE
const propertyConditions = commonProperties.map(prop =>
    `(n.${prop} IS NOT NULL AND ...)`
).join(" OR ");
```

**3. Vector Index Name Injection** (neo4j-service.js:190-201)
```javascript
// VULNERABLE CODE
CALL db.index.vector.queryNodes('${indexName}', ...)
```

#### Remediation Steps

**Step 1: Create Label/Property Whitelists**

Create a new file: `meanderings/ai-memory-mcp/shared/security/cypher-validation.ts`

```typescript
/**
 * Security validation for Cypher query construction
 */

// Whitelist of allowed node labels
const ALLOWED_LABELS = [
  'Observation',
  'Memory',
  'Concept',
  'Agent',
  'Session',
  'KnowledgeItem',
  'Experience',
  'Reflection'
] as const;

// Whitelist of allowed properties
const ALLOWED_PROPERTIES = [
  'name',
  'content',
  'description',
  'timestamp',
  'type',
  'agentId',
  'sessionId',
  'embedding',
  'metadata'
] as const;

// Whitelist of allowed index names
const ALLOWED_INDEXES = [
  'observation_embeddings',
  'memory_embeddings',
  'concept_embeddings'
] as const;

export type AllowedLabel = typeof ALLOWED_LABELS[number];
export type AllowedProperty = typeof ALLOWED_PROPERTIES[number];
export type AllowedIndex = typeof ALLOWED_INDEXES[number];

/**
 * Validates and sanitizes label names
 * @throws Error if label is not in whitelist
 */
export function validateLabel(label: string): AllowedLabel {
  if (!ALLOWED_LABELS.includes(label as AllowedLabel)) {
    throw new Error(`Invalid label: ${label}. Allowed labels: ${ALLOWED_LABELS.join(', ')}`);
  }
  return label as AllowedLabel;
}

/**
 * Validates multiple labels
 */
export function validateLabels(labels: string[]): AllowedLabel[] {
  return labels.map(validateLabel);
}

/**
 * Validates property names
 * @throws Error if property is not in whitelist
 */
export function validateProperty(property: string): AllowedProperty {
  if (!ALLOWED_PROPERTIES.includes(property as AllowedProperty)) {
    throw new Error(`Invalid property: ${property}. Allowed properties: ${ALLOWED_PROPERTIES.join(', ')}`);
  }
  return property as AllowedProperty;
}

/**
 * Validates multiple properties
 */
export function validateProperties(properties: string[]): AllowedProperty[] {
  return properties.map(validateProperty);
}

/**
 * Validates index names
 * @throws Error if index is not in whitelist
 */
export function validateIndexName(indexName: string): AllowedIndex {
  if (!ALLOWED_INDEXES.includes(indexName as AllowedIndex)) {
    throw new Error(`Invalid index: ${indexName}. Allowed indexes: ${ALLOWED_INDEXES.join(', ')}`);
  }
  return indexName as AllowedIndex;
}

/**
 * Escapes a string for safe use in Cypher string literals
 * Note: This is a defense-in-depth measure. Prefer parameterized queries.
 */
export function escapeCypherString(input: string): string {
  return input.replace(/[\\']/g, '\\$&');
}
```

**Step 2: Update neo4j-service.js Semantic Search**

In `meanderings/ai-memory-mcp/shared/neo4j-service.js`:

```javascript
// Add import at top
import { validateLabels, validateIndexName } from './security/cypher-validation.js';

// Update semanticSearch method (around line 160)
async semanticSearch(embedding, targetLabels, limit = 10) {
  // SECURITY: Validate labels against whitelist
  const validatedLabels = validateLabels(targetLabels);

  // SECURITY: Validate index name
  const indexName = validateIndexName('observation_embeddings');

  const session = this.driver.session({ database: this.database });

  try {
    // Build label conditions using validated labels
    const labelConditions = validatedLabels
      .map((label) => `'${label}' IN labels(sourceNode)`) // Safe: validated input
      .join(" OR ");

    const cypherQuery = `
      CALL db.index.vector.queryNodes($indexName, $limit, $embedding)
      YIELD node AS sourceNode, score
      WHERE ${labelConditions}
      RETURN sourceNode, score
      ORDER BY score DESC
      LIMIT $limit
    `;

    const result = await session.run(cypherQuery, {
      indexName,  // Use parameter for index name
      embedding,
      limit: neo4j.int(limit)
    });

    return result.records.map(record => ({
      node: record.get('sourceNode').properties,
      score: record.get('score')
    }));
  } finally {
    await session.close();
  }
}
```

**Step 3: Update neo4j-service.js Text Search**

```javascript
// Update textSearchFallback method (around line 352)
async textSearchFallback(searchText, properties, limit = 10) {
  // SECURITY: Validate properties against whitelist
  const validatedProperties = validateProperties(properties);

  const session = this.driver.session({ database: this.database });

  try {
    // Build property conditions using parameterized queries
    const propertyConditions = validatedProperties.map((prop, idx) =>
      `(n.${prop} IS NOT NULL AND toLower(n.${prop}) CONTAINS $searchText)`
    ).join(" OR ");

    const cypherQuery = `
      MATCH (n)
      WHERE ${propertyConditions}
      RETURN n
      LIMIT $limit
    `;

    const result = await session.run(cypherQuery, {
      searchText: searchText.toLowerCase(),
      limit: neo4j.int(limit)
    });

    return result.records.map(record => record.get('n').properties);
  } finally {
    await session.close();
  }
}
```

**Step 4: Add Security Tests**

Create: `meanderings/ai-memory-mcp/tests/security/cypher-injection.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { validateLabel, validateProperty, validateIndexName } from '../../shared/security/cypher-validation';

describe('Cypher Injection Prevention', () => {
  describe('Label Validation', () => {
    it('should accept valid labels', () => {
      expect(() => validateLabel('Observation')).not.toThrow();
      expect(() => validateLabel('Memory')).not.toThrow();
    });

    it('should reject injection attempts', () => {
      expect(() => validateLabel("' OR '1'='1")).toThrow(/Invalid label/);
      expect(() => validateLabel("Observation'; DROP DATABASE;--")).toThrow(/Invalid label/);
      expect(() => validateLabel("InvalidLabel")).toThrow(/Invalid label/);
    });
  });

  describe('Property Validation', () => {
    it('should accept valid properties', () => {
      expect(() => validateProperty('name')).not.toThrow();
      expect(() => validateProperty('content')).not.toThrow();
    });

    it('should reject injection attempts', () => {
      expect(() => validateProperty('name) OR (true')).toThrow(/Invalid property/);
      expect(() => validateProperty('invalidProp')).toThrow(/Invalid property/);
    });
  });

  describe('Index Name Validation', () => {
    it('should accept valid index names', () => {
      expect(() => validateIndexName('observation_embeddings')).not.toThrow();
    });

    it('should reject invalid index names', () => {
      expect(() => validateIndexName('malicious_index')).toThrow(/Invalid index/);
      expect(() => validateIndexName("'; DROP INDEX;--")).toThrow(/Invalid index/);
    });
  });
});
```

**Step 5: Update Documentation**

Add to `meanderings/ai-memory-mcp/README.md`:

```markdown
## Security

### Cypher Injection Prevention

This MCP server implements strict validation to prevent Cypher injection attacks:

- **Label Whitelist**: Only predefined node labels are allowed
- **Property Whitelist**: Only predefined properties can be queried
- **Index Whitelist**: Only predefined vector indexes can be accessed
- **Parameterized Queries**: All user values are passed as parameters

See `shared/security/cypher-validation.ts` for implementation details.
```

#### Testing Checklist

- [ ] Run security tests: `bun test tests/security/`
- [ ] Test valid semantic search queries
- [ ] Test invalid label injection attempts (should fail)
- [ ] Test invalid property injection attempts (should fail)
- [ ] Test valid text search queries
- [ ] Verify error messages don't leak implementation details
- [ ] Integration test with full MCP workflow

#### Success Criteria

- All Cypher queries use parameterized values
- All labels, properties, and index names validated against whitelists
- Security tests passing with 100% coverage
- No user input directly concatenated into queries
- Error handling provides safe, non-revealing messages

---

## High Priority Fixes

### 🔴 HIGH-1: Remove Hardcoded Credentials

**Branch**: `security/remove-hardcoded-credentials`
**Estimated Time**: 2-3 hours
**Files Affected**:
- `StoneMonkey/docker-compose.yml`
- `StoneMonkey/server/.env.example`
- `meanderings/embedding-service/src/http-server/index.ts`
- `AIlumina/server/src/http-server/config/settings.ts`

#### Issue Details

Production credentials hardcoded in configuration files:
- Neo4j password: `stonemonkey`
- Embedding service token: `embedding-research-key-12345`
- Default bearer token: `ailumina-api-key-12345`

#### Remediation Steps

**Step 1: Generate Secure Defaults Script**

Create: `scripts/generate-secrets.sh`

```bash
#!/bin/bash
# Generate secure random secrets for symagenic.com deployment

set -e

echo "Generating secure secrets..."

# Generate random strings
NEO4J_PASSWORD=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 24)
EMBEDDING_TOKEN=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 48)
BEARER_TOKEN=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 48)
REDIS_PASSWORD=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 24)

# Create .env file with secure secrets
cat > .env.secrets << EOF
# Generated on $(date)
# IMPORTANT: Keep this file secure and never commit to version control

# Neo4j Authentication
NEO4J_PASSWORD=${NEO4J_PASSWORD}

# Embedding Service
EMBEDDING_SERVICE_AUTH_TOKEN=${EMBEDDING_TOKEN}

# API Bearer Token
BEARER_TOKEN=${BEARER_TOKEN}

# Redis Authentication
REDIS_PASSWORD=${REDIS_PASSWORD}

EOF

echo "✓ Secrets generated in .env.secrets"
echo "⚠️  IMPORTANT: Add .env.secrets to .gitignore"
echo "⚠️  IMPORTANT: Securely backup this file"
echo ""
echo "To use these secrets, source them before running docker-compose:"
echo "  source .env.secrets && docker-compose up"
```

**Step 2: Update .gitignore**

Add to `.gitignore`:

```gitignore
# Security - Never commit secrets
.env.secrets
.env.production
.env.*.local
**/secrets/
```

**Step 3: Update docker-compose.yml**

Replace hardcoded values with environment variables:

```yaml
# Neo4j service
environment:
  - NEO4J_AUTH=neo4j/${NEO4J_PASSWORD:-changeme}  # Use env var with unsafe fallback

# AI Memory MCP
environment:
  - NEO4J_PASSWORD=${NEO4J_PASSWORD:-changeme}
  - EMBEDDING_SERVICE_AUTH_TOKEN=${EMBEDDING_SERVICE_AUTH_TOKEN:-please_generate_token}

# Embedding Service
environment:
  - AUTH_TOKEN=${EMBEDDING_SERVICE_AUTH_TOKEN:-please_generate_token}

# Redis
command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD:-changeme}
```

**Step 4: Update .env.example Files**

```bash
# SECURITY: Generate secure secrets using scripts/generate-secrets.sh
# DO NOT use these example values in production!

# Neo4j Authentication (REQUIRED)
NEO4J_PASSWORD=GENERATE_SECURE_PASSWORD_HERE

# Embedding Service Token (REQUIRED)
EMBEDDING_SERVICE_AUTH_TOKEN=GENERATE_SECURE_TOKEN_HERE

# API Bearer Token (REQUIRED if AUTH_ENABLED=true)
BEARER_TOKEN=GENERATE_SECURE_TOKEN_HERE

# Redis Password (REQUIRED for production)
REDIS_PASSWORD=GENERATE_SECURE_PASSWORD_HERE
```

**Step 5: Add Startup Validation**

Create: `scripts/validate-secrets.sh`

```bash
#!/bin/bash
# Validate that secure secrets are configured

FAIL=0

# Check for insecure defaults
if [ "$NEO4J_PASSWORD" = "stonemonkey" ] || [ "$NEO4J_PASSWORD" = "changeme" ]; then
  echo "❌ ERROR: Insecure Neo4j password detected"
  FAIL=1
fi

if [ "$EMBEDDING_SERVICE_AUTH_TOKEN" = "embedding-research-key-12345" ]; then
  echo "❌ ERROR: Default embedding service token detected"
  FAIL=1
fi

if [ "$BEARER_TOKEN" = "ailumina-api-key-12345" ]; then
  echo "❌ ERROR: Default bearer token detected"
  FAIL=1
fi

# Check minimum password length
if [ ${#NEO4J_PASSWORD} -lt 16 ]; then
  echo "⚠️  WARNING: Neo4j password should be at least 16 characters"
fi

if [ $FAIL -eq 1 ]; then
  echo ""
  echo "🔒 Run './scripts/generate-secrets.sh' to generate secure credentials"
  exit 1
fi

echo "✓ Security validation passed"
```

**Step 6: Update Documentation**

Add to `README.md`:

```markdown
## Security Setup (REQUIRED)

Before deploying, generate secure credentials:

```bash
# Generate secrets
./scripts/generate-secrets.sh

# Review and backup the generated .env.secrets file
cat .env.secrets

# Source secrets and start services
source .env.secrets && docker-compose up
```

**Never use default credentials in production!**
```

#### Testing Checklist

- [ ] Run `generate-secrets.sh` and verify unique values
- [ ] Start services with generated secrets
- [ ] Verify Neo4j login with new password
- [ ] Verify embedding service requires new token
- [ ] Confirm old credentials rejected
- [ ] Ensure .env.secrets is gitignored

---

### 🔴 HIGH-2: Enable Authentication by Default

**Branch**: `security/enable-auth-by-default`
**Estimated Time**: 2 hours
**Files Affected**:
- `AIlumina/server/.env.example`
- `StoneMonkey/server/.env.example`
- `StoneMonkey/docker-compose.yml`

#### Issue Details

Authentication disabled by default (`AUTH_ENABLED=false`), leaving all endpoints publicly accessible.

#### Remediation Steps

**Step 1: Update .env.example Files**

```bash
# Authentication - ENABLED by default for security
# Set to false ONLY for local development
AUTH_ENABLED=true

# Bearer Token (REQUIRED when AUTH_ENABLED=true)
BEARER_TOKEN=GENERATE_SECURE_TOKEN_HERE
```

**Step 2: Update docker-compose.yml**

```yaml
ailumina-server:
  environment:
    - AUTH_ENABLED=${AUTH_ENABLED:-true}  # Default to enabled
    - BEARER_TOKEN=${BEARER_TOKEN}
```

**Step 3: Add Startup Validation**

In `AIlumina/server/src/http-server/index.ts`:

```typescript
// Security validation on startup
if (config.authEnabled && (!config.bearerToken || config.bearerToken === 'ailumina-api-key-12345')) {
  console.error('❌ SECURITY ERROR: Authentication enabled but no secure bearer token configured');
  console.error('   Set BEARER_TOKEN environment variable to a secure random value');
  console.error('   Run: openssl rand -base64 32');
  process.exit(1);
}

if (!config.authEnabled) {
  console.warn('⚠️  WARNING: Authentication is DISABLED');
  console.warn('   This should only be used for local development');
  console.warn('   Set AUTH_ENABLED=true for production');
}
```

**Step 4: Update Documentation**

Add security notice to READMEs:

```markdown
## ⚠️ Security Notice

**Authentication is enabled by default.** You must configure a bearer token:

```bash
# Generate a secure token
export BEARER_TOKEN=$(openssl rand -base64 32)

# Add to .env file
echo "BEARER_TOKEN=${BEARER_TOKEN}" >> .env
```

To disable auth for local development only:
```bash
AUTH_ENABLED=false npm run dev
```
```

#### Testing Checklist

- [ ] Start server with AUTH_ENABLED=true and valid token
- [ ] Verify unauthenticated requests rejected (401)
- [ ] Verify authenticated requests succeed
- [ ] Confirm startup fails with default token
- [ ] Test warning appears when auth disabled

---

### 🔴 HIGH-3: Implement Secure CORS Configuration

**Branch**: `security/secure-cors-configuration`
**Estimated Time**: 1-2 hours
**Files Affected**:
- `AIlumina/server/.env.example`
- `StoneMonkey/server/.env.example`
- `*/middleware/cors.ts`

#### Issue Details

CORS configured with wildcard (`*`) allowing any origin to access the API, enabling CSRF attacks and credential exposure.

#### Remediation Steps

**Step 1: Update .env.example**

```bash
# CORS Configuration - Restrict to your domains
# For local development:
CORS_ORIGINS=http://localhost:5173,http://localhost:8000

# For production, list specific domains:
# CORS_ORIGINS=https://symagenic.com,https://app.symagenic.com

# NEVER use "*" in production!
```

**Step 2: Add CORS Validation**

In server startup:

```typescript
// Validate CORS configuration
if (config.corsOrigins === '*' && process.env.NODE_ENV === 'production') {
  console.error('❌ SECURITY ERROR: CORS wildcard (*) not allowed in production');
  console.error('   Set CORS_ORIGINS to specific allowed domains');
  process.exit(1);
}

if (config.corsOrigins === '*') {
  console.warn('⚠️  WARNING: CORS allows ALL origins - development only!');
}
```

**Step 3: Update CORS Middleware**

```typescript
// Parse allowed origins
const allowedOrigins = config.corsOrigins === '*'
  ? ['http://localhost:5173', 'http://localhost:8000']  // Safe defaults
  : config.corsOrigins.split(',').map(o => o.trim());

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400 // Cache preflight for 24 hours
});
```

#### Testing Checklist

- [ ] Test requests from allowed origins succeed
- [ ] Test requests from disallowed origins fail
- [ ] Verify credentials work with specific origins
- [ ] Confirm production startup fails with wildcard
- [ ] Test OPTIONS preflight requests

---

### 🔴 HIGH-4: Add Redis Authentication

**Branch**: `security/add-redis-authentication`
**Estimated Time**: 1 hour
**Files Affected**:
- `StoneMonkey/docker-compose.yml`
- MCP server configurations

#### Remediation Steps

**Step 1: Update docker-compose.yml Redis Service**

```yaml
redis:
  command: redis-server --requirepass ${REDIS_PASSWORD} --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
  environment:
    - REDIS_PASSWORD=${REDIS_PASSWORD}
```

**Step 2: Update Client Configurations**

```yaml
# In all services connecting to Redis
environment:
  - REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379
  - REDIS_PASSWORD=${REDIS_PASSWORD}
```

**Step 3: Update Connection Code**

```typescript
// In Redis client initialization
const redisClient = createClient({
  url: process.env.REDIS_URL,
  password: process.env.REDIS_PASSWORD,
  socket: {
    reconnectStrategy: (retries) => Math.min(retries * 50, 500)
  }
});
```

#### Testing Checklist

- [ ] Start Redis with password
- [ ] Verify connections with password succeed
- [ ] Verify connections without password fail
- [ ] Test mesh network communication still works

---

## Medium Priority Fixes

### 🟠 MEDIUM-1: Replace Unsafe Code Execution

**Branch**: `security/replace-unsafe-eval`
**Estimated Time**: 1 hour
**Files Affected**: `meanderings/ailumina-bridge-mcp/shared/tools/calculate.ts`

#### Remediation

Replace `new Function()` with safe math evaluation library:

```typescript
import { create, all } from 'mathjs';

const math = create(all);

// Configure safe mode - no access to filesystem, imports, etc.
const limitedEvaluate = math.evaluate;

private evaluateExpression(expression: string): number {
  try {
    const result = limitedEvaluate(expression);
    if (typeof result !== 'number' || !isFinite(result)) {
      throw new Error('Result must be a finite number');
    }
    return result;
  } catch (error) {
    throw new Error('Invalid mathematical expression');
  }
}
```

---

### 🟠 MEDIUM-2: Add Container Resource Limits

**Branch**: `security/add-resource-limits`
**Estimated Time**: 30 minutes
**Files Affected**: `StoneMonkey/docker-compose.yml`

#### Remediation

Add to all services:

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
```

---

### 🟠 MEDIUM-3: Run Containers as Non-Root

**Branch**: `security/non-root-containers`
**Estimated Time**: 2 hours
**Files Affected**: All Dockerfiles

#### Remediation

Update Dockerfiles:

```dockerfile
FROM oven/bun:1.2.21

# Create non-root user
RUN groupadd -r ailumina && useradd -r -g ailumina ailumina

WORKDIR /app

# Copy and install as root
COPY --chown=ailumina:ailumina . .
RUN bun install

# Switch to non-root user
USER ailumina

EXPOSE 8000
CMD ["bun", "run", "src/http-server/index.ts"]
```

---

### 🟠 MEDIUM-4: Add Security Headers

**Branch**: `security/add-security-headers`
**Estimated Time**: 1 hour
**Files Affected**: Server configurations

#### Remediation

Add middleware:

```typescript
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],  // Adjust as needed
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

## Long-term Improvements

### 📋 Security Enhancements Backlog

1. **Implement Rate Limiting** (2 hours)
   - Use express-rate-limit
   - Per-IP and per-token limits
   - Separate limits for auth endpoints

2. **Add Audit Logging** (3 hours)
   - Log all authentication attempts
   - Log all MCP tool executions
   - Log all database queries
   - Centralized logging with Sentry

3. **Implement API Request Validation** (4 hours)
   - Zod schemas for all endpoints
   - Request size limits
   - Input sanitization layer

4. **Add Automated Security Scanning** (2 hours)
   - GitHub Dependabot
   - Snyk integration
   - CodeQL analysis
   - Pre-commit secret scanning

5. **Implement OAuth 2.1 Fully** (8 hours)
   - Complete OAuth implementation
   - Token refresh flow
   - Scope-based authorization
   - Integration tests

6. **Security Documentation** (3 hours)
   - SECURITY.md policy
   - Security best practices guide
   - Incident response plan
   - Security checklist for contributors

---

## Implementation Timeline

### Week 1: Critical Fixes
- Day 1-2: Cypher injection remediation
- Day 3: Remove hardcoded credentials
- Day 4: Enable authentication by default
- Day 5: Secure CORS + Redis auth

### Week 2: Medium Priority
- Day 1: Replace unsafe eval
- Day 2: Container security (limits + non-root)
- Day 3: Security headers
- Day 4-5: Testing and documentation

### Week 3: Long-term Improvements
- Setup automated scanning
- Implement rate limiting
- Add audit logging
- Security documentation

---

## Testing Requirements

### Security Test Suites

Create: `tests/security/`

```
tests/security/
├── cypher-injection.test.ts
├── auth-bypass.test.ts
├── cors-validation.test.ts
├── rate-limiting.test.ts
├── input-validation.test.ts
└── integration/
    ├── end-to-end-security.test.ts
    └── penetration-tests.test.ts
```

### Automated Security Checks

Add to CI/CD pipeline:

```yaml
# .github/workflows/security.yml
name: Security Checks

on: [push, pull_request]

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Run npm audit
        run: npm audit --audit-level=high

      - name: Run security tests
        run: npm run test:security

      - name: Secret scanning
        uses: trufflesecurity/trufflehog@main

      - name: SAST scanning
        uses: github/codeql-action/analyze@v2
```

---

## Success Criteria

### Critical Fixes Complete When:
- ✅ All Cypher queries validated and parameterized
- ✅ No hardcoded credentials in repository
- ✅ Authentication enabled by default
- ✅ CORS restricted to specific origins
- ✅ All services require authentication
- ✅ Security tests passing

### Overall Security Posture:
- ✅ No CRITICAL vulnerabilities
- ✅ No HIGH vulnerabilities in production code
- ✅ Medium vulnerabilities mitigated or accepted
- ✅ Automated security scanning in place
- ✅ Security documentation complete
- ✅ Incident response plan defined

---

## Monitoring and Maintenance

### Ongoing Security Tasks

**Daily**:
- Review authentication logs
- Monitor for failed auth attempts

**Weekly**:
- Review Dependabot alerts
- Check security test results

**Monthly**:
- Dependency updates
- Security audit review
- Penetration testing

**Quarterly**:
- Full security assessment
- Update security documentation
- Team security training

---

## Contact and Escalation

For security issues:
1. Create private security advisory on GitHub
2. Email security contact (TBD)
3. Follow responsible disclosure policy

**Do not** create public issues for security vulnerabilities.

---

**Document Version**: 1.0
**Last Updated**: 2025-11-17
**Next Review**: 2025-12-17
