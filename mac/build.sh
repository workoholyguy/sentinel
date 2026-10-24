#!/bin/bash
# Builds Uplink.app (native macOS app around the local Uplink server) into ~/Applications and opens it.
set -euo pipefail
cd "$(dirname "$0")"
REPO="$(cd .. && pwd)"
OUT="build/Uplink.app"
rm -rf build && mkdir -p "$OUT/Contents/MacOS" "$OUT/Contents/Resources" build/icon.iconset

# Icon: draw once, then every size macOS wants.
swiftc -O icon.swift -o build/icon && ./build/icon build/icon-1024.png
for s in 16 32 128 256 512; do
  sips -z $s $s build/icon-1024.png --out "build/icon.iconset/icon_${s}x${s}.png" >/dev/null
  sips -z $((s * 2)) $((s * 2)) build/icon-1024.png --out "build/icon.iconset/icon_${s}x${s}@2x.png" >/dev/null
done
iconutil -c icns build/icon.iconset -o "$OUT/Contents/Resources/AppIcon.icns"

swiftc -O Uplink.swift -o "$OUT/Contents/MacOS/Uplink"
cat > "$OUT/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleName</key><string>Uplink</string>
  <key>CFBundleDisplayName</key><string>Uplink</string>
  <key>CFBundleIdentifier</key><string>dev.omarbuilds.uplink</string>
  <key>CFBundleExecutable</key><string>Uplink</string>
  <key>CFBundleIconFile</key><string>AppIcon</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>0.1</string>
  <key>LSMinimumSystemVersion</key><string>13.0</string>
  <key>NSHighResolutionCapable</key><true/>
  <key>NSAppTransportSecurity</key><dict><key>NSAllowsLocalNetworking</key><true/></dict>
  <key>UplinkRepo</key><string>${REPO}</string>
</dict></plist>
PLIST
codesign -s - --force --deep "$OUT" >/dev/null 2>&1 || true

mkdir -p "$HOME/Applications"
rm -rf "$HOME/Applications/Uplink.app" && cp -R "$OUT" "$HOME/Applications/Uplink.app"
open "$HOME/Applications/Uplink.app"
echo "Uplink.app is in ~/Applications and running."
