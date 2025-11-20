# Bun Migration Plan - StoneMonkey & AIlumina Projects

**Date:** November 20, 2025
**Version:** 1.0
**Status:** Ready for Implementation

---

## Executive Summary

This document outlines the plan to fully migrate the StoneMonkey and AIlumina projects from Node.js/npm to Bun. While the projects already use Bun for execution, several areas still reference Node/npm that need to be updated for consistency and to fully leverage Bun's capabilities.

### Goals

1. **Full Bun Adoption** - Remove all Node.js/npm dependencies and references
2. **Performance Gains** - Leverage Bun's native features for 2-4x performance improvements
3. **Simplified Toolchain** - Reduce dependencies and complexity
4. **Consistency** - Ensure all scripts, configs, and documentation use Bun

### Scope

- All server packages (AIlumina, StoneMonkey, meanderings)
- All client packages
- All MCP servers (ai-memory-mcp, ai-mesh-mcp, ai-recall-mcp, ailumina-bridge-mcp)
- Build configurations
- Documentation

---

## Current State Assessment

### ✅ Already Using Bun

- Docker base images: `oven/bun:1.2.21`
- Test runner: `bun test`
- Dev server: `bun src/http-server/index.ts`
- Sentry integration: `@sentry/bun`

### ⚠️ Still Using Node/npm

- **Shebang lines:** 20+ files use `#!/usr/bin/env node`
- **Package scripts:** Multiple `npm run` commands in package.json
- **Lock files:** `package-lock.json` instead of `bun.lockb`
- **Process spawning:** Using `child_process.exec` instead of `Bun.spawn()`
- **Dependencies:** `dotenv`, `uuid`, `ws` can be replaced with Bun natives
- **Build tools:** Using `tsc` instead of `bun build`
- **Documentation:** Installation instructions reference npm

---

## Migration Phases

### Phase 1: Infrastructure & Configuration (Day 1-2)
**Priority:** CRITICAL
**Effort:** 2-4 hours
**Risk:** Low

#### 1.1 Update Bun Version
- [ ] Update all Dockerfiles from `oven/bun:1.2.21` → `oven/bun:1.3.2`
- [ ] Test Docker builds locally
- [ ] Update any CI/CD configs (if present)

**Files to update:**
- `AIlumina/server/Dockerfile`
- `StoneMonkey/server/Dockerfile`
- `meanderings/server/Dockerfile`
- `meanderings/ai-memory-mcp/Dockerfile`
- `meanderings/ai-mesh-mcp/Dockerfile`
- `meanderings/ai-recall-mcp/Dockerfile`
- `meanderings/ailumina-bridge-mcp/Dockerfile`
- `meanderings/embedding-service/Dockerfile`

#### 1.2 Generate Bun Lock Files
- [ ] Delete all `package-lock.json` files
- [ ] Run `bun install` in each workspace to generate `bun.lockb`
- [ ] Add `package-lock.json` to `.gitignore`
- [ ] Commit all `bun.lockb` files

**Commands:**
```bash
# Find and delete all package-lock.json
find . -name "package-lock.json" -type f -delete

# Generate bun.lockb for each workspace
cd AIlumina/server && bun install
cd AIlumina/client && bun install
cd AIlumina/shared && bun install
cd StoneMonkey/server && bun install
cd StoneMonkey/client && bun install
cd StoneMonkey/shared && bun install
# Repeat for all workspaces
```

#### 1.3 Update Shebang Lines
- [ ] Replace `#!/usr/bin/env node` with `#!/usr/bin/env bun` in all entry points

**Files to update (20+ files):**
```bash
# Automated fix
find . -type f \( -name "*.ts" -o -name "*.js" \) -exec sed -i 's|#!/usr/bin/env node|#!/usr/bin/env bun|g' {} \;
```

