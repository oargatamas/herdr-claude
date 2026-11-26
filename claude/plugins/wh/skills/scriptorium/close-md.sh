#!/bin/bash
# Closes data-slates of a SCRIPTORIUM: the one of a file, or all of them. By default in the
# SCRIPTORIUM window; --here: in the person's own Herdr window. Herdr can't close a mod's overlay
# by its key (status lists only "scriptorium"), so it writes {id, at, all, paths} to that window's
# close request file (<home>/scriptorium-close); each open data-slate reads it within a second and
# closes itself if its file is named (or all). Never touches the files shown.
#   close-md.sh [--here] <file>... | --all
set -eu
here=0
[ "${1:-}" = "--here" ] && { here=1; shift; }
[ $# -ge 1 ] || { echo "usage: close-md.sh [--here] <file>... | --all" >&2; exit 1; }
command -v herdr-app >/dev/null || { echo "herdr-app isn't on PATH: the scriptorium needs Herdr" >&2; exit 1; }
SH="$HOME/.local/share/herdr-claude/scriptorium-window"
if [ "$here" = 1 ]; then
  home="${HERDR_APP_HOME:-$HOME/.config/herdr-app}"
  where="this Herdr window"
else
  home="$SH"
  where="the SCRIPTORIUM window"
fi
[ -d "$home/mods/scriptorium" ] || { echo "the scriptorium mod isn't installed there: run herdr-claude's install.sh" >&2; exit 1; }
export HERDR_APP_HOME="$home"
if ! herdr-app status >/dev/null 2>&1; then echo "$where isn't running: no data-slates to close"; exit 0; fi
all=false; paths='[]'
if [ "$1" = "--all" ]; then
  all=true
else
  for f in "$@"; do
    d="$(cd "$(dirname "$f")" 2>/dev/null && pwd -P)" || d="$(dirname "$f")"
    paths="$(jq -c --arg p "$d/$(basename "$f")" '. + [$p]' <<<"$paths")"
  done
fi
jq -cn --argjson all "$all" --argjson paths "$paths" --arg id "$(date +%s)-$$" \
  '{id: $id, at: (now * 1000 | floor), all: $all, paths: $paths}' > "$home/scriptorium-close"
if [ "$all" = true ]; then echo "closing every data-slate in $where"; else echo "closing in $where: $*"; fi
