#!/bin/bash
# Shows a markdown file in the SCRIPTORIUM, Herdr's floating window with the file's source beside
# its render: writes the file's absolute path where the mod reads it, then opens the mod unless
# it is already open (mod.open toggles, and an open one follows the path by itself).
#   open-md.sh <file.md>
set -eu
f="${1:?usage: open-md.sh <markdown file>}"
[ -f "$f" ] || { echo "no such file: $f" >&2; exit 1; }
abs="$(cd "$(dirname "$f")" && pwd -P)/$(basename "$f")"
command -v herdr-app >/dev/null || { echo "herdr-app isn't on PATH: the scriptorium needs Herdr" >&2; exit 1; }
[ -d "$HOME/.config/herdr-app/mods/scriptorium" ] || { echo "the scriptorium mod isn't installed: run herdr-claude's install.sh" >&2; exit 1; }
D="$HOME/.local/share/herdr-claude"; mkdir -p "$D"; printf '%s\n' "$abs" > "$D/scriptorium"
if herdr-app status 2>/dev/null | jq -e '[.overlays[]? | tostring] | any(test("scriptorium"))' >/dev/null; then
  echo "scriptorium already open: now showing $abs"
else
  herdr-app do mod.open '{"name":"scriptorium"}'
  echo "scriptorium opened: $abs"
fi
