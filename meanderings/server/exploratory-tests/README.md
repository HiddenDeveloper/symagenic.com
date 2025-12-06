# Exploratory Tests

This directory contains exploratory tests that help us discover and understand the behavior of external systems, APIs, and third-party integrations. These tests serve as living documentation of our research findings.

## 🎯 Purpose

Exploratory tests are designed to:
- **Discover** how external APIs actually behave (vs. documentation)
- **Validate** assumptions about third-party integrations
- **Document** findings for future reference
- **Reduce uncertainty** before implementing production code

## 🔬 Philosophy

> "The map is not the territory" - Alfred Korzybski

API documentation isn't always complete or accurate. Exploratory tests help us create an accurate "map" of the actual system behavior through empirical testing.

## 📋 Guidelines

### When to Create Exploratory Tests

- ✅ **Unclear documentation** - When official docs are ambiguous
- ✅ **New integrations** - First time working with an API/service
- ✅ **Breaking changes** - When external systems update
- ✅ **Complex behavior** - When multiple implementation approaches are possible

### When NOT to Use Exploratory Tests

- ❌ **Well-understood systems** - Use unit/integration tests instead
- ❌ **Internal code** - Your own code should have proper tests
- ❌ **Simple operations** - Don't over-engineer simple tasks

### Best Practices

1. **Time-box investigations** - Limit to 1-2 hours max
2. **Document everything** - Record both successes and failures
3. **Test multiple approaches** - Explore different solutions systematically
4. **Keep tests runnable** - Maintain as executable documentation
5. **Convert learnings** - Transform discoveries into proper tests

## 🗂️ Current Explorations

### Google Gemini API
- **Location**: `google-gemini-api/`
- **Purpose**: Discover correct function response format for Google Gemini
- **Status**: ✅ Complete - Found that Google accepts multiple response formats
- **Key Finding**: Function responses must be objects, not strings

### Anthropic API
- **Location**: `anthropic-api/`
- **Purpose**: Validate tool_result message format for Claude function calling
- **Status**: ✅ Complete - Implementation validated against real API
- **Key Findings**: Standard tool_result format works, strict ID matching enforced

### OpenAI API
- **Location**: `openai-api/`
- **Purpose**: Confirm tool response format for modern vs legacy function calling
- **Status**: ✅ Complete - Modern tools API validated, legacy deprecated
- **Key Findings**: Modern format works, parallel calls supported, strict validation

## 🚀 Running Exploratory Tests

Exploratory tests are **not part of the main test suite** and require manual execution with proper API keys:

### Quick Start

```bash
# Install dependencies
npm install

# View all available commands
npm run help

# Test specific provider
npm run test:gemini      # Requires GOOGLE_API_KEY
npm run test:anthropic   # Requires ANTHROPIC_API_KEY  
npm run test:openai      # Requires OPENAI_API_KEY

# Test all providers
npm run test:all         # Requires all API keys
```

### Individual Exploration

```bash
# Navigate to specific exploration
cd exploratory-tests/google-gemini-api
cd exploratory-tests/anthropic-api
cd exploratory-tests/openai-api

# Follow the README.md instructions in that folder
```

⚠️ **Important**: These tests often require API keys and external service access.

## 📝 Adding New Explorations

When adding a new exploratory test:

1. **Create a new folder** with a descriptive name
2. **Add a README.md** documenting:
   - What you're trying to discover
   - How to run the tests
   - Your findings and conclusions
3. **Include runnable test scripts** that others can execute
4. **Update this main README.md** with a summary

### Template Structure

```
exploratory-tests/
└── your-new-exploration/
    ├── README.md                       # Main documentation
    ├── debug-connection.js             # Basic connectivity test
    ├── validate-current-implementation.js  # Test our implementation
    ├── test-function-formats.js        # Format discovery tests
    └── test-specific-scenarios.js      # Provider-specific edge cases
```

### Environment Variables

Each exploration requires specific API keys:

```bash
# Google Gemini API
export GOOGLE_API_KEY="your-google-api-key"

# Anthropic API  
export ANTHROPIC_API_KEY="your-anthropic-api-key"

# OpenAI API
export OPENAI_API_KEY="your-openai-api-key"
```

## 🏗️ Relationship to Main Test Suite

| Test Type | Purpose | Location | Execution |
|-----------|---------|----------|-----------|
| **Unit Tests** | Verify individual functions | `tests/unit/` | Automated (CI/CD) |
| **Integration Tests** | Test component interaction | `tests/integration/` | Automated (CI/CD) |
| **Exploratory Tests** | Discover external behavior | `exploratory-tests/` | Manual only |

## 📚 Resources

- [Exploratory Testing Guide](https://www.atlassian.com/continuous-delivery/software-testing/exploratory-testing)
- [Spike Testing in Agile](https://en.wikipedia.org/wiki/Spike_(software_development))
- [Learning Tests Pattern](https://martinfowler.com/bliki/LearningTest.html)

---

**Remember**: The goal of exploratory tests is learning and discovery, not ongoing verification. Once you understand how something works, create proper unit/integration tests for ongoing validation.