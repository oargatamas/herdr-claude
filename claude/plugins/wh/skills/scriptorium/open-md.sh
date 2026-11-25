#!/bin/bash
# Shows a markdown file in a SCRIPTORIUM window, Herdr's floating markdown viewer (render, source,
# or both): writes {path, id} where the mod reads it, then opens the mod unless one is open
# (mod.open toggles); an open scriptorium opens a window of its own for each new file.
#   open-md.sh <file.md>
set -eu
f="${1:?usage: open-md.sh <markdown file>}"
[ -f "$f" ] || { echo "no such file: $f" >&2; exit 1; }
abs="$(cd "$(dirname "$f")" && pwd -P)/$(basename "$f")"
command -v herdr-app >/dev/null || { echo "herdr-app isn't on PATH: the scriptorium needs Herdr" >&2; exit 1; }
[ -d "$HOME/.config/herdr-app/mods/scriptorium" ] || { echo "the scriptorium mod isn't installed: run herdr-claude's install.sh" >&2; exit 1; }
D="$HOME/.local/share/herdr-claude"; mkdir -p "$D"
jq -cn --arg p "$abs" --arg id "$(date +%s)-$$" '{path: $p, id: $id}' > "$D/scriptorium"
if herdr-app status 2>/dev/null | jq -e '[.overlays[]? | tostring] | any(test("scriptorium"))' >/dev/null; then
  echo "scriptorium open: $abs gets a window of its own (or its open one, if it has one)"
else
  herdr-app do mod.open '{"name":"scriptorium"}'
  echo "scriptorium opened: $abs"
fi
