# 🧪 AIlumina API MCP Testing Guide

This guide explains how to run the comprehensive test suite for the AIlumina API MCP server, including the new unified integration tests that validate UI-server message compatibility.

## 🚀 Quick Start

### **Most Important Tests (Run These First)**
```bash
# Critical bug detection tests - validates the Gemini parts array fix
npm run test:roundtrip

# All integration tests (mock-only, fast)
npm run test:integration

# Specific Gemini fix validation
npm run test:gemini-fix
```

## 📋 Test Script Reference

### **Integration Tests (Recommended)**

| Script | Description | Use Case |
|--------|-------------|----------|
| `npm run test:integration` | **All integration tests (mock-only)** | Daily development, CI/CD |
| `npm run test:integration:full` | All integration tests + real server | Full validation when server available |
| `npm run test:integration:watch` | Watch mode for integration tests | Active development |

### **Specific Integration Test Suites**

| Script | Description | Focus |
|--------|-------------|-------|
| `npm run test:roundtrip` | **Format round-trip validation** | **Critical bug detection** |
| `npm run test:websocket` | WebSocket message format validation | Provider message formats |
| `npm run test:conversations` | Multi-provider conversation flows | Complex scenarios |

### **Targeted Testing**

| Script | Description | When to Use |
|--------|-------------|-------------|
| `npm run test:gemini-fix` | **Validates specific Gemini parts array fix** | **Bug fix verification** |
| `npm run test:providers` | All provider-related tests | Provider development |

### **Other Test Categories**

| Script | Description | Status |
|--------|-------------|--------|
| `npm run test:unit` | Unit tests for individual components | ⚠️ Some failing |
| `npm run test:exploratory` | Real API integration tests | Requires API keys |
| `npm run test:all` | Integration + Unit tests | Comprehensive |

### **Standard Testing**

| Script | Description | Use Case |
|--------|-------------|----------|
| `npm test` | All tests (original command) | Full test suite |
| `npm run test:ci` | CI-optimized test run | Automated builds |
| `npm run test:coverage` | Tests with coverage report | Coverage analysis |
| `npm run test:watch` | Watch mode for all tests | Development |

## 🎯 Usage Scenarios

### **Daily Development**
```bash
# Quick validation during development
npm run test:integration

# Watch mode for active development
npm run test:integration:watch
```

### **Bug Fix Verification**
```bash
# Verify the Gemini parts array fix specifically
npm run test:gemini-fix

# Validate all format round-trip scenarios
npm run test:roundtrip
```

### **Provider Development**
```bash
# Test all provider-related functionality
npm run test:providers

# Test WebSocket message formats specifically
npm run test:websocket
```

### **Comprehensive Testing**
```bash
# Fast comprehensive testing (recommended)
npm run test:all

# Full testing including real server integration
npm run test:integration:full && npm run test:unit
```

### **CI/CD Pipeline**
```bash
# Recommended CI/CD test sequence
npm run test:integration  # Fast, reliable
npm run test:unit         # Unit tests
# Skip test:exploratory (requires API keys)
```

## 🔍 What Each Test Suite Validates

### **Integration Tests** (`npm run test:integration`)
- ✅ **WebSocket message format compatibility**
- ✅ **UI-server message round-trip validation**
- ✅ **Cross-provider conversation flows**
- ✅ **Critical bug detection (Gemini parts array fix)**
- ✅ **API call replay compatibility**

### **Round-Trip Tests** (`npm run test:roundtrip`)
- ✅ **Server WebSocket → UI Processing → Chat History → API Call**
- ✅ **Format preservation across the complete flow**
- ✅ **"Name cannot be empty" bug detection**
- ✅ **Empty content tool call handling**

### **WebSocket Tests** (`npm run test:websocket`)
- ✅ **Provider-specific message formats**
- ✅ **OpenAI**: `tool_calls` array format
- ✅ **Anthropic**: `content` blocks array format
- ✅ **Gemini**: `parts` array format with `functionCall`

