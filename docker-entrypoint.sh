#!/bin/sh
set -e

# Replace environment variables in the built JavaScript files
# This allows runtime configuration without rebuilding the image

echo "Injecting environment variables..."

# Find and replace placeholder values in JS files
find /usr/share/nginx/html -type f -name "*.js" -exec sed -i \
  -e "s|__VITE_SUPABASE_URL__|${VITE_SUPABASE_URL:-}|g" \
  -e "s|__VITE_SUPABASE_ANON_KEY__|${VITE_SUPABASE_ANON_KEY:-}|g" \
  -e "s|__VITE_SUPABASE_PROJECT_ID__|${VITE_SUPABASE_PROJECT_ID:-}|g" \
  {} \;

echo "Environment variables injected successfully!"

# Start nginx
exec nginx -g 'daemon off;'