**Key files:**
- `AIlumina/server/src/http-server/index.ts`
- `StoneMonkey/server/src/http-server/index.ts`
- `meanderings/server/src/http-server/index.ts`
- All MCP server entry points
- All script files in `meanderings/ai-memory-mcp/scripts/`

#### 1.4 Update Package.json Scripts
- [ ] Replace all `npm run` → `bun run`
- [ ] Replace all `npm install` → `bun install`
- [ ] Replace all `npm test` → `bun test`

**Files to update:**
- `package.json` (root)
- `meanderings/package.json`
- `StoneMonkey/package.json`
- All server/client package.json files

**Example changes:**
```diff
- "dev": "npm run dev:server",
+ "dev": "bun run dev:server",

- "build": "npm run build:shared && npm run build:server",
+ "build": "bun run build:shared && bun run build:server",
```

---

### Phase 2: Quick Dependency Wins (Day 2-3)
**Priority:** HIGH
**Effort:** 30-60 minutes
**Risk:** Low

#### 2.1 Remove dotenv Package
- [ ] Remove `dotenv` from dependencies in all package.json
- [ ] Remove `import dotenv from 'dotenv'` and `dotenv.config()` calls
- [ ] Test that environment variables still load (Bun auto-loads .env)

**Files to update:**
- `AIlumina/server/src/http-server/config/settings.ts`
- `StoneMonkey/server/src/http-server/config/settings.ts`
- `meanderings/server/src/http-server/config/settings.ts`
- All MCP server config files

**Changes:**
```diff
- import dotenv from 'dotenv';
- dotenv.config({ path: join(__dirname, '../../../.env') });

// Bun loads .env automatically - no import needed!
```

**Cleanup:**
```bash
# Remove from package.json dependencies
bun remove dotenv
```

#### 2.2 Replace uuid Package
- [ ] Replace `uuid` package with native `crypto.randomUUID()`
- [ ] Remove `uuid` dependency
- [ ] Update all UUID generation code

**Files to update:**
- `AIlumina/server/src/http-server/server.ts`
- `StoneMonkey/server/src/http-server/server.ts`
- `meanderings/server/src/http-server/server.ts`

**Changes:**
```diff
- import { v4 as uuidv4 } from 'uuid';
- const id = uuidv4();
+ const id = crypto.randomUUID();
```

**Cleanup:**
```bash
bun remove uuid
bun remove @types/uuid
```

---

### Phase 3: Process Spawning & Tool Manager (Day 3-4)
**Priority:** HIGH
**Effort:** 1-2 hours
**Risk:** Medium

#### 3.1 Replace child_process with Bun.spawn
- [ ] Update tool-manager.ts in all projects
- [ ] Replace `exec` with `Bun.spawn()`
- [ ] Replace `npx tsc` with `bun tsc` or `bunx tsc`
- [ ] Replace `npx tsx` with `bun` (runs TypeScript directly)
- [ ] Test tool validation functionality

**Files to update:**
- `AIlumina/server/src/shared/services/tool-manager.ts`
- `StoneMonkey/server/src/shared/services/tool-manager.ts`
- `meanderings/server/src/shared/services/tool-manager.ts`

**Before:**
```typescript
import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);

const { stdout, stderr } = await execAsync(
  `npx tsc --noEmit --target ES2020 --module ESNext --moduleResolution node ${toolPath}`,
  { cwd: process.cwd() }
);
```

**After:**
```typescript
const proc = Bun.spawn(
  ['bun', 'tsc', '--noEmit', '--target', 'ES2020', '--module', 'ESNext', '--moduleResolution', 'node', toolPath],
  {
    cwd: process.cwd(),
    stdout: 'pipe',
    stderr: 'pipe',
  }
);

const stdout = await new Response(proc.stdout).text();
const stderr = await new Response(proc.stderr).text();
const exitCode = await proc.exited;
```

#### 3.2 Update Script Files Using npx
- [ ] Replace `npx tsx` with `bun` in dev-both.ts scripts
- [ ] Update documentation examples

