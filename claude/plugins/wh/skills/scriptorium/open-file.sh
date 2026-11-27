#!/bin/bash
# Opens files as data-slates: in a JetBrains IDE's LightEdit mode (`<ide> -e <file>`: the lightweight
# single-file editor, no project opened), else in VS Code. Exit 3 when neither is installed.
# Usage: open-file.sh <file>...
set -uo pipefail

[ $# -gt 0 ] || { echo "usage: open-file.sh <file>..." >&2; exit 2; }

rc=0; files=()
for f in "$@"; do
  if [ ! -f "$f" ]; then echo "no such file: $f" >&2; rc=1; continue; fi
  files+=("$(cd "$(dirname "$f")" && pwd)/$(basename "$f")")
done
[ ${#files[@]} -gt 0 ] || exit 1

# The JetBrains IDEs in order of preference: their launcher on PATH (Toolbox's shell scripts
# included), then their .app in /Applications or ~/Applications (Toolbox installs there too).
ides="pycharm:PyCharm idea:IntelliJ?IDEA webstorm:WebStorm rubymine:RubyMine goland:GoLand
  phpstorm:PhpStorm clion:CLion rider:Rider rustrover:RustRover dataspell:DataSpell datagrip:DataGrip aqua:Aqua"
launcher=""; name=""
for e in $ides; do
  cmd=${e%%:*}; app=${e#*:}
  if p=$(command -v "$cmd" 2>/dev/null); then launcher=$p; name=${app/\?/ }; break; fi
  for a in /Applications/$app*.app "$HOME"/Applications/$app*.app "$HOME"/Applications/*/$app*.app; do
    [ -d "$a" ] || continue
    exe=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleExecutable' "$a/Contents/Info.plist" 2>/dev/null)
    if [ -n "$exe" ] && [ -x "$a/Contents/MacOS/$exe" ]; then launcher="$a/Contents/MacOS/$exe"; name=$(basename "$a" .app); break 2; fi
  done
done

if [ -n "$launcher" ]; then
  # One call for all the files (so they share one IDE), detached: the launcher blocks while it is
  # the one that starts the IDE.
  nohup "$launcher" -e "${files[@]}" >/dev/null 2>&1 &
  printf '%s LightEdit: %s\n' "$name" "${files[@]}"
  exit $rc
fi

# No JetBrains IDE: VS Code (`code` on PATH, else the one inside its .app).
code=$(command -v code 2>/dev/null || true)
if [ -z "$code" ]; then
  for a in "/Applications/Visual Studio Code.app" "$HOME/Applications/Visual Studio Code.app"; do
    [ -x "$a/Contents/Resources/app/bin/code" ] && { code="$a/Contents/Resources/app/bin/code"; break; }
  done
fi
if [ -n "$code" ]; then
  "$code" "${files[@]}" >/dev/null 2>&1 &
  printf 'VS Code: %s\n' "${files[@]}"
  exit $rc
fi

echo "No app is registered for the scriptorium: install a JetBrains IDE (PyCharm, IntelliJ IDEA, WebStorm, ...) for LightEdit, or VS Code" >&2
exit 3
