#!/bin/bash
# Opens files in PyCharm's LightEdit mode (`pycharm -e <file>`): the lightweight single-file
# editor, no project opened. Usage: open-file.sh <file>...
set -uo pipefail

[ $# -gt 0 ] || { echo "usage: open-file.sh <file>..." >&2; exit 2; }

# The launcher: `pycharm` on PATH, else an installed PyCharm*.app (also JetBrains Toolbox's).
launcher=$(command -v pycharm 2>/dev/null || true)
if [ -z "$launcher" ]; then
  for app in /Applications/PyCharm*.app "$HOME"/Applications/PyCharm*.app "$HOME"/Applications/*/PyCharm*.app; do
    [ -x "$app/Contents/MacOS/pycharm" ] && { launcher="$app/Contents/MacOS/pycharm"; break; }
  done
fi
[ -n "$launcher" ] || { echo "no PyCharm found: not on PATH, nor in /Applications or ~/Applications" >&2; exit 1; }

rc=0; files=()
for f in "$@"; do
  if [ ! -f "$f" ]; then echo "no such file: $f" >&2; rc=1; continue; fi
  files+=("$(cd "$(dirname "$f")" && pwd)/$(basename "$f")")
done
[ ${#files[@]} -gt 0 ] || exit 1
# One call for all the files (so they share one IDE), detached: the launcher blocks while it is
# the one that starts the IDE.
nohup "$launcher" -e "${files[@]}" >/dev/null 2>&1 &
printf 'PyCharm LightEdit: %s\n' "${files[@]}"
exit $rc
