#!/bin/bash
# The Mechanicus Dock icons (macOS):
#  - COGITATOR (cogitator.svg) on Herdr.app, as a custom Finder icon: the bundle itself is left alone,
#    so its signature and updates are unaffected (an update drops the icon; run this again).
# Usage: apply-icons.sh [--remove] [--herdr <Herdr.app>]
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
herdr=/Applications/Herdr.app
remove=0
while [ $# -gt 0 ]; do
  case "$1" in
    --remove) remove=1 ;;
    --herdr) herdr="$2"; shift ;;
    -h|--help) sed -n '2,5p' "$0"; exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
  shift
done

[ "$(uname)" = Darwin ] || { echo "macOS only" >&2; exit 1; }
[ -d "$herdr/Contents" ] || { echo "no Herdr app at $herdr" >&2; exit 1; }

# setIcon <image file or empty> <path>: NSWorkspace's custom icon, what Finder's Get Info paste does.
setIcon() {
  osascript -l JavaScript - "$1" "$2" <<'JS' >/dev/null
ObjC.import("AppKit");
function run(a) {
  let img = $();
  if (a[0]) {
    img = $.NSImage.alloc.initWithContentsOfFile(a[0]);
    if (!img.isValid) throw "cannot read " + a[0];
  }
  if (!$.NSWorkspace.sharedWorkspace.setIconForFileOptions(img, a[1], 0)) throw "cannot set the icon of " + a[1];
  return "";
}
JS
}

plist() { /usr/libexec/PlistBuddy -c "$1" "$2/Contents/Info.plist"; }
version() { echo "$(plist 'Print :CFBundleShortVersionString' "$1" 2>/dev/null)-$(plist 'Print :CFBundleVersion' "$1" 2>/dev/null)"; }

if [ "$remove" = 1 ]; then
  setIcon "" "$herdr" && echo "Herdr.app: custom icon removed"
  exit 0
fi

tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT

# icns <svg> <out.icns>: render every iconset size with AppKit (it reads SVG), then iconutil.
icns() {
  local set="$tmp/$(basename "$1" .svg).iconset"; mkdir -p "$set"
  osascript -l JavaScript - "$1" "$set" <<'JS' >/dev/null
ObjC.import("AppKit");
function run(a) {
  for (const s of [16, 32, 128, 256, 512]) for (const k of [1, 2]) {
    const px = s * k, img = $.NSImage.alloc.initWithContentsOfFile(a[0]);
    if (!img.isValid) throw "cannot read " + a[0];
    img.size = $.NSMakeSize(px, px);
    const rep = $.NSBitmapImageRep.alloc.initWithCGImage(img.CGImageForProposedRectContextHints(null, $(), $()));
    const png = rep.representationUsingTypeProperties($.NSBitmapImageFileTypePNG, $.NSDictionary.dictionary);
    png.writeToFileAtomically(`${a[1]}/icon_${s}x${s}${k === 2 ? "@2x" : ""}.png`, true);
  }
  return "";
}
JS
  iconutil -c icns -o "$2" "$set"
}

icns "$here/cogitator.svg" "$tmp/cogitator.icns"

setIcon "$tmp/cogitator.icns" "$herdr"
# A write into another app's bundle can be refused without an error (App Management).
if [ ! -f "$herdr/Icon"$'\r' ]; then
  echo "$herdr: the icon wasn't written (if macOS asks, allow it under System Settings → Privacy & Security → App Management), then run this again" >&2
  exit 1
fi
echo "Herdr.app: COGITATOR icon (the Dock shows it from Herdr's next start)"
