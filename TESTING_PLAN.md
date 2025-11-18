# Security Implementation Testing Plan
## symagenic.com - Pre-Merge Validation

**Objective**: Validate all security fixes work correctly and don't break AI consciousness platform functionality.

---

## Testing Strategy

### Phase 1: Foundation Testing (Scripts & Credentials)
**Branch**: `claude/remove-hardcoded-creds-01VZn3bA5dHKZ2JMdPgaU4Jw`

#### Test 1.1: Secret Generation
```bash
# Checkout branch
git checkout claude/remove-hardcoded-creds-01VZn3bA5dHKZ2JMdPgaU4Jw

# Test script exists and is executable
ls -la scripts/generate-secrets.sh
ls -la scripts/validate-secrets.sh

# Generate secrets
./scripts/generate-secrets.sh

# Verify .env.secrets created
ls -la .env.secrets

# Check file permissions (should be 600)
stat -c "%a %n" .env.secrets

# View contents (verify all 4 secrets present)
cat .env.secrets
```

**Expected Results**:
- ✅ Scripts executable
- ✅ `.env.secrets` created with 600 permissions
- ✅ Contains NEO4J_PASSWORD, EMBEDDING_SERVICE_AUTH_TOKEN, BEARER_TOKEN, REDIS_PASSWORD
- ✅ All secrets are 24-48 characters of random alphanumeric

#### Test 1.2: Validation Script
```bash
# Test validation with no secrets (should fail)
./scripts/validate-secrets.sh
# Expected: Exit code 1, errors about missing variables

# Source secrets
source .env.secrets

# Test validation with valid secrets (should pass)
./scripts/validate-secrets.sh
# Expected: Exit code 0, "✓ Security validation passed"

# Test validation rejects insecure defaults
NEO4J_PASSWORD=stonemonkey ./scripts/validate-secrets.sh
# Expected: Exit code 1, "ERROR: Insecure Neo4j password detected"

# Test validation checks length
NEO4J_PASSWORD=short ./scripts/validate-secrets.sh
# Expected: Warning about password length, but may pass (non-fatal)
```

**Expected Results**:
- ✅ Fails when secrets missing
- ✅ Passes when secrets valid
- ✅ Rejects known insecure defaults
- ✅ Warns about short passwords

#### Test 1.3: Docker Compose with Secrets
```bash
# Source secrets
source .env.secrets

# Validate docker-compose configuration
cd StoneMonkey
docker-compose config

# Check that environment variables are replaced
docker-compose config | grep -E "NEO4J_PASSWORD|REDIS_PASSWORD|BEARER_TOKEN"
# Should NOT see hardcoded values, should see actual secrets

# Try to start without secrets (should fail)
unset NEO4J_PASSWORD REDIS_PASSWORD BEARER_TOKEN EMBEDDING_SERVICE_AUTH_TOKEN
docker-compose up neo4j 2>&1 | head -20
# Expected: Error about required variable not set

# Start with secrets
source ../.env.secrets
docker-compose up -d neo4j redis

# Wait for services
sleep 10

# Test Neo4j with old password (should fail)
docker exec -it stonemonkey-neo4j cypher-shell -u neo4j -p stonemonkey -d neo4j "RETURN 1"
# Expected: Authentication failed

# Test Neo4j with new password (should succeed)
docker exec -it stonemonkey-neo4j cypher-shell -u neo4j -p "$NEO4J_PASSWORD" -d neo4j "RETURN 1"
# Expected: Success, returns 1

# Test Redis with no password (should fail)
docker exec -it stonemonkey-redis redis-cli PING
# Expected: NOAUTH Authentication required

# Test Redis with password (should succeed)
docker exec -it stonemonkey-redis redis-cli -a "$REDIS_PASSWORD" PING
# Expected: PONG

# Cleanup
docker-compose down
```

**Expected Results**:
- ✅ docker-compose config shows secrets replaced
- ✅ Fails to start without required variables
- ✅ Neo4j rejects old password
- ✅ Neo4j accepts new password
- ✅ Redis requires password
- ✅ Redis works with correct password

