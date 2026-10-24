#!/bin/bash
# Turn the cloud watchdog off (it won't call while Uplink is stopped) — e.g. before closing the laptop.
#   pnpm watchdog:off
set -euo pipefail
cd "$(dirname "$0")/.."
URL=$(grep '^WATCHDOG_URL=' .env.local | cut -d= -f2-)
TOKEN=$(grep '^WATCHDOG_TOKEN=' .env.local | cut -d= -f2-)
[ -n "$URL" ] && [ -n "$TOKEN" ] || { echo "No watchdog configured in .env.local"; exit 0; }
curl -s -m 5 -X POST -H "authorization: Bearer $TOKEN" "$URL/disarm" && echo
