#!/bin/bash
# A real ISP outage on demand: block everything past the router while the router itself stays reachable,
# exactly what a dead provider looks like from inside the house. Uses macOS's built-in firewall (pf).
#   pnpm outage:on    # cut the internet (asks for your password)
#   pnpm outage:off   # bring it back, and restore the firewall exactly as it was
set -euo pipefail
STATE=/tmp/uplink-outage.state

case "${1:-}" in
on)
  GW=$(route -n get default 2>/dev/null | awk '/gateway:/{print $2}')
  [ -n "$GW" ] || { echo "No default gateway — connect to Wi-Fi first."; exit 1; }
  WAS=$(sudo pfctl -s info 2>/dev/null | awk '/^Status:/{print $2}')
  echo "${WAS:-Disabled}" > "$STATE"
  RULES=$(mktemp)
  cat > "$RULES" <<EOF
set skip on lo0
pass out quick inet from any to $GW
pass in quick inet from $GW to any
pass out quick inet proto udp from any port 68 to any port 67
block drop out quick inet all
block drop out quick inet6 all
EOF
  sudo pfctl -q -f "$RULES"
  sudo pfctl -q -e 2>/dev/null || true
  rm -f "$RULES"
  echo "Internet is down: your router ($GW) still answers, nothing past it does. Undo with: pnpm outage:off"
  ;;
off)
  sudo pfctl -q -f /etc/pf.conf
  if [ "$(cat "$STATE" 2>/dev/null || echo Disabled)" = "Disabled" ]; then sudo pfctl -q -d 2>/dev/null || true; fi
  rm -f "$STATE"
  echo "Internet is back."
  ;;
*)
  echo "usage: outage.sh on|off"; exit 1 ;;
esac
