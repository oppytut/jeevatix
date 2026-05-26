#!/usr/bin/env bash
# generate-production-secrets.sh
#
# Generates strong random values for production secrets that CAN be
# auto-generated, and prints `gh secret set` snippets ready to copy/paste.
# Manual secrets (DB password, API keys, R2 URLs) are listed as TODO
# blocks so the operator knows what still has to be sourced manually.
#
# Usage:
#   scripts/generate-production-secrets.sh             # real values
#   scripts/generate-production-secrets.sh --dry-run   # placeholders
#   scripts/generate-production-secrets.sh --help
#
# This script does NOT call `gh` itself and does NOT write secrets to
# disk. The operator copies the printed values into a password manager
# (or pipes them into `gh secret set` manually) and is responsible for
# rotation policy.

set -euo pipefail

DRY_RUN=0
ENV_NAME="production"
REPO_ENV_FLAG="--env ${ENV_NAME}"

print_help() {
  cat <<'EOF'
generate-production-secrets.sh — generate Jeevatix production secrets

Usage:
  scripts/generate-production-secrets.sh [--dry-run] [--help]

Options:
  --dry-run   Print placeholder values instead of real openssl output.
              Useful for verifying the script structure or for review
              in PR diffs without exposing entropy.
  --help      Show this help text and exit.

Output format:
  - One stanza per secret, separated by `===` rules.
  - Each stanza prints the variable name, the value (or placeholder),
    and a `gh secret set NAME --env production --body "VALUE"` snippet.
  - Manual secrets (DB password, Resend key, Cloudflare token, etc.)
    are emitted as TODO stanzas with sourcing instructions.

The script never executes `gh secret set`. Copy/paste is required.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    --help|-h)
      print_help
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      echo "Run with --help for usage." >&2
      exit 2
      ;;
  esac
done

if ! command -v openssl >/dev/null 2>&1; then
  echo "ERROR: openssl is required but not found in PATH." >&2
  echo "Install openssl (e.g. apt-get install openssl) and retry." >&2
  exit 1
fi

# `gh` is optional. The script's job is to print snippets; the operator
# can copy them by hand even without `gh`.
if ! command -v gh >/dev/null 2>&1; then
  echo "WARN: gh CLI not found in PATH. Snippets will still be printed;" >&2
  echo "      copy values into your password manager and run 'gh secret set'" >&2
  echo "      from a host that has gh authenticated to the repo." >&2
  echo >&2
fi

gen_hex() {
  # 32 bytes -> 64 hex chars. Strong enough for HMAC-SHA256 and HS256 JWTs.
  if [[ ${DRY_RUN} -eq 1 ]]; then
    printf '<dry-run-placeholder-%s>' "$1"
  else
    openssl rand -hex 32
  fi
}

emit_separator() {
  printf '\n=====================================================================\n'
}

emit_generated() {
  local name="$1"
  local value="$2"
  local note="$3"

  emit_separator
  printf '%s\n' "${name}"
  printf '  note: %s\n' "${note}"
  printf '  value: %s\n' "${value}"
  printf '\n  # paste this into a shell with gh authenticated:\n'
  printf '  gh secret set %s %s --body "%s"\n' "${name}" "${REPO_ENV_FLAG}" "${value}"
}

emit_manual() {
  local name="$1"
  local source="$2"
  local example="$3"

  emit_separator
  printf '%s [MANUAL]\n' "${name}"
  printf '  source: %s\n' "${source}"
  printf '  format: %s\n' "${example}"
  printf '\n  # after retrieving the value, run:\n'
  printf '  # gh secret set %s %s --body "<paste-above>"\n' "${name}" "${REPO_ENV_FLAG}"
}

# Header ---------------------------------------------------------------
cat <<EOF
Jeevatix production secrets generator
=====================================
Mode:        $([[ ${DRY_RUN} -eq 1 ]] && echo 'DRY RUN (placeholders)' || echo 'LIVE (openssl rand)')
Target env:  ${ENV_NAME}
Repo:        oppytut/jeevatix (adjust if forked)

Treat the output below as sensitive. Do NOT paste it into chat,
issues, or commits. Store it in a password manager before running
the suggested gh commands.
EOF

