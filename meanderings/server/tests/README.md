# Unified Integration Test Suite

This directory contains a comprehensive testing ecosystem that bridges UI and server testing to ensure robust message format compatibility across the entire AIlumina platform.

## 🎯 Overview

The unified integration test suite validates the complete message flow:
**Server WebSocket → UI Processing → Chat History → API Call Replay**

This ensures that messages sent over WebSocket can be safely replayed as API calls without format errors like "Name cannot be empty".

## 📁 Test Structure

### Shared Infrastructure (`tests/shared/`)

**`message-format-fixtures.ts`**
- Standardized WebSocket message fixtures for all providers
- Chat history format expectations
- Integration scenario definitions
- Message validation utilities

**`websocket-integration-utils.ts`**
- WebSocket client for real server integration testing
- Server instance management for testing
- Message flow validators
- Integration test runner framework

### Integration Tests (`tests/integration/`)

**`websocket-message-formats.test.ts`**
- Provider-specific WebSocket message format validation
- Empty content tool call scenarios
- Cross-provider compatibility testing
- Real server integration tests (when available)

**`format-round-trip-validation.test.ts`**
- Complete message round-trip simulation
- UI message processing simulation
- API call compatibility validation
- **Critical test for the Gemini parts array bug fix**

**`multi-provider-conversation-flows.test.ts`**
- Complex multi-provider conversation scenarios
- Provider switching validation
- Real-world conversation pattern testing
- Format consistency across provider switches

### Existing Test Infrastructure

**`tests/fixtures/`**
- Provider API response mocks
- WebSocket mock utilities
- Test data and scenarios

**`tests/unit/`**
- Individual provider testing (currently skipped, needs fixing)
- Cross-provider validation
- Tool registry consistency

**`tests/exploratory/`**
- Real API integration tests
- Provider-specific behavior validation

## 🧪 Key Test Categories

### 1. Format Validation Tests
**Purpose**: Ensure each provider sends correct WebSocket message formats

**OpenAI Format**: `{ role: "assistant", content: "text", tool_calls: [...] }`  
**Anthropic Format**: `{ role: "assistant", content: [{ type: "text", text: "..." }, { type: "tool_use", ... }] }`  
**Gemini Format**: `{ role: "model", parts: [{ text: "..." }, { functionCall: {...} }] }`

### 2. Round-Trip Validation Tests
**Purpose**: Validate WebSocket → UI → API call compatibility

These tests simulate the complete flow:
1. Server sends WebSocket message
2. UI processes message (adds to chat history)
3. Chat history is replayed in API call
4. Validate no format errors occur

**Critical**: These tests would have caught the Gemini "Name cannot be empty" bug immediately.

### 3. Multi-Provider Conversation Tests
**Purpose**: Validate complex conversation scenarios

- Provider switching mid-conversation
- Mixed content and tool call messages
- Error recovery across providers
- Real-world conversation patterns

### 4. Cross-Provider Compatibility Tests
**Purpose**: Ensure providers can coexist in same conversation

- Message format consistency
- Tool call format validation
- Chat history compatibility

## 🚀 Running Tests

### Run All Integration Tests
```bash
npm test tests/integration/
```

### Run Specific Test Suites
```bash
# WebSocket message format validation
npm test tests/integration/websocket-message-formats.test.ts

# Round-trip validation (critical for bug detection)
npm test tests/integration/format-round-trip-validation.test.ts

# Multi-provider conversation flows
npm test tests/integration/multi-provider-conversation-flows.test.ts
```

### Run with Real Server Integration
```bash
# Remove the flag to enable real server tests
npm test tests/integration/websocket-message-formats.test.ts
```

### Skip Integration Tests
```bash
NO_INTEGRATION_TESTS=1 npm test tests/integration/
```

## 🔍 Critical Bug Detection

### The Gemini Parts Array Bug
**Problem**: Gemini provider was sending `{"role": "model", "parts": []}` instead of including function calls in the parts array.

**Detection**: The round-trip validation tests specifically catch this:
1. Server sends WebSocket message with tool calls
2. UI processes message (expects parts array with function calls)
3. Chat history replay fails with "Name cannot be empty"

**Tests**: `format-round-trip-validation.test.ts` → "validates Gemini tool call message round-trip (THE CRITICAL TEST)"

### Empty Content Tool Calls
**Problem**: Tool calls with empty content could cause format issues.

**Detection**: Tests validate that tool calls work correctly even when `content` is empty.

**Tests**: All test suites include empty content scenarios for each provider.

## 📊 Test Coverage

### Message Format Coverage
- ✅ OpenAI: `tool_calls` array format
- ✅ Anthropic: `content` blocks array format  
- ✅ Gemini: `parts` array format with `functionCall` objects

### Scenario Coverage
- ✅ Text-only messages
- ✅ Tool call messages
- ✅ Empty content tool calls
- ✅ Mixed content and tool calls
- ✅ Provider switching
- ✅ Error recovery
- ✅ Real-world conversation patterns

### Validation Coverage
- ✅ WebSocket message format validation
- ✅ Chat history format validation
- ✅ API call compatibility validation
- ✅ Cross-provider compatibility
- ✅ Message flow validation

## 🛠️ Adding New Tests

### For New Providers
1. Add provider fixtures to `message-format-fixtures.ts`
2. Add provider validation to `MESSAGE_VALIDATION_UTILS`
3. Add provider scenarios to all integration test suites

### For New Message Types
1. Add message fixtures for all providers
2. Add validation logic to utilities
3. Add round-trip validation tests
4. Add cross-provider compatibility tests

### For New Integration Scenarios
1. Add scenario to `INTEGRATION_SCENARIOS`
2. Create test in appropriate integration test file
3. Add flow validation if needed

## 🎯 Benefits

### Immediate Bug Detection
- Format compatibility issues caught before production
- Cross-provider compatibility validated
- API call replay issues detected early

### Comprehensive Coverage
- All provider formats tested
- All message types validated
- All conversation patterns covered

### Maintainable Testing
- Shared fixtures reduce duplication
- Reusable validation utilities
- Clear test organization

### Future-Proof Design
- Easy to add new providers
- Extensible for new message types
- Scalable for complex scenarios

## 🔬 Test Philosophy

**Integration Over Isolation**: While unit tests validate individual components, integration tests validate the complete system working together.

**Real-World Scenarios**: Tests simulate actual user conversations, not just technical edge cases.

**Format Preservation**: Critical focus on ensuring message formats are preserved correctly through the entire flow.

**Bug Prevention**: Tests are designed to catch the types of bugs that actually occur in production.

---

This unified test suite represents the most comprehensive AI provider testing ecosystem possible, ensuring robust compatibility between UI and server components while catching critical bugs before they reach production.