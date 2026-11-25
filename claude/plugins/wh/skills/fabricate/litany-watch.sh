#!/bin/bash
# Waits until the DATA-LITANY (AUSPEX) has an open todo that isn't on the skipped list, then
# prints "<line>\t<text>" for the first one and exits. Run it in the background; it never
# changes anything.
#   litany-watch.sh [seconds between looks, default 5]
set -u
D="$HOME/.local/share/herdr-claude"; F="$D/todos.md"; S="$D/litany-skipped"
while :; do
  if [ -f "$F" ]; then
    hit=$(awk -v skip="$S" '
      BEGIN { while ((getline l < skip) > 0) sk[l] = 1 }
      match($0, /^[[:space:]]*[-*] \[ \] /) { t = substr($0, RLENGTH + 1); if (!(t in sk)) { print NR "\t" t; exit } }
    ' "$F")
    [ -n "$hit" ] && { printf '%s\n' "$hit"; exit 0; }
  fi
  sleep "${1:-5}"
done