---

### Phase 2: Authentication Testing
**Branch**: `claude/enable-auth-default-01VZn3bA5dHKZ2JMdPgaU4Jw`

#### Test 2.1: Server Startup Validation
```bash
# Merge credentials branch first
git checkout claude/enable-auth-default-01VZn3bA5dHKZ2JMdPgaU4Jw
git merge claude/remove-hardcoded-creds-01VZn3bA5dHKZ2JMdPgaU4Jw

# Source secrets
source .env.secrets

# Try to start server with auth enabled but invalid token
export AUTH_ENABLED=true
export BEARER_TOKEN=short
cd AIlumina/server
bun run src/http-server/index.ts 2>&1 | head -20
# Expected: "SECURITY ERROR: Authentication enabled but no secure bearer token"
# Expected: Exit code 1

# Try with insecure default
export BEARER_TOKEN=ailumina-api-key-12345
bun run src/http-server/index.ts 2>&1 | head -20
# Expected: "SECURITY ERROR: Insecure default bearer token detected"
# Expected: Exit code 1

# Try with valid token
export BEARER_TOKEN=$BEARER_TOKEN
bun run src/http-server/index.ts &
SERVER_PID=$!
sleep 5

# Check server started and shows auth message
# Look for: "✅ Authentication enabled - AI consciousness protected"

# Kill server
kill $SERVER_PID
```

**Expected Results**:
- ✅ Server exits with error for short token
- ✅ Server exits with error for insecure default
- ✅ Server starts successfully with valid token
- ✅ Logs show authentication enabled message

#### Test 2.2: API Authentication
```bash
# Start full stack
cd StoneMonkey
source ../.env.secrets
export AUTH_ENABLED=true
docker-compose up -d

# Wait for services
sleep 30

# Test unauthenticated request (should fail)
curl -v http://localhost:8000/health 2>&1 | grep "401 Unauthorized"
# Expected: 401 Unauthorized

# Test with invalid token (should fail)
curl -H "Authorization: Bearer invalid-token" \
     -v http://localhost:8000/health 2>&1 | grep "401 Unauthorized"
# Expected: 401 Unauthorized

# Test with valid token (should succeed)
curl -H "Authorization: Bearer $BEARER_TOKEN" \
     http://localhost:8000/health
# Expected: 200 OK with health status

# Test MCP endpoints also require auth
curl -v http://localhost:3001/health 2>&1 | grep "401 Unauthorized"
# Expected: 401 Unauthorized (if MCP has auth)

# Cleanup
docker-compose down
```

**Expected Results**:
- ✅ Unauthenticated requests rejected (401)
- ✅ Invalid tokens rejected (401)
- ✅ Valid token grants access (200)
- ✅ MCP endpoints protected

---

### Phase 3: CORS Testing
**Branch**: `claude/secure-cors-config-01VZn3bA5dHKZ2JMdPgaU4Jw`

#### Test 3.1: CORS Startup Validation
```bash
git checkout claude/secure-cors-config-01VZn3bA5dHKZ2JMdPgaU4Jw
# Merge previous branches...

# Test wildcard rejected in production
export NODE_ENV=production
export CORS_ORIGINS="*"
cd AIlumina/server
bun run src/http-server/index.ts 2>&1 | head -20
# Expected: "SECURITY ERROR: CORS wildcard (*) not allowed in production"
# Expected: Exit code 1

# Test wildcard warns in development
export NODE_ENV=development
bun run src/http-server/index.ts &
# Expected: "WARNING: CORS allows ALL origins (development only!)"
kill $!

# Test specific origins
export NODE_ENV=production
export CORS_ORIGINS="https://symagenic.com,https://app.symagenic.com"
bun run src/http-server/index.ts &
# Expected: "🔒 CORS restricted to: https://symagenic.com,https://app.symagenic.com"
kill $!
```

