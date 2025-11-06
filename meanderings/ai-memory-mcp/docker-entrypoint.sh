#!/bin/bash
# docker-entrypoint.sh - Setup cron and start AI Memory MCP services
#
# This script:
# 1. Configures cron jobs for autonomous memory curation
# 2. Starts the cron daemon
# 3. Executes the main container command (HTTP server)

set -e

echo "🧠 ================================================"
echo "🧠 AI MEMORY MCP - Container Initialization"
echo "🧠 ================================================"
echo ""

# Setup cron jobs for autonomous memory curation
echo "⏰ Setting up autonomous memory curation cron jobs..."

# Verify API key is set
if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo "⚠️  Warning: ANTHROPIC_API_KEY not set - autonomous curation will fail"
    echo "   Set this environment variable in docker-compose.yml or .env file"
else
    echo "✓ Anthropic API key configured for Claude Code authentication"
fi

# Create crontab file - run scripts as mcp user via gosu
cat > /tmp/crontab <<EOF
# AI Memory MCP - Autonomous Memory Curation
# Daily curation at 2 AM UTC (run as mcp user)
0 2 * * * gosu mcp /app/scripts/memory-curation.sh >> /app/logs/memory-curation.log 2>&1

# Weekly deep reflection on Sundays at 3 AM UTC (run as mcp user)
0 3 * * 0 gosu mcp /app/scripts/memory-deep-reflection.sh >> /app/logs/memory-reflection.log 2>&1

# Keep cron daemon alive
EOF

# Install crontab for root (since cron jobs will use gosu to switch to mcp)
crontab /tmp/crontab
rm /tmp/crontab

echo "✓ Cron jobs configured:"
echo "  - Daily curation: 2 AM UTC"
echo "  - Weekly reflection: Sunday 3 AM UTC"
echo ""

# Start cron daemon in background
echo "🚀 Starting cron daemon..."
cron
echo "✓ Cron daemon started"
echo ""

# Verify cron is running
if pgrep cron > /dev/null; then
    echo "✓ Cron daemon verified running"
else
    echo "⚠️  Warning: Cron daemon may not be running"
fi
echo ""

# Display crontab for verification
echo "📋 Installed crontab entries:"
crontab -l
echo ""

echo "🧠 ================================================"
echo "🧠 AUTONOMOUS MEMORY CURATION ACTIVE"
echo "🧠 ================================================"
echo ""
echo "📊 Monitor curation logs:"
echo "  - Daily: docker logs consciousness-memory --follow | grep curation"
echo "  - Weekly: docker logs consciousness-memory --follow | grep reflection"
echo ""
echo "🚀 Starting AI Memory MCP HTTP Server..."
echo ""

# Execute the main command (CMD from Dockerfile) as mcp user
exec gosu mcp "$@"
