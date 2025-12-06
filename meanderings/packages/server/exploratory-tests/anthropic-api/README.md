# Anthropic Claude API Function Calling Exploration

This exploration investigates the correct message format for Anthropic Claude tool use and tool result responses to ensure our implementation follows the actual API requirements.

## 🎯 Research Questions

**"What is the exact message structure required for Anthropic Claude tool calling?"**

Key questions to answer:
- What fields are required in `tool_result` blocks?
- How should tool results be structured in content arrays?
- What's the correct message flow for tool_use → tool_result?
- How strict is Anthropic about tool_use_id matching?

## 🔬 Methodology

We use empirical testing against the real Anthropic Claude API to discover actual requirements, testing multiple message structures and formats systematically.

## 📋 Quick Start

### Prerequisites

1. **Get an Anthropic API key**: https://console.anthropic.com/
2. **Set environment variable**:
   ```bash
   export ANTHROPIC_API_KEY="your-api-key-here"
   ```

### Run Tests

```bash
# Test our current implementation
node validate-current-implementation.js

# Comprehensive format testing
node test-function-formats.js

# Debug API connection
node debug-connection.js

# Test tool_use block flow
node test-tool-use-blocks.js
```

## 🏆 Key Discoveries

### ✅ **What Works** (To be validated with real API)

Anthropic Claude expected format:

```javascript
// Tool result message structure
{
  role: 'user',
  content: [
    {
      type: 'tool_result',
      tool_use_id: 'matching_tool_use_id',
      content: 'function_result_string'
    }
  ]
}
```

### ❌ **What Doesn't Work** (To be discovered)

Common pitfalls to test:
- Wrong tool_use_id matching
- Missing content field
- Incorrect message role
- Malformed tool_result blocks

### 📐 **Required Message Structure**

The complete message flow that MUST be followed:

```javascript
// 1. User request
{
  role: 'user',
  content: 'Use the get_weather function to check weather in Tokyo'
}

// 2. Assistant tool_use response
{
  role: 'assistant', 
  content: [
    {
      type: 'tool_use',
      id: 'toolu_123',
      name: 'get_weather',
      input: { location: 'Tokyo' }
    }
  ]
}

// 3. User tool_result response (our implementation)
{
  role: 'user',
  content: [
    {
      type: 'tool_result',
      tool_use_id: 'toolu_123',
      content: 'Weather in Tokyo: Sunny, 25°C'
    }
  ]
}

// 4. Assistant final response
{
  role: 'assistant',
  content: 'The weather in Tokyo is sunny with a temperature of 25°C.'
}
```

## 🧪 Test Files

### `test-function-formats.js`
**Purpose**: Test different tool_result content formats  
**What it tests**: Various ways to structure tool results  
**Key findings**: [To be documented after testing]

### `debug-connection.js`  
**Purpose**: Basic API connectivity and tool calling verification  
**What it tests**: Can we connect to Claude and get tool_use responses?  
**Key findings**: [To be documented after testing]

### `validate-current-implementation.js`
**Purpose**: Quick validation that our current implementation works  
**What it tests**: Our exact format against real API  
**Key findings**: [To be documented after testing]

### `test-tool-use-blocks.js`
**Purpose**: Anthropic-specific tool_use flow testing  
**What it tests**: Complete tool_use → tool_result cycle  
**Key findings**: [To be documented after testing]

## 📊 Test Results Summary

| Format | Structure | Status | Error Message |
|--------|-----------|--------|---------------|
| Standard tool_result | `{type: 'tool_result', tool_use_id: '...', content: '...'}` | ⏳ **Testing** | - |
| Missing tool_use_id | `{type: 'tool_result', content: '...'}` | ⏳ **Testing** | - |
| Wrong tool_use_id | `{type: 'tool_result', tool_use_id: 'wrong', content: '...'}` | ⏳ **Testing** | - |
| Object content | `{type: 'tool_result', tool_use_id: '...', content: {...}}` | ⏳ **Testing** | - |

## 🎉 Impact on Our Implementation

### 🔍 **Our Current Implementation**

```javascript
// src/shared/services/anthropic-provider.ts
formatToolResponseMessage(functionResult: string, toolName: string, toolCallId: string): any {
  return {
    type: 'tool_result',
    tool_use_id: toolCallId,
    content: functionResult
  };
}
```

### ✅ **Validation Status**
- ⏳ **Pending validation** against real Anthropic API
- 🎯 **Expected result**: Our implementation should be correct
- 📝 **Documentation**: Will update based on test results

## 🔄 Complete Message Flow Example

Here's the full conversation flow we're validating:

```javascript
// 1. User request
{ role: 'user', content: 'Get weather for Paris' }

// 2. Assistant tool_use
{ 
  role: 'assistant', 
  content: [
    { 
      type: 'tool_use', 
      id: 'toolu_abc123', 
      name: 'get_weather', 
      input: { location: 'Paris' } 
    }
  ] 
}

// 3. User tool_result (our implementation) ✅
{ 
  role: 'user', 
  content: [
    { 
      type: 'tool_result', 
      tool_use_id: 'toolu_abc123', 
      content: 'Weather in Paris: Cloudy, 18°C' 
    }
  ] 
}

// 4. Assistant final response
{ role: 'assistant', content: 'The weather in Paris is cloudy with 18°C.' }
```

## 🚫 Common Pitfalls to Test

1. **❌ Tool use ID mismatch** - Using wrong or missing tool_use_id
2. **❌ Wrong content structure** - Object vs string content
3. **❌ Missing type field** - Forgetting `type: 'tool_result'`
4. **❌ Wrong message role** - Using `assistant` instead of `user`
5. **❌ Content not in array** - Forgetting to wrap in content array

## 📚 Anthropic API Specifics

Key differences from other providers:
- Uses `tool_use` and `tool_result` blocks
- Requires exact `tool_use_id` matching
- Content must be in array format
- Type field is mandatory

## 🔮 Testing Plan

1. **✅ Basic connectivity** - Verify API access
2. **✅ Tool use generation** - Get Claude to generate tool_use
3. **✅ Format validation** - Test our tool_result format
4. **✅ Error scenarios** - Test malformed requests
5. **✅ Edge cases** - Large responses, special characters

---

**Status**: 🔬 **In Progress** - Tests being developed  
**Confidence**: ⏳ **TBD** - Awaiting test results  
**Next Steps**: 🧪 **Run comprehensive tests** against real API