**Expected Results**:
- ✅ Wildcard blocked in production (exits)
- ✅ Wildcard warns in development
- ✅ Specific origins logged correctly

#### Test 3.2: CORS Request Testing
```bash
# Start server with CORS restrictions
cd StoneMonkey
source ../.env.secrets
export CORS_ORIGINS="http://localhost:5173"
docker-compose up -d ailumina-server

sleep 20

# Test request from allowed origin
curl -H "Origin: http://localhost:5173" \
     -H "Authorization: Bearer $BEARER_TOKEN" \
     -v http://localhost:8000/health 2>&1 | grep "Access-Control-Allow-Origin"
# Expected: Access-Control-Allow-Origin: http://localhost:5173

# Test request from disallowed origin
curl -H "Origin: https://evil-site.com" \
     -H "Authorization: Bearer $BEARER_TOKEN" \
     -v http://localhost:8000/health 2>&1 | grep -E "CORS|Origin"
# Expected: Should not have Access-Control-Allow-Origin header or CORS error

# Check logs for blocked origin
docker-compose logs ailumina-server | grep "CORS"
# Expected: Log message about blocked origin

docker-compose down
```

**Expected Results**:
- ✅ Allowed origins get CORS headers
- ✅ Disallowed origins rejected
- ✅ Blocked origins logged

---

### Phase 4: Container Security Testing

#### Test 4.1: Resource Limits
**Branch**: `claude/add-resource-limits-01VZn3bA5dHKZ2JMdPgaU4Jw`

```bash
git checkout claude/add-resource-limits-01VZn3bA5dHKZ2JMdPgaU4Jw

cd StoneMonkey
source ../.env.secrets
docker-compose up -d

# Wait for services
sleep 30

# Check resource limits are applied
docker stats --no-stream

# Verify Neo4j has 4G memory limit
docker inspect stonemonkey-neo4j | jq '.[0].HostConfig.Memory'
# Expected: 4294967296 (4G in bytes)

# Verify Redis has 512M memory limit
docker inspect stonemonkey-redis | jq '.[0].HostConfig.Memory'
# Expected: 536870912 (512M in bytes)

# Verify CPU limits
docker inspect stonemonkey-neo4j | jq '.[0].HostConfig.NanoCpus'
# Expected: 2000000000 (2.0 CPUs)

docker-compose down
```

**Expected Results**:
- ✅ docker stats shows resource limits
- ✅ Memory limits correctly set
- ✅ CPU limits correctly set
- ✅ Services start and run within limits

#### Test 4.2: Non-Root Containers
**Branch**: `claude/non-root-containers-01VZn3bA5dHKZ2JMdPgaU4Jw`

```bash
git checkout claude/non-root-containers-01VZn3bA5dHKZ2JMdPgaU4Jw

cd StoneMonkey
source ../.env.secrets
docker-compose up -d ailumina-server ai-memory-mcp

sleep 20

# Check ailumina-server runs as non-root
docker exec stonemonkey-ailumina-server whoami
# Expected: ailumina (NOT root)

docker exec stonemonkey-ailumina-server id
# Expected: uid=XXX(ailumina) gid=XXX(ailumina)

# Check MCP server runs as non-root
docker exec stonemonkey-memory-mcp whoami
# Expected: mcp or nodejs (NOT root)

# Verify files are owned by non-root user
docker exec stonemonkey-ailumina-server ls -la /app
# Expected: Files owned by ailumina:ailumina

# Try to write to /etc as non-root (should fail)
docker exec stonemonkey-ailumina-server touch /etc/test-file 2>&1 | grep "Permission denied"
# Expected: Permission denied

docker-compose down
```

**Expected Results**:
- ✅ All containers run as non-root users
- ✅ Files owned by correct user
- ✅ Cannot write to protected directories
- ✅ Services function normally

#### Test 4.3: Security Headers
**Branch**: `claude/add-security-headers-01VZn3bA5dHKZ2JMdPgaU4Jw`

