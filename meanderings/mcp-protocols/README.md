# MCP Remote Server - Production System

Production-ready dual-transport MCP server with clean separation of concerns.

## Architecture

This is the stable, production version of the MCP remote server extracted from experimental development. It provides:

**HTTP Server** (`src/http-server/`): Stateless REST/JSON-RPC API for web clients
**STDIO Wrapper** (`src/stdio-wrapper/`): MCP-compliant proxy with bidirectional sampling capability  
**Shared Logic** (`src/shared/`): Tools and resources implemented once, used by both transports

## Critical Service Dependencies

⚠️ **IMPORTANT: The HTTP Server MUST be running before any MCP transport can work.**

**Dependency Chain:**
1. `HTTP Server` (port 3000) - Core service providing all MCP functionality
2. `STDIO Wrapper` - Depends on HTTP Server being available
3. `MCP Clients` (VS Code/Claude Desktop) - Connect to either transport

## Development Commands

```bash
bun run dev:http    # Start HTTP server only (port 3000)
bun run dev:stdio   # Start STDIO wrapper only
bun run dev:both    # Start both services
bun run build       # Build TypeScript
bun run typecheck   # Type checking without emit
bun run clean       # Clean build artifacts
```

## Available Tools

- **calculator**: Basic arithmetic operations with sampling triggers
- **echo**: Message echo utility
- **time**: Current time information
- **weather**: Weather information service (requires API key)

## Available Resources

- **server-info**: Server configuration and capability information
- **server-status**: Current server health and status

## Sampling Feature

- Only works with STDIO transport (bidirectional communication required)
- Triggered by calculator results > threshold (default: 100)
- Generates creative poems about calculation results

## Production Status

This system is extracted from research experiments and represents a stable, working implementation of:
- Dual-transport MCP architecture
- Clean separation of concerns
- Robust error handling
- Comprehensive tool/resource system

## Relationship to Research

This production system serves as:
- **Baseline**: Known-good implementation for comparison
- **Foundation**: Stable base for experimental extensions
- **Reference**: Working example of MCP best practices

New experimental features are developed in the research workspace and only merged here after validation.

## Migration Notes

This system was migrated from root-level development to production-systems/ as part of establishing a systematic research workspace. All functionality remains identical to the original implementation.