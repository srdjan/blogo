#!/bin/bash
# Test script for creating blog posts with curl

echo "Testing API endpoint with curl..."
echo ""

# Define variables for easier reuse
API_URL="http://localhost:8000/api/posts"
TITLE="Post Created with Curl"
CONTENT="# Using curl with Deno

This is a sample blog post created via the API using curl.

## Features

- Easy to use
- Supports markdown
- Automatically generates slugs"

# Properly escape the content for JSON
CONTENT_ESCAPED=$(echo "$CONTENT" | awk 'BEGIN{RS="\n";ORS="\\n"} {print}' | sed 's/\\n$//')
TAGS='["api", "curl", "deno"]'

# Create the full JSON payload
JSON_PAYLOAD=$(cat <<EOF
{
  "title": "$TITLE",
  "content": "$CONTENT_ESCAPED",
  "tags": $TAGS
}
EOF
)

# Print request details
echo "POST $API_URL"
echo "Content-Type: application/json"
echo ""
echo "Request payload:"
echo "$JSON_PAYLOAD"
echo ""

# Make the request with verbose output
curl -v -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d "$JSON_PAYLOAD"

echo ""
echo "Request completed"