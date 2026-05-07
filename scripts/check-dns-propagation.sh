#!/bin/bash
# Monitor DNS propagation untuk jeevatix.my.id

DOMAIN="jeevatix.my.id"
EXPECTED_NS1="derek.ns.cloudflare.com"
EXPECTED_NS2="margaret.ns.cloudflare.com"

echo "╔══════════════════════════════════════════════════════════════════════════════╗"
echo "║              DNS Propagation Monitor - jeevatix.my.id                        ║"
echo "╔══════════════════════════════════════════════════════════════════════════════╗"
echo ""
echo "Expected Nameservers:"
echo "  • $EXPECTED_NS1"
echo "  • $EXPECTED_NS2"
echo ""
echo "Checking propagation across multiple DNS servers..."
echo ""

check_dns() {
  local dns_name=$1
  local dns_server=$2
  local query_url=$3
  
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "📡 $dns_name ($dns_server)"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  
  if [ -n "$query_url" ]; then
    result=$(curl -s "$query_url" | jq -r '.Answer[]?.data // empty' 2>/dev/null)
  else
    result=$(host -t NS $DOMAIN $dns_server 2>/dev/null | grep "name server" | awk '{print $4}')
  fi
  
  if [ -z "$result" ]; then
    echo "Status: ❌ Not propagated yet (NXDOMAIN)"
  else
    echo "Status: ✅ Propagated!"
    echo "Nameservers found:"
    echo "$result" | while read -r ns; do
      if [[ "$ns" == *"cloudflare.com"* ]]; then
        echo "  ✅ $ns"
      else
        echo "  ⚠️  $ns (not Cloudflare)"
      fi
    done
  fi
  echo ""
}

# Check multiple DNS servers
check_dns "Google Public DNS" "8.8.8.8" "https://dns.google/resolve?name=$DOMAIN&type=NS"
check_dns "Cloudflare DNS" "1.1.1.1" "https://cloudflare-dns.com/dns-query?name=$DOMAIN&type=NS"
check_dns "Quad9 DNS" "9.9.9.9" ""
check_dns "Local DNS" "" ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 Additional Checks"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if domain resolves
echo -n "Domain resolution: "
if host $DOMAIN > /dev/null 2>&1; then
  echo "✅ Domain resolves"
else
  echo "❌ Domain does not resolve yet"
fi

# Check SOA record
echo -n "SOA record: "
soa=$(curl -s "https://dns.google/resolve?name=$DOMAIN&type=SOA" | jq -r '.Answer[]?.data // empty' 2>/dev/null)
if [ -n "$soa" ]; then
  echo "✅ Found"
else
  echo "❌ Not found"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Propagation Status Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Count propagated servers
propagated=0
total=4

for dns in "8.8.8.8" "1.1.1.1" "9.9.9.9"; do
  if host -t NS $DOMAIN $dns 2>/dev/null | grep -q "name server"; then
    ((propagated++))
  fi
done

if host -t NS $DOMAIN 2>/dev/null | grep -q "name server"; then
  ((propagated++))
fi

percentage=$((propagated * 100 / total))

echo "Propagated: $propagated/$total DNS servers ($percentage%)"
echo ""

if [ $propagated -eq $total ]; then
  echo "✅ FULLY PROPAGATED - Ready to proceed!"
  echo ""
  echo "Next steps:"
  echo "  1. Verify domain status in Cloudflare Dashboard"
  echo "  2. Add DNS records (CNAME for api, seller, admin, buyer)"
  echo "  3. Setup Workers Routes"
  echo "  4. Rebuild & deploy"
elif [ $propagated -gt 0 ]; then
  echo "⏳ PARTIALLY PROPAGATED - Wait a bit longer"
  echo ""
  echo "Estimated time: 30 minutes - 2 hours"
  echo "Run this script again in 30 minutes"
else
  echo "❌ NOT PROPAGATED YET - This is normal"
  echo ""
  echo "Nameservers were just updated. Propagation typically takes:"
  echo "  • Minimum: 30 minutes - 2 hours"
  echo "  • Average: 2-4 hours"
  echo "  • Maximum: 24-48 hours"
  echo ""
  echo "What to do:"
  echo "  1. Wait 30 minutes"
  echo "  2. Run this script again: ./scripts/check-dns-propagation.sh"
  echo "  3. Check online: https://dnschecker.org/#NS/jeevatix.my.id"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Last checked: $(date)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
