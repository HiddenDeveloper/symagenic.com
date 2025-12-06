#!/bin/bash
# Docker entrypoint for AIlumina server
# Copies Claude Code OAuth credentials from read-only mount to writable directory

set -e

# Copy Claude Code credentials from mounted directory if available
if [ -f /claude/.credentials.json ]; then
  echo "📋 Copying Claude Code OAuth credentials to writable directory..."
  cp /claude/.credentials.json /app/.claude/.credentials.json
  chmod 600 /app/.claude/.credentials.json
  echo "✅ Claude Code credentials ready (OAuth subscription mode)"
else
  echo "⚠️  No Claude Code credentials found at /claude/.credentials.json"
fi

# Copy Codex credentials from mounted directory if available
if [ -f /codex/auth.json ]; then
  echo "📋 Copying Codex OAuth credentials to writable directory..."
  cp /codex/auth.json /app/.codex/auth.json
  chmod 600 /app/.codex/auth.json
  echo "✅ Codex credentials ready (OAuth via ChatGPT Plus subscription)"
else
  echo "⚠️  No Codex credentials found at /codex/auth.json"
fi

# Copy Gemini credentials from mounted directory if available
if [ -f /gemini/oauth_creds.json ] && [ -f /gemini/settings.json ]; then
  echo "📋 Copying Gemini OAuth credentials to writable directory..."
  cp /gemini/oauth_creds.json /app/.gemini/oauth_creds.json
  cp /gemini/settings.json /app/.gemini/settings.json
  chmod 600 /app/.gemini/oauth_creds.json
  chmod 600 /app/.gemini/settings.json
  echo "✅ Gemini credentials ready (OAuth via Google Cloud)"
else
  echo "⚠️  No Gemini credentials found at /gemini/"
fi

# Start the server
echo "🚀 Starting AIlumina server..."
exec bun run src/http-server/index.ts
