#!/bin/bash
# Setup Cloudflare Workers Routes untuk custom domain
# Alternative solution untuk "DNS record managed by Workers" error

set -e

ZONE_ID="${CLOUDFLARE_ZONE_ID:-62848e83a5041bbd3913496ad26d7007}"
API_TOKEN="${CLOUDFLARE_API_TOKEN}"

if [ -z "$API_TOKEN" ]; then
  echo "Error: CLOUDFLARE_API_TOKEN harus diset"
  exit 1
fi

echo "Setting up Cloudflare Workers Routes..."
echo "Zone ID: $ZONE_ID"
echo ""

create_route() {
  local pattern=$1
  local worker=$2
  
  echo "Creating route: $pattern -> $worker"
  
  response=$(curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/workers/routes" \
    -H "Authorization: Bearer $API_TOKEN" \
    -H "Content-Type: application/json" \
    --data "{
      \"pattern\": \"$pattern\",
      \"script\": \"$worker\"
    }")
  
  success=$(echo "$response" | jq -r '.success')
  
  if [ "$success" = "true" ]; then
    echo "✅ Created route: $pattern"
  else
    error=$(echo "$response" | jq -r '.errors[0].message // "Unknown error"')
    
    if echo "$error" | grep -q "already exists"; then
      echo "⚠️  Route already exists: $pattern"
    else
      echo "❌ Failed: $error"
    fi
  fi
  echo ""
}

echo "Creating Workers Routes for staging..."
echo ""

create_route "api.jeevatix.my.id/*" "jeevatix-staging-api"
create_route "seller.jeevatix.my.id/*" "jeevatix-staging-seller"
create_route "admin.jeevatix.my.id/*" "jeevatix-staging-admin"
create_route "jeevatix.my.id/*" "jeevatix-staging-buyer"

echo ""
echo "Workers Routes setup complete!"
echo ""
echo "Next steps:"
echo "1. Verify routes di Cloudflare Dashboard → jeevatix.my.id → Workers Routes"
echo "2. Test endpoints:"
echo "   curl https://api.jeevatix.my.id/health"
echo "   curl https://seller.jeevatix.my.id/debug | jq ."
echo "3. Rebuild seller: PUBLIC_API_BASE_URL=https://api.jeevatix.my.id pnpm --filter seller run build"
echo "4. Deploy: SKIP_DURABLE_OBJECT_MIGRATIONS=1 pnpm run deploy --stage staging"
