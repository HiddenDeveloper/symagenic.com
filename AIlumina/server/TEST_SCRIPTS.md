# 🧪 Test Scripts Quick Reference

## 🚀 Most Important Commands

```bash
# Critical bug detection tests (START HERE)
npm run test:roundtrip

# All integration tests (fast, reliable)
npm run test:integration

# Validate specific Gemini fix
npm run test:gemini-fix
```

## 📋 Complete Script Reference

### **Integration Tests** ⭐ (Recommended)
- `npm run test:integration` - All integration tests (mock-only, fast)
- `npm run test:integration:full` - All integration tests + real server
- `npm run test:integration:watch` - Watch mode for integration tests

### **Specific Test Suites**
- `npm run test:roundtrip` - **Format round-trip validation** (critical bug detection)
- `npm run test:websocket` - WebSocket message format validation
- `npm run test:conversations` - Multi-provider conversation flows

### **Targeted Testing**
- `npm run test:gemini-fix` - **Validates Gemini parts array fix**
- `npm run test:providers` - All provider-related tests

### **Other Test Categories**
- `npm run test:unit` - Unit tests (some failing)
- `npm run test:exploratory` - Real API tests (requires keys)
- `npm run test:all` - Integration + Unit tests

### **Standard Testing**
- `npm test` - All tests
- `npm run test:ci` - CI-optimized
- `npm run test:coverage` - With coverage
- `npm run test:watch` - Watch mode

## 🎯 Usage Examples

**Daily Development:**
```bash
npm run test:integration
```

**Bug Fix Verification:**
```bash
npm run test:gemini-fix
```

**Provider Development:**
```bash
npm run test:providers
```

**Watch Mode:**
```bash
npm run test:integration:watch
```

See `TESTING.md` for detailed explanations!