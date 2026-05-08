#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: ./scripts/set-cmc-key.sh <COINMARKETCAP_PRO_API_KEY>"
  exit 1
fi

KEY="$1"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_LOCAL="$ROOT_DIR/.env.local"

if [[ ! -f "$ENV_LOCAL" ]]; then
  cat > "$ENV_LOCAL" <<'EOF'
# Local-only overrides (not committed)
EOF
fi

if grep -q '^COINMARKETCAP_API_KEY=' "$ENV_LOCAL"; then
  sed -i '' "s|^COINMARKETCAP_API_KEY=.*$|COINMARKETCAP_API_KEY=$KEY|" "$ENV_LOCAL"
else
  printf '\nCOINMARKETCAP_API_KEY=%s\n' "$KEY" >> "$ENV_LOCAL"
fi

echo "COINMARKETCAP_API_KEY saved to $ENV_LOCAL"
echo "Restart backend to apply:"
echo "  pkill -f \"node src/server.js\" || true"
echo "  cd \"$ROOT_DIR\" && npm run start"
