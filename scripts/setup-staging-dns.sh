#!/bin/bash
# Script untuk setup DNS records Jeevatix staging
# Requires: CLOUDFLARE_API_TOKEN dengan DNS edit permissions
#           CLOUDFLARE_ZONE_ID untuk domain jeevatix.my.id

set -e

ZONE_ID="${CLOUDFLARE_ZONE_ID}"
API_TOKEN="${CLOUDFLARE_API_TOKEN}"
DOMAIN="jeevatix.my.id"

if [ -z "$ZONE_ID" ] || [ -z "$API_TOKEN" ]; then
  echo "Error: CLOUDFLARE_ZONE_ID dan CLOUDFLARE_API_TOKEN harus diset"
  echo ""
  echo "Cara mendapatkan Zone ID:"
  echo "1. Login ke Cloudflare Dashboard"
  echo "2. Pilih domain jeevatix.my.id"
  echo "3. Scroll ke bawah di Overview page"
  echo "4. Copy Zone ID dari sidebar kanan"
  echo ""
  echo "Cara membuat API Token:"
  echo "1. Go to https://dash.cloudflare.com/profile/api-tokens"
  echo "2. Create Token -> Edit zone DNS template"
  echo "3. Pilih zone jeevatix.my.id"
  echo "4. Copy token"
  exit 1
fi

echo "Setting up DNS records for Jeevatix staging..."
echo "Domain: $DOMAIN"
echo "Zone ID: $ZONE_ID"
echo ""

# Function to create DNS record
create_dns_record() {
  local name=$1
  local target=$2
  
  echo "Creating DNS record: $name.$DOMAIN -> $target"
  
  response=$(curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
    -H "Authorization: Bearer $API_TOKEN" \
    -H "Content-Type: application/json" \
    --data "{
      \"type\": \"CNAME\",
      \"name\": \"$name\",
      \"content\": \"$target\",
      \"ttl\": 1,
      \"proxied\": true
    }")
  
  success=$(echo "$response" | jq -r '.success')
  
  if [ "$success" = "true" ]; then
    echo "✅ Created: $name.$DOMAIN"
  else
    error=$(echo "$response" | jq -r '.errors[0].message')
    echo "❌ Failed: $error"
  fi
  echo ""
}

# Create DNS records
create_dns_record "api" "jeevatix-staging-api.ariefna95.workers.dev"
create_dns_record "seller" "jeevatix-staging-seller.ariefna95.workers.dev"
create_dns_record "admin" "jeevatix-staging-admin.ariefna95.workers.dev"

# For root domain (@), use different approach
echo "Creating DNS record: $DOMAIN -> jeevatix-staging-buyer.ariefna95.workers.dev"
response=$(curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  --data "{
    \"type\": \"CNAME\",
    \"name\": \"@\",
    \"content\": \"jeevatix-staging-buyer.ariefna95.workers.dev\",
    \"ttl\": 1,
    \"proxied\": true
  }")

success=$(echo "$response" | jq -r '.success')
if [ "$success" = "true" ]; then
  echo "✅ Created: $DOMAIN (root)"
else
  error=$(echo "$response" | jq -r '.errors[0].message')
  echo "❌ Failed: $error"
fi

echo ""
echo "DNS setup complete!"
echo ""
echo "Verifying DNS records..."
sleep 5

for subdomain in "api" "seller" "admin" ""; do
  if [ -z "$subdomain" ]; then
    fqdn="$DOMAIN"
  else
    fqdn="$subdomain.$DOMAIN"
  fi
  
  echo -n "Checking $fqdn... "
  if host "$fqdn" > /dev/null 2>&1; then
    echo "✅ Resolved"
  else
    echo "⏳ Not yet propagated (may take 5-10 minutes)"
  fi
done

echo ""
echo "Next steps:"
echo "1. Wait for DNS propagation (5-10 minutes)"
echo "2. Rebuild seller portal: PUBLIC_API_BASE_URL=https://api.jeevatix.my.id pnpm --filter seller run build"
echo "3. Deploy: SKIP_DURABLE_OBJECT_MIGRATIONS=1 pnpm run deploy --stage staging"
echo "4. Run e2e test: pnpm exec playwright test staging-seller-login.spec.ts --project=staging"