JWT_SECRET_VALUE="$(gen_hex jwt)"
emit_generated \
  "PRODUCTION_JWT_SECRET" \
  "${JWT_SECRET_VALUE}" \
  "HS256 signing secret for access/refresh/verify/reset tokens (32 bytes hex)"

WEBHOOK_SECRET_VALUE="$(gen_hex webhook)"
emit_generated \
  "PRODUCTION_PAYMENT_WEBHOOK_SECRET" \
  "${WEBHOOK_SECRET_VALUE}" \
  "HMAC secret for verifying payment provider webhook signatures (32 bytes hex)"

# Unset to drop from shell history scope as quickly as possible.
unset JWT_SECRET_VALUE WEBHOOK_SECRET_VALUE

emit_manual \
  "PRODUCTION_DATABASE_URL" \
  "VPS Postgres password from password manager (do NOT rotate without coordinated deploy)" \
  "postgresql://jeevatix_production:<PASSWORD>@db.jeevatix.my.id:5432/jeevatix_production"

emit_manual \
  "PRODUCTION_TICKET_RESERVER_DATABASE_URL" \
  "Same Postgres password as PRODUCTION_DATABASE_URL (TicketReserver DO uses the same DB)" \
  "postgresql://jeevatix_production:<PASSWORD>@db.jeevatix.my.id:5432/jeevatix_production"

emit_manual \
  "EMAIL_API_KEY" \
  "Resend dashboard -> API Keys -> production key" \
  "re_<random-string>"

emit_manual \
  "EMAIL_FROM" \
  "Sender email; usually a verified Resend domain mailbox" \
  "Jeevatix <no-reply@jeevatix.my.id>"

emit_manual \
  "UPLOAD_PUBLIC_URL" \
  "Cloudflare R2 public bucket base URL (custom domain or *.r2.dev)" \
  "https://uploads.jeevatix.my.id"

emit_manual \
  "CLOUDFLARE_ACCOUNT_ID" \
  "Cloudflare dashboard -> Workers & Pages -> Account ID (right sidebar)" \
  "32 hex chars"

emit_manual \
  "CLOUDFLARE_API_TOKEN" \
  "Reuse the staging token (extend permissions to cover production zone) — do not rotate ad hoc" \
  "Cloudflare dashboard -> My Profile -> API Tokens"

cat <<'EOF'

=====================================================================
Reminder checklist (NOT auto-generated by this script)
=====================================================================

After the first successful production deploy, the following GitHub
*variables* (vars, not secrets) still need to be set or refreshed:

  - PRODUCTION_INTERNAL_API_URL
      The internal worker-to-worker URL printed by `sst deploy`.
  - PRODUCTION_API_WORKERS_DEV_URL
  - PRODUCTION_BUYER_WORKERS_DEV_URL
  - PRODUCTION_SELLER_WORKERS_DEV_URL
  - PRODUCTION_ADMIN_WORKERS_DEV_URL
      Used by the post-deploy SSR canary in deploy-production.yml.
      Visible in the deploy job log once production workers exist.
  - PRODUCTION_API_DOMAIN
  - PRODUCTION_BUYER_DOMAIN
  - PRODUCTION_ADMIN_DOMAIN
  - PRODUCTION_SELLER_DOMAIN
      Custom domains attached to each production worker.
  - PRODUCTION_CORS_ALLOWED_ORIGINS
      Optional comma-separated origin allowlist for the API.
  - PRODUCTION_R2_BUCKET_NAME
  - PRODUCTION_RESERVATION_CLEANUP_QUEUE_NAME
  - PRODUCTION_HYPERDRIVE_SSLMODE (var) and
    PRODUCTION_HYPERDRIVE_CA_CERT_ID (secret) if Hyperdrive is wired up.
  - PRODUCTION_UPLOAD_PUBLIC_URL (var mirroring UPLOAD_PUBLIC_URL secret form).
  - PUBLIC_PARTYKIT_HOST and PARTYKIT_HOST if PartyKit is deployed.

Rotation notes:
  - Database password rotation is coordinated; do not regenerate it
    here. See handoff lessons learned (line 897).
  - The Cloudflare API token is reused from staging (with extra
    permissions); do not regenerate it here.

Done.
EOF

exit 0
