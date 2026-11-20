#!/bin/bash
# Railway start script for Cal.com. Repeats upstream scripts/start.sh (placeholder URL
# replacement, migrations, app-store seed, yarn start) and adds:
#   - checks for values that would otherwise break the start (URL, encryption key),
#   - a Postgres wait and migration retries (services start in parallel on Railway),
#   - the first admin account, created before the public port opens.
set -euo pipefail
cd /calcom
log() { echo "[railway] $*"; }

url="${NEXT_PUBLIC_WEBAPP_URL:-}"
url="${url%/}"
case "$url" in
  http://*|https://*) ;;
  *)
    if [[ -n "${RAILWAY_PUBLIC_DOMAIN:-}" ]]; then
      [[ -n "$url" ]] && log "WARNING: NEXT_PUBLIC_WEBAPP_URL is not an http(s) URL; using https://$RAILWAY_PUBLIC_DOMAIN"
      url="https://$RAILWAY_PUBLIC_DOMAIN"
    fi
    ;;
esac
export NEXT_PUBLIC_WEBAPP_URL="$url"
case "${NEXTAUTH_URL:-}" in
  http://*|https://*) ;;
  *) export NEXTAUTH_URL="$url" ;;
esac

# CALENDSO_ENCRYPTION_KEY must be 32 characters (AES-256). Derive a stable one otherwise.
key="${CALENDSO_ENCRYPTION_KEY:-}"
if [[ ${#key} -ne 32 ]]; then
  log "WARNING: CALENDSO_ENCRYPTION_KEY is not 32 characters; using the first 32 hex characters of its SHA-256"
  CALENDSO_ENCRYPTION_KEY="$(printf '%s' "${key:-railway}" | sha256sum | cut -c1-32)"
  export CALENDSO_ENCRYPTION_KEY
fi
auth_secret="${NEXTAUTH_SECRET:-}"
if [[ ${#auth_secret} -lt 16 ]]; then
  log "WARNING: NEXTAUTH_SECRET is empty or very short; deriving a longer value from it"
  NEXTAUTH_SECRET="$(printf '%s' "${auth_secret:-railway}" | sha256sum | cut -d' ' -f1)"
  export NEXTAUTH_SECRET
fi
export DATABASE_DIRECT_URL="${DATABASE_DIRECT_URL:-${DATABASE_URL:-}}"

scripts/replace-placeholder.sh "$BUILT_NEXT_PUBLIC_WEBAPP_URL" "$NEXT_PUBLIC_WEBAPP_URL"

node /railway/railway-calcom.js wait-db

for attempt in 1 2 3 4 5 6; do
  if npx prisma migrate deploy --schema /calcom/packages/prisma/schema.prisma; then
    break
  fi
  if [[ $attempt -eq 6 ]]; then
    log "ERROR: migrations failed 6 times"
    exit 1
  fi
  log "migration attempt $attempt failed; retrying in 15 s"
  sleep 15
done

npx ts-node --transpile-only /calcom/scripts/seed-app-store.ts || log "WARNING: app store seed failed; apps may be missing until the next start"

node /railway/railway-calcom.js admin

log "starting Cal.com on port ${PORT:-3000} ($NEXT_PUBLIC_WEBAPP_URL)"
exec yarn start