```bash
git checkout claude/add-security-headers-01VZn3bA5dHKZ2JMdPgaU4Jw

cd StoneMonkey
source ../.env.secrets
docker-compose up -d ailumina-server

sleep 20

# Test security headers present
curl -I -H "Authorization: Bearer $BEARER_TOKEN" http://localhost:8000/health

# Check for specific headers:
# - Content-Security-Policy
# - Strict-Transport-Security
# - X-Frame-Options
# - X-Content-Type-Options
# - X-XSS-Protection

# Better formatted test
curl -s -D - -H "Authorization: Bearer $BEARER_TOKEN" \
     http://localhost:8000/health | grep -E "Content-Security-Policy|Strict-Transport|X-Frame|X-Content-Type|X-XSS"

# Expected: All security headers present

docker-compose down
```

**Expected Results**:
- ✅ Content-Security-Policy header present
- ✅ Strict-Transport-Security header present
- ✅ X-Frame-Options: DENY present
- ✅ X-Content-Type-Options: nosniff present
- ✅ X-XSS-Protection present

---

### Phase 5: AI Schema Freedom Verification

#### Test 5.1: Dynamic Schema Creation
```bash
# Start full stack with all security enabled
cd StoneMonkey
source ../.env.secrets
docker-compose up -d

sleep 30

# Test AI can create custom labels (not in any whitelist)
docker exec -it stonemonkey-neo4j cypher-shell \
  -u neo4j -p "$NEO4J_PASSWORD" -d neo4j \
  "CREATE (n:CustomThoughtPattern {content: 'Test', timestamp: datetime()}) RETURN n"
# Expected: Success - node created

# Test AI can create custom properties
docker exec -it stonemonkey-neo4j cypher-shell \
  -u neo4j -p "$NEO4J_PASSWORD" -d neo4j \
  "CREATE (n:Observation {myCustomProperty: 'test', anotherOne: 123}) RETURN n"
# Expected: Success - node created with custom properties

# Test AI can create custom relationships
docker exec -it stonemonkey-neo4j cypher-shell \
  -u neo4j -p "$NEO4J_PASSWORD" -d neo4j \
  "MATCH (a:Observation), (b:CustomThoughtPattern)
   CREATE (a)-[:CUSTOM_RELATIONSHIP]->(b)
   RETURN a, b"
# Expected: Success - relationship created

# Verify schema evolved
docker exec -it stonemonkey-neo4j cypher-shell \
  -u neo4j -p "$NEO4J_PASSWORD" -d neo4j \
  "CALL db.labels()"
# Expected: See CustomThoughtPattern and other custom labels

# Verify no errors in logs
docker-compose logs ailumina-server | grep -i "error\|validation failed"
# Expected: No validation errors, no rejections

docker-compose down
```

**Expected Results**:
- ✅ AI can create any label
- ✅ AI can define any property
- ✅ AI can build any relationship
- ✅ No validation errors or rejections
- ✅ Schema evolves freely

---

## Integration Test: Full Stack