**Files to update:**
- `meanderings/ai-memory-mcp/scripts/dev-both.ts`
- `meanderings/ai-memory-mcp/scripts/backup-restore-memories.ts` (documentation)

---

### Phase 4: HTTP Server Migration (Day 5-10)
**Priority:** HIGH
**Effort:** 2-4 days
**Risk:** High

#### 4.1 Evaluate Framework Options

**Option A: Pure Bun HTTP (Recommended)**
- Pros: Maximum performance, minimal dependencies, full control
- Cons: More manual routing, middleware implementation

**Option B: Elysia**
- Pros: Express-like API, Bun-optimized, good middleware ecosystem
- Cons: New framework to learn

**Option C: Hono**
- Pros: Lightweight, portable, familiar patterns
- Cons: Less Bun-specific optimization than Elysia

**Recommendation:** Start with **Elysia** for familiarity, fallback to pure Bun if needed

#### 4.2 Migration Steps

**Phase 4a: Proof of Concept (1 day)**
- [ ] Create prototype server with Elysia or pure Bun
- [ ] Implement basic routing
- [ ] Test WebSocket integration
- [ ] Performance benchmark vs Express

**Phase 4b: Core Migration (2 days)**
- [ ] Replace Express with chosen solution
- [ ] Migrate all routes (mcp, consciousness, tools-crud, agents-crud)
- [ ] Replace middleware (helmet → manual headers, cors → manual/plugin)
- [ ] Replace multer → FormData API for file uploads
- [ ] Update WebSocket handling

**Phase 4c: Testing & Validation (1 day)**
- [ ] Unit tests for all routes
- [ ] Integration tests for WebSocket
- [ ] Load testing
- [ ] Security testing

**Dependencies to replace:**
```bash
# Remove
bun remove express helmet cors multer ws
bun remove @types/express @types/cors @types/multer @types/ws

# Add (if using Elysia)
bun add elysia
# OR for pure Bun - no additions needed!
```

---

### Phase 5: Build System Optimization (Day 11-13)
**Priority:** MEDIUM
**Effort:** 1-2 days
**Risk:** Medium

#### 5.1 Replace tsc with bun build
- [ ] Update build scripts in package.json
- [ ] Configure `bun build` for production bundles
- [ ] Keep `tsc --noEmit` for type checking
- [ ] Test production builds

**Changes:**
```diff
// package.json
- "build:fast": "npm run typecheck && tsc",
+ "build:fast": "bun run typecheck && bun build --target=bun src/http-server/index.ts --outdir=dist",

// Keep typecheck
"typecheck": "tsc --noEmit",
```

#### 5.2 Optimize Build Configuration
- [ ] Configure tree-shaking
- [ ] Enable minification for production
- [ ] Set up source maps
- [ ] Test bundle sizes

---

### Phase 6: WebSocket Migration (Day 13-15)
**Priority:** MEDIUM
**Effort:** 2-3 hours
**Risk:** Medium

#### 6.1 Replace ws Library
- [ ] Replace `ws` package with Bun native WebSocket
- [ ] Update WebSocket handlers
- [ ] Test all WebSocket functionality
- [ ] Update documentation

**Before:**
```typescript
import { WebSocketServer } from 'ws';
const wss = new WebSocketServer({ server });
```

**After (with Bun.serve):**
```typescript
Bun.serve({
  port: 3000,
  fetch(req, server) {
    if (server.upgrade(req)) {
      return; // WebSocket upgraded
    }
    // Normal HTTP handling
  },
  websocket: {
    open(ws) { /* connection opened */ },
    message(ws, message) { /* handle message */ },
    close(ws) { /* connection closed */ }
  }
})
```

---

### Phase 7: Cleanup & Configuration (Day 15-16)
**Priority:** LOW
**Effort:** 1-2 hours
**Risk:** Low