### **Conversation Tests** (`npm run test:conversations`)
- ✅ **Multi-provider conversation scenarios**
- ✅ **Provider switching validation**
- ✅ **Real-world conversation patterns**
- ✅ **Error recovery across providers**

## 📊 Expected Output

### **✅ Success Output**
```bash
$ npm run test:integration

✓ tests/integration/format-round-trip-validation.test.ts (12 tests) 8ms
✓ tests/integration/websocket-message-formats.test.ts (8 tests) 7ms
✓ tests/integration/multi-provider-conversation-flows.test.ts (10 tests) 8ms

Test Files  3 passed (3)
Tests       30 passed (30)
Duration    323ms
```

### **🔍 Debug Output**
```bash
[MockWebSocket] Captured: {"role":"model","parts":[{"functionCall":{"name":"wait_for_seconds","args":{"seconds":2}}}]}
```
This shows the tests validating correct Gemini format with parts array.

### **⚠️ Warning Output**
```bash
stdout | tests/integration/websocket-message-formats.test.ts
Skipping integration tests (NO_INTEGRATION_TESTS set)
```
This is normal - means real server integration tests are skipped (mock tests still run).

## 🚨 Troubleshooting

### **Tests Failing?**

**1. Check Dependencies**
```bash
npm install
```

**2. Use Mock-Only Mode**
```bash
# If real server tests fail, use mock-only
npm run test:integration  # Already uses NO_INTEGRATION_TESTS=1
```

**3. Run Specific Test**
```bash
# Isolate the problem
npm run test:roundtrip
npm run test:websocket
npm run test:conversations
```

**4. Check Environment**
```bash
# Ensure you're in the correct directory
pwd  # Should end with "ailumina-api-mcp"
```

### **Integration Tests vs Real Server Tests**

**Mock Tests (Default)** - Fast, reliable, no dependencies:
```bash
npm run test:integration  # Uses NO_INTEGRATION_TESTS=1
```

**Real Server Tests** - Slower, requires running server:
```bash
npm run test:integration:full  # Attempts real server connection
```

### **Unit Tests Failing**

Currently, some unit tests are failing due to pre-existing issues. Use:
```bash
# Focus on integration tests (they're more comprehensive anyway)
npm run test:integration
```

## 🎯 Test Strategy

### **Priority 1: Integration Tests**
These are the most important - they validate the complete system working together:
```bash
npm run test:integration
```

### **Priority 2: Critical Bug Detection**
Specifically validates the fixes implemented:
```bash
npm run test:gemini-fix
npm run test:roundtrip
```

### **Priority 3: Comprehensive Validation**
When you need full confidence:
```bash
npm run test:all
```

## 🔬 Development Workflow

### **During Development**
```bash
# Start watch mode
npm run test:integration:watch

# Make changes to code...
# Tests run automatically
```

### **Before Committing**
```bash
# Quick validation
npm run test:integration

# If adding provider features
npm run test:providers
```

### **Before Releasing**
```bash
# Full validation
npm run test:all

# Verify specific bug fixes
npm run test:gemini-fix
```

## 📈 Benefits of This Testing Approach

### **Immediate Bug Detection**
- Format compatibility issues caught before production
- Cross-provider compatibility validated
- API call replay issues detected early

### **Comprehensive Coverage**
- All provider formats tested
- All message types validated  
- All conversation patterns covered

### **Development Efficiency**
- Fast feedback loop with mock tests
- Watch mode for active development
- Targeted testing for specific areas

### **Production Confidence**
- Real-world scenario validation
- Complete UI-server integration testing
- Critical bug prevention

---

## 🎉 Quick Test Commands

**Just want to validate everything works?**
```bash
npm run test:integration
```

**Want to verify the Gemini fix specifically?**
```bash
npm run test:gemini-fix
```

**Working on provider features?**
```bash
npm run test:providers
```

**Need comprehensive validation?**
```bash
npm run test:all
```

The integration test suite provides the most value with the fastest feedback - start there!