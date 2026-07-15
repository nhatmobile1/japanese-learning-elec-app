#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p build-icon.iconset
qlmanage -t -s 1024 -o build-icon.iconset assets/icon.svg >/dev/null
mv build-icon.iconset/icon.svg.png build-icon.iconset/icon_512x512@2x.png
for spec in "16 icon_16x16" "32 icon_16x16@2x" "32 icon_32x32" "64 icon_32x32@2x" \
            "128 icon_128x128" "256 icon_128x128@2x" "256 icon_256x256" \
            "512 icon_256x256@2x" "512 icon_512x512"; do
  size=${spec% *}; name=${spec#* }
  sips -z "$size" "$size" build-icon.iconset/icon_512x512@2x.png \
       --out "build-icon.iconset/$name.png" >/dev/null
done
iconutil -c icns build-icon.iconset -o assets/icon.icns
rm -rf build-icon.iconset
echo "assets/icon.icns written"