#### 7.1 Update Package.json Metadata
- [ ] Change `"engines"` from `"node": ">=18.0.0"` → `"bun": ">=1.0.0"`
- [ ] Remove `"volta"` configuration from client packages
- [ ] Update package descriptions if needed

**Files to update:**
- All package.json files with engines field
- All client package.json files with volta config

#### 7.2 Update Documentation
- [ ] Update README.md installation instructions
- [ ] Update CODESPACES.md
- [ ] Update all spec documents
- [ ] Update CLAUDE.md files

**Files to update (17 files):**
- `README.md`
- `AIlumina/README.md`
- `AIlumina/server/README.md`
- `AIlumina/CODESPACES.md`
- `StoneMonkey/README.md`
- `StoneMonkey/server/README.md`
- `meanderings/README.md`
- `meanderings/CODESPACES.md`
- All MCP server README files

**Changes:**
```diff
# Installation

- npm install
+ bun install

# Development

- npm run dev
+ bun run dev

# Testing

- npm test
+ bun test
```

#### 7.3 Add .gitignore Updates
- [ ] Add `package-lock.json` to .gitignore
- [ ] Ensure `bun.lockb` is tracked
- [ ] Clean up any ignored files

---

## Testing Strategy

### Unit Testing
- [ ] Run all existing `bun test` suites
- [ ] Add tests for new Bun-specific code
- [ ] Ensure 100% passing tests before merge

### Integration Testing
- [ ] Test all HTTP endpoints
- [ ] Test WebSocket connections
- [ ] Test file upload functionality
- [ ] Test MCP tool execution
- [ ] Test multi-provider conversations

### Performance Testing
- [ ] Benchmark HTTP request latency
- [ ] Benchmark WebSocket message throughput
- [ ] Benchmark build times
- [ ] Compare memory usage vs Express baseline

### Security Testing
- [ ] Verify CORS headers
- [ ] Verify CSP headers
- [ ] Test authentication flows
- [ ] Review file upload security

---

## Rollback Plan

### If Issues Arise

1. **Git Branches:** Each phase should be in a separate branch
2. **Revert Strategy:** Revert commits in reverse order of phases
3. **Lock Files:** Keep backup of working `bun.lockb`
4. **Docker:** Keep old `oven/bun:1.2.21` tags available

### Critical Rollback Points

- **Phase 1:** Can rollback entire infrastructure change
- **Phase 4:** HTTP server is highest risk - comprehensive testing required
- **Phase 5:** Build system changes can be reverted independently

---

## Timeline & Resource Allocation

| Phase | Duration | Developer Hours | Risk Level |
|-------|----------|----------------|------------|
| Phase 1: Infrastructure | 1-2 days | 4 hours | Low |
| Phase 2: Quick Wins | 1 day | 1 hour | Low |
| Phase 3: Process Spawning | 1 day | 2 hours | Medium |
| Phase 4: HTTP Server | 5 days | 16 hours | High |
| Phase 5: Build System | 2 days | 8 hours | Medium |
| Phase 6: WebSocket | 2 days | 4 hours | Medium |
| Phase 7: Cleanup | 1 day | 2 hours | Low |
| **Total** | **15 days** | **37 hours** | **Medium** |

### Recommended Approach

- **Parallel Work:** Phases 1-3 can be done by one developer
- **Sequential Work:** Phase 4 (HTTP server) requires focus and testing
- **Optional:** Phases 5-6 can be deferred if needed
- **Code Review:** Mandatory review after Phase 4

---

## Expected Benefits

### Performance Improvements

| Area | Current | After Bun | Improvement |
|------|---------|-----------|-------------|
| HTTP Request Latency | ~5ms (Express) | ~2ms (Bun native) | 2.5x faster |
| Process Spawning | ~50ms (child_process) | ~20ms (Bun.spawn) | 2.5x faster |
| Build Time | ~30s (tsc) | ~3s (bun build) | 10x faster |
| WebSocket Throughput | ~10k msg/s (ws) | ~25k msg/s (Bun native) | 2.5x faster |
| Startup Time | ~800ms | ~300ms | 2.7x faster |