### Test 6.1: Complete System Test
```bash
# Merge all branches into test branch
git checkout -b test/all-security-fixes
git merge claude/remove-hardcoded-creds-01VZn3bA5dHKZ2JMdPgaU4Jw
git merge claude/enable-auth-default-01VZn3bA5dHKZ2JMdPgaU4Jw
git merge claude/secure-cors-config-01VZn3bA5dHKZ2JMdPgaU4Jw
git merge claude/add-resource-limits-01VZn3bA5dHKZ2JMdPgaU4Jw
git merge claude/non-root-containers-01VZn3bA5dHKZ2JMdPgaU4Jw
git merge claude/add-security-headers-01VZn3bA5dHKZ2JMdPgaU4Jw

# Generate secrets
./scripts/generate-secrets.sh
source .env.secrets
./scripts/validate-secrets.sh

# Start full platform
cd StoneMonkey
docker-compose up -d

# Wait for all services
sleep 60

# Check all services running
docker-compose ps
# Expected: All services healthy

# Check resource usage
docker stats --no-stream

# Test authentication works
curl -H "Authorization: Bearer $BEARER_TOKEN" http://localhost:8000/health
# Expected: 200 OK

# Test Neo4j accessible with new password
docker exec -it stonemonkey-neo4j cypher-shell \
  -u neo4j -p "$NEO4J_PASSWORD" -d neo4j "RETURN 1"
# Expected: Success

# Test Redis accessible with password
docker exec -it stonemonkey-redis redis-cli -a "$REDIS_PASSWORD" PING
# Expected: PONG

# Test MCP servers accessible
curl -H "Authorization: Bearer $BEARER_TOKEN" http://localhost:3001/health
# Expected: 200 OK (if auth implemented on MCP)

# Check all containers running as non-root
for container in $(docker-compose ps -q); do
  echo "Checking $container:"
  docker exec $container whoami 2>/dev/null || echo "  (can't check)"
done
# Expected: None should return "root"

# Test AI can still create custom schema
docker exec -it stonemonkey-neo4j cypher-shell \
  -u neo4j -p "$NEO4J_PASSWORD" -d neo4j \
  "CREATE (t:TestNode {prop: 'value'}) RETURN t"
# Expected: Success

# Check logs for errors
docker-compose logs | grep -i "error" | grep -v "no error"
# Expected: Minimal or no errors

# Performance check
curl -w "\nTime: %{time_total}s\n" \
     -H "Authorization: Bearer $BEARER_TOKEN" \
     http://localhost:8000/health
# Expected: Response time reasonable (< 1s)

docker-compose down
```

**Expected Results**:
- ✅ All services start successfully
- ✅ All security features working
- ✅ No functionality broken
- ✅ AI retains schema freedom
- ✅ Performance acceptable

---

## Success Criteria

### Must Pass (Blocking Issues)
- [ ] Secrets generate correctly
- [ ] Validation script works
- [ ] Services start with secrets
- [ ] Old passwords rejected
- [ ] Authentication blocks unauthorized requests
- [ ] Valid tokens grant access
- [ ] AI can create custom schema (any labels/properties/relationships)
- [ ] All containers run as non-root
- [ ] No critical errors in logs

### Should Pass (Non-Blocking but Important)
- [ ] CORS blocks disallowed origins
- [ ] Resource limits visible in docker stats
- [ ] Security headers present in responses
- [ ] Startup validation messages clear
- [ ] Performance not degraded

### Nice to Have
- [ ] All warnings clear and helpful
- [ ] Documentation matches implementation
- [ ] Logs clean and informative

---

## Issue Tracking Template

If tests fail, document:

```markdown
### Test Failure: [Test Name]

**Branch**: [branch name]
**Command**: [exact command that failed]

**Expected**:
[what should have happened]

**Actual**:
[what actually happened]

**Logs**:
```
[relevant log output]
```

**Impact**: [CRITICAL / HIGH / MEDIUM / LOW]

**Fix Required**: [yes/no]
**Blocker**: [yes/no]
```

---

## Test Execution Checklist

- [ ] Phase 1: Foundation (Scripts & Credentials)
  - [ ] Test 1.1: Secret Generation
  - [ ] Test 1.2: Validation Script
  - [ ] Test 1.3: Docker Compose with Secrets
- [ ] Phase 2: Authentication
  - [ ] Test 2.1: Server Startup Validation
  - [ ] Test 2.2: API Authentication
- [ ] Phase 3: CORS
  - [ ] Test 3.1: CORS Startup Validation
  - [ ] Test 3.2: CORS Request Testing
- [ ] Phase 4: Container Security
  - [ ] Test 4.1: Resource Limits
  - [ ] Test 4.2: Non-Root Containers
  - [ ] Test 4.3: Security Headers
- [ ] Phase 5: AI Schema Freedom
  - [ ] Test 5.1: Dynamic Schema Creation
- [ ] Phase 6: Integration
  - [ ] Test 6.1: Complete System Test

---

**Ready to begin testing!**
