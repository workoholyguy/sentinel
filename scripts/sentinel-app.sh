#!/bin/bash
# Start Sentinel on this Mac and open it as its own app window (no tabs, no URL bar).
# Everything runs locally; the window keeps working with the internet down.
#   pnpm sentinel            # app window
#   FULLSCREEN=1 pnpm sentinel
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PORT:-3500}"
URL="http://localhost:$PORT"

if ! curl -s -o /dev/null -m 2 "$URL/api/status"; then
  echo "Starting Sentinel on $URL…"
  nohup pnpm dev --port "$PORT" > .sentinel.log 2>&1 &
  for _ in $(seq 1 120); do
    curl -s -o /dev/null -m 2 "$URL/api/status" && break
    sleep 0.5
  done
fi
curl -s -o /dev/null -m 2 "$URL/api/status" || { echo "Sentinel didn't start — see .sentinel.log"; exit 1; }

for app in "Google Chrome" "Microsoft Edge" "Chromium" "Brave Browser" "Arc"; do
  if [ -d "/Applications/$app.app" ]; then
    # Its own profile, so the window opens as an app even when the browser is already running.
    open -na "$app" --args --app="$URL/dashboard" --user-data-dir="$HOME/.sentinel/window" --no-first-run --no-default-browser-check \
      --window-size=1512,945 ${FULLSCREEN:+--start-fullscreen}
    echo "Sentinel is open in its own window ($app)."
    exit 0
  fi
done
open "$URL/dashboard"