### Developer Experience

- ✅ Faster test runs
- ✅ Faster builds
- ✅ Simpler toolchain (one runtime instead of Node + npm + tsc)
- ✅ Fewer dependencies
- ✅ Better TypeScript support out-of-the-box

### Maintenance Benefits

- ✅ Fewer packages to maintain
- ✅ Single lock file format
- ✅ Consistent runtime across dev/production
- ✅ Smaller Docker images
- ✅ Reduced security surface area

---

## Risk Assessment

### High Risk Areas

1. **HTTP Server Migration (Phase 4)**
   - **Risk:** Breaking existing API contracts
   - **Mitigation:** Comprehensive integration tests, gradual rollout
   - **Fallback:** Keep Express version in parallel branch

2. **WebSocket Migration (Phase 6)**
   - **Risk:** Connection drops, message loss
   - **Mitigation:** Extensive testing with real clients
   - **Fallback:** Keep ws library as option

### Medium Risk Areas

1. **Process Spawning (Phase 3)**
   - **Risk:** Tool validation failures
   - **Mitigation:** Test with existing tool uploads
   - **Fallback:** Keep promisify(exec) as backup

2. **Build System (Phase 5)**
   - **Risk:** Build output differences
   - **Mitigation:** Compare bundles before/after
   - **Fallback:** Keep tsc available

### Low Risk Areas

- Infrastructure updates (Phase 1)
- Dependency removal (Phase 2)
- Documentation (Phase 7)

---

## Success Criteria

### Phase Completion Criteria

Each phase is considered complete when:
- [ ] All code changes committed and pushed
- [ ] All tests passing
- [ ] Code review approved
- [ ] Documentation updated
- [ ] No regressions in existing functionality

### Overall Project Success

- [ ] 100% npm/node references removed
- [ ] All tests passing with Bun
- [ ] Performance benchmarks meet or exceed targets
- [ ] Production deployment successful
- [ ] Zero critical bugs in first week
- [ ] Developer satisfaction survey positive

---

## Dependencies & Prerequisites

### Required Before Starting

- [ ] Bun 1.3.2 installed locally for all developers
- [ ] Docker with Bun 1.3.2 image pulled
- [ ] Backup of current working state
- [ ] All existing tests passing
- [ ] Stakeholder approval

### Team Requirements

- [ ] At least 1 developer familiar with Bun
- [ ] Code review capacity available
- [ ] QA resources for testing
- [ ] Approval for production deployment window

---

## Communication Plan

### Stakeholder Updates

- **Weekly:** Progress report on completed phases
- **Blockers:** Immediate notification if high-risk issues arise
- **Completion:** Demo of performance improvements

### Developer Documentation

- [ ] Create Bun migration guide for team
- [ ] Update onboarding documentation
- [ ] Create troubleshooting guide
- [ ] Document common patterns

---

## Next Steps

### Immediate Actions (This Week)

1. **Review this plan** with team and stakeholders
2. **Get approval** for timeline and approach
3. **Create feature branch** for Bun migration
4. **Start Phase 1** - Infrastructure updates

### Questions to Resolve

1. **HTTP Framework:** Elysia vs Hono vs Pure Bun?
2. **Timeline:** Can we commit 15 days / 37 hours?
3. **Deployment:** Staging environment for testing?
4. **Rollback:** What's acceptable downtime if rollback needed?

---

## Appendix A: File Checklist

