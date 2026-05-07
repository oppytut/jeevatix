# Domain Was Working, Now NXDOMAIN - Troubleshooting

## Situation

✅ **Nameservers set 1 week ago:**
- derek.ns.cloudflare.com
- margaret.ns.cloudflare.com

✅ **Domain was accessible before:**
- jeevatix.my.id sempat bisa diakses
- Cloudflare Workers dengan domain ini pernah bekerja

❌ **Now returning NXDOMAIN:**
- Domain tidak resolve
- Seperti domain tidak ada

## Possible Causes

### 1. Domain Paused or Suspended in Cloudflare

**Symptoms:**
- Domain was working, suddenly stopped
- NXDOMAIN error
- Cloudflare Dashboard shows "Paused" status

**Check:**
1. Login to https://dash.cloudflare.com
2. Find jeevatix.my.id in domains list
3. Check status badge:
   - 🟢 **Active** - Domain is active
   - ⏸️ **Paused** - Domain is paused
   - ⚠️ **Pending** - Nameserver issue
   - 🔴 **Moved** - Domain removed

**Solution if Paused:**
1. Click domain
2. Look for "Resume" or "Activate" button
3. Click to reactivate

### 2. DNS Records Deleted

**Symptoms:**
- Domain resolves but no A/AAAA/CNAME records
- Workers custom domains removed
- DNS records page empty or missing records

**Check:**
1. Cloudflare Dashboard → jeevatix.my.id
2. DNS → Records
3. Look for records:
   - api.jeevatix.my.id
   - seller.jeevatix.my.id
   - admin.jeevatix.my.id
   - jeevatix.my.id (root)

**Solution:**
- If records missing → Add them back (follow SETUP_CHECKLIST.md)
- If workers-managed records → Remove from Workers settings first

### 3. Nameservers Changed Back

**Symptoms:**
- Domain was working
- Suddenly NXDOMAIN
- Nameservers reverted to registrar default

**Check:**
```bash
# Check current nameservers
host -t NS jeevatix.my.id

# Should show:
# derek.ns.cloudflare.com
# margaret.ns.cloudflare.com
```

**Solution if Changed:**
1. Login to registrar
2. Set nameservers back to Cloudflare
3. Wait 2-4 hours for propagation

### 4. Domain Expired or Suspended by Registrar

**Symptoms:**
- Domain was working
- Suddenly NXDOMAIN
- No nameserver records at all

**Check:**
1. Login to domain registrar
2. Check domain status
3. Check expiry date
4. Check payment status

**Solution:**
- Renew domain if expired
- Resolve any billing issues
- Contact registrar support

### 5. Cloudflare Account Issue

**Symptoms:**
- Cannot access Cloudflare Dashboard
- Domain not showing in account
- Account suspended

**Check:**
1. Try logging in to Cloudflare
2. Check email for notifications
3. Check account status

**Solution:**
- Resolve account issues
- Contact Cloudflare support
- Check billing status

## Diagnostic Steps

### Step 1: Check Nameservers at Registrar

**Most Important Check:**

1. Login to your domain registrar (where you bought jeevatix.my.id)
2. Go to Domain Management
3. Check nameservers currently set
4. **Expected:**
   ```
   derek.ns.cloudflare.com
   margaret.ns.cloudflare.com
   ```

**If different:**
- Nameservers were changed (accidentally or by registrar)
- Set them back to Cloudflare nameservers
- Wait 2-4 hours

### Step 2: Check Cloudflare Dashboard

1. Login: https://dash.cloudflare.com
2. Look for jeevatix.my.id in domains list
3. Check:
   - ✅ Domain exists in list?
   - ✅ Status is "Active"?
   - ✅ DNS records exist?
   - ✅ Workers custom domains configured?

### Step 3: Check Domain Registration

```bash
# Check if domain is registered
whois jeevatix.my.id | grep -E "(Status|Expiry|Name Server)"
```

Look for:
- Status: Should be "ok" or "active"
- Expiry: Should be in future
- Name Server: Should show Cloudflare nameservers

### Step 4: Check DNS Propagation

```bash
# Check if nameservers are propagated
./scripts/check-dns-propagation.sh
```

If shows 0% propagation but nameservers were set 1 week ago:
- Nameservers were changed recently
- Or there's an issue at registrar level

## Quick Fix Checklist

- [ ] Login to Cloudflare Dashboard
- [ ] Verify jeevatix.my.id exists and is Active
- [ ] Check DNS records exist
- [ ] Login to domain registrar
- [ ] Verify nameservers are still Cloudflare
- [ ] Check domain not expired
- [ ] Check no billing issues

## Most Likely Scenario

Given that:
1. Domain was working 1 week ago
2. Nameservers were set correctly
3. Now suddenly NXDOMAIN

**Most likely cause:**
- DNS records were deleted (accidentally or during cleanup)
- Workers custom domains were removed
- Domain was paused in Cloudflare

**Least likely:**
- Nameservers changed (you would have noticed)
- Domain expired (too soon)

## Immediate Action Required

**Please check Cloudflare Dashboard and tell me:**

1. **Domain Status:**
   - Is jeevatix.my.id in your domains list?
   - What is the status? (Active/Paused/Pending)

2. **DNS Records:**
   - How many DNS records exist?
   - Are there any records for api, seller, admin, or root domain?

3. **Workers Custom Domains:**
   - Go to Workers & Pages
   - Check each worker (api, seller, admin, buyer)
   - Are custom domains still configured?

## If Domain is Active but No DNS Records

This is the most likely scenario. Solution:

1. **Remove Workers Custom Domains** (if any exist)
   - Follow: REMOVE_WORKERS_CUSTOM_DOMAIN.md

2. **Add DNS Records**
   - Follow: SETUP_CHECKLIST.md - Phase 2
   - Add CNAME records for api, seller, admin, buyer

3. **Setup Workers Routes**
   - Run: `./scripts/setup-workers-routes.sh`

4. **Test**
   - Wait 2-3 minutes for DNS propagation
   - Run: `host api.jeevatix.my.id`
   - Should resolve immediately (already in Cloudflare)

## If Domain is Paused

1. Click domain in Cloudflare Dashboard
2. Look for "Resume" or "Activate" button
3. Click to activate
4. Follow DNS setup steps above

## If Domain Not in Cloudflare

This would be unusual if it was working before. Possible:
- Wrong Cloudflare account
- Domain was removed
- Account issue

**Solution:**
- Check if logged into correct account
- Check email for Cloudflare notifications
- Contact Cloudflare support

## Expected Timeline

**If DNS records just need to be added:**
- Add records: 5 minutes
- DNS propagation: 2-3 minutes (already in Cloudflare)
- Setup Workers Routes: 3 minutes
- Rebuild & deploy: 5 minutes
- **Total: ~15 minutes**

**If nameservers need to be reset:**
- Reset nameservers: 5 minutes
- DNS propagation: 2-4 hours
- Add records: 5 minutes
- Setup: 10 minutes
- **Total: 2-4 hours**

## Next Steps

1. **Check Cloudflare Dashboard** (most important!)
2. **Report back** what you see:
   - Domain status
   - DNS records count
   - Workers custom domains status
3. I'll guide you through the fix based on what you find

---

**Key Point:** Since domain was working before, this is likely a **configuration issue**, not a propagation issue. Should be quick to fix once we identify what changed.
