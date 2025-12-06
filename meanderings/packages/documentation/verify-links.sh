#!/bin/bash

# Script to verify all GitHub links in documentation files
# Usage: ./verify-links.sh <markdown-file>
#
# For private repositories, replace YOUR_GITHUB_TOKEN_HERE below with your actual token
# Or set GITHUB_TOKEN environment variable to override

# Set your GitHub token here (replace with your actual token)
GITHUB_TOKEN="${GITHUB_TOKEN:-YOUR_GITHUB_TOKEN_HERE}"

if [ -z "$1" ]; then
    echo "Usage: $0 <markdown-file>"
    echo "Example: $0 src/content/prerequisites/section-1-system-2-thinking.md"
    echo ""
    echo "To use with private repositories:"
    echo "  1. Edit this script and replace YOUR_GITHUB_TOKEN_HERE with your token"
    echo "  OR"
    echo "  2. export GITHUB_TOKEN='your_token' before running"
    exit 1
fi

MARKDOWN_FILE="$1"

if [ ! -f "$MARKDOWN_FILE" ]; then
    echo "Error: File not found: $MARKDOWN_FILE"
    exit 1
fi

echo "===================================="
echo "Verifying links in: $MARKDOWN_FILE"
echo "===================================="

# Check if token is set
if [ "$GITHUB_TOKEN" = "YOUR_GITHUB_TOKEN_HERE" ]; then
    echo "⚠️  WARNING: Using placeholder token - private repo links will fail"
    echo "    Edit script and replace YOUR_GITHUB_TOKEN_HERE with your actual token"
    echo ""
fi

echo ""

# Extract all GitHub URLs from the markdown file
URLS=$(grep -o 'https://github.com/[^"]*' "$MARKDOWN_FILE" | sort -u)

if [ -z "$URLS" ]; then
    echo "No GitHub URLs found in the file."
    exit 0
fi

TOTAL=0
SUCCESS=0
FAILED=0

# Check each URL
while IFS= read -r url; do
    TOTAL=$((TOTAL + 1))

    # Build curl command with optional authentication
    CURL_CMD="curl -s -o /dev/null -w %{http_code} -L"

    # Add GitHub token if available and not placeholder (for private repositories)
    if [ -n "$GITHUB_TOKEN" ] && [ "$GITHUB_TOKEN" != "YOUR_GITHUB_TOKEN_HERE" ]; then
        CURL_CMD="$CURL_CMD -H \"Authorization: token $GITHUB_TOKEN\""
    fi

    CURL_CMD="$CURL_CMD \"$url\""

    # Execute curl command
    HTTP_CODE=$(eval $CURL_CMD)

    if [ "$HTTP_CODE" = "200" ]; then
        echo "✅ [$HTTP_CODE] $url"
        SUCCESS=$((SUCCESS + 1))
    else
        echo "❌ [$HTTP_CODE] $url"
        FAILED=$((FAILED + 1))
    fi
done <<< "$URLS"

echo ""
echo "===================================="
echo "Summary:"
echo "  Total URLs checked: $TOTAL"
echo "  ✅ Successful: $SUCCESS"
echo "  ❌ Failed: $FAILED"
echo "===================================="

if [ $FAILED -gt 0 ]; then
    exit 1
else
    exit 0
fi
