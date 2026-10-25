#!/bin/bash
# Start Uplink on this Mac and open it as its own app window (no tabs, no URL bar).
# Everything runs locally; the window keeps working with the internet down.
#   pnpm uplink            # app window
#   FULLSCREEN=1 pnpm uplink
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PORT:-3500}"
URL="http://localhost:$PORT"

if ! curl -s -o /dev/null -m 2 "$URL/api/status"; then
  echo "Starting Uplink on $URL…"
  nohup pnpm dev --port "$PORT" > .uplink.log 2>&1 &
  for _ in $(seq 1 120); do
    curl -s -o /dev/null -m 2 "$URL/api/status" && break
    sleep 0.5
  done
fi
curl -s -o /dev/null -m 2 "$URL/api/status" || { echo "Uplink didn't start — see .uplink.log"; exit 1; }

for app in "Google Chrome" "Microsoft Edge" "Chromium" "Brave Browser" "Arc"; do
  if [ -d "/Applications/$app.app" ]; then
    # Its own profile, so the window opens as an app even when the browser is already running.
    open -na "$app" --args --app="$URL" --user-data-dir="$HOME/.uplink/window" --no-first-run --no-default-browser-check \
      --window-size=1512,945 ${FULLSCREEN:+--start-fullscreen}
    echo "Uplink is open in its own window ($app)."
    exit 0
  fi
done
open "$URL"