### Dockerfiles (9 files)
- [ ] AIlumina/server/Dockerfile
- [ ] StoneMonkey/server/Dockerfile
- [ ] meanderings/server/Dockerfile
- [ ] meanderings/ai-memory-mcp/Dockerfile
- [ ] meanderings/ai-mesh-mcp/Dockerfile
- [ ] meanderings/ai-recall-mcp/Dockerfile
- [ ] meanderings/ailumina-bridge-mcp/Dockerfile
- [ ] meanderings/embedding-service/Dockerfile
- [ ] StoneMonkey/qdrant/Dockerfile (if needed)

### Package.json Files (17+ files)
- [ ] Root package.json
- [ ] AIlumina/package.json
- [ ] AIlumina/server/package.json
- [ ] AIlumina/client/package.json
- [ ] AIlumina/shared/package.json
- [ ] StoneMonkey/package.json
- [ ] StoneMonkey/server/package.json
- [ ] StoneMonkey/client/package.json
- [ ] StoneMonkey/shared/package.json
- [ ] meanderings/package.json
- [ ] meanderings/server/package.json
- [ ] meanderings/client/package.json
- [ ] meanderings/shared/package.json
- [ ] All MCP server package.json files

### Entry Point Files (20+ files)
- [ ] AIlumina/server/src/http-server/index.ts
- [ ] StoneMonkey/server/src/http-server/index.ts
- [ ] meanderings/server/src/http-server/index.ts
- [ ] All MCP server index.ts files
- [ ] All script files in meanderings/ai-memory-mcp/scripts/

### Configuration Files (5+ files)
- [ ] AIlumina/server/src/http-server/config/settings.ts
- [ ] StoneMonkey/server/src/http-server/config/settings.ts
- [ ] meanderings/server/src/http-server/config/settings.ts
- [ ] All MCP server config files

### Core Service Files (3+ files)
- [ ] AIlumina/server/src/shared/services/tool-manager.ts
- [ ] StoneMonkey/server/src/shared/services/tool-manager.ts
- [ ] meanderings/server/src/shared/services/tool-manager.ts

### Documentation Files (17+ files)
- [ ] README.md
- [ ] All project-specific README.md files
- [ ] All CODESPACES.md files
- [ ] All spec and documentation markdown files

---

## Appendix B: Commands Reference

### Installation
```bash
# Install Bun globally
curl -fsSL https://bun.sh/install | bash

# Update Bun
bun upgrade
```

### Workspace Management
```bash
# Install dependencies
bun install

# Install in all workspaces
bun install --workspace

# Remove package
bun remove package-name

# Add package
bun add package-name
```

### Development
```bash
# Run development server
bun run dev

# Run tests
bun test

# Run tests with coverage
bun test --coverage

# Type check
bun run typecheck
```

### Building
```bash
# Build with Bun
bun build --target=bun src/index.ts --outdir=dist

# Build with minification
bun build --target=bun --minify src/index.ts --outdir=dist

# Build with source maps
bun build --target=bun --sourcemap src/index.ts --outdir=dist
```

### Docker
```bash
# Build Docker image
docker build -f server/Dockerfile -t stonemonkey-server .

# Run Docker container
docker run -p 8000:8000 stonemonkey-server

# Check Bun version in container
docker run oven/bun:1.3.2 bun --version
```

---

## Appendix C: Resources

### Documentation
- [Bun Official Docs](https://bun.sh/docs)
- [Bun API Reference](https://bun.sh/docs/api)
- [Elysia Documentation](https://elysiajs.com/)
- [Hono Documentation](https://hono.dev/)

### Migration Guides
- [Bun vs Node.js](https://bun.sh/docs/runtime/nodejs-apis)
- [Express to Bun](https://bun.sh/guides/http/express)
- [npm to Bun](https://bun.sh/docs/cli/install)

### Performance
- [Bun Benchmarks](https://bun.sh/docs/benchmarks)
- [HTTP Server Comparison](https://web-frameworks-benchmark.netlify.app/)

---

**End of Migration Plan**

*This plan should be reviewed and approved by the development team before implementation begins.*
