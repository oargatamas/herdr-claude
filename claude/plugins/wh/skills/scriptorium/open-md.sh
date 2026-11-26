#!/bin/bash
# Shows a file in a SCRIPTORIUM window, Herdr's floating file viewer: a markdown file (.md,
# .markdown) with its render, source or both; any other text file as a simple read-only text window. By default it goes to the SCRIPTORIUM window: a second Herdr window with a home of its
# own (~/.local/share/herdr-claude/scriptorium-window, set up by install.sh), blank but for the
# data-slates floating in it, so it can sit on another display; started here when it isn't
# running. --here: in the person's own Herdr window instead.
# Writes {path, id} to that window's request file (<home>/scriptorium-request), then opens the mod
# there unless one is open (mod.open toggles); an open scriptorium opens a window of its own for
# each new file.
#   open-md.sh [--here] <file>
set -eu
here=0
[ "${1:-}" = "--here" ] && { here=1; shift; }
f="${1:?usage: open-md.sh [--here] <file>}"
[ -f "$f" ] || { echo "no such file: $f" >&2; exit 1; }
abs="$(cd "$(dirname "$f")" && pwd -P)/$(basename "$f")"
command -v herdr-app >/dev/null || { echo "herdr-app isn't on PATH: the scriptorium needs Herdr" >&2; exit 1; }
SH="$HOME/.local/share/herdr-claude/scriptorium-window"
if [ "$here" = 0 ] && [ ! -d "$SH/mods/scriptorium" ]; then
  echo "the SCRIPTORIUM window isn't set up (herdr-claude's install.sh does it): using this Herdr window" >&2
  here=1
fi

if [ "$here" = 1 ]; then
  export HERDR_APP_HOME="${HERDR_APP_HOME:-$HOME/.config/herdr-app}"
  where="this Herdr window"
  [ -d "$HERDR_APP_HOME/mods/scriptorium" ] || { echo "the scriptorium mod isn't installed: run herdr-claude's install.sh" >&2; exit 1; }
else
  export HERDR_APP_HOME="$SH"
  where="the SCRIPTORIUM window"
  if ! herdr-app status >/dev/null 2>&1; then
    # Its own Herdr process (same app, same herdr-core), detached from this shell.
    (nohup herdr-app >/dev/null 2>&1 &)
    for _ in $(seq 1 60); do herdr-app status >/dev/null 2>&1 && break; sleep 0.25; done
    herdr-app status >/dev/null 2>&1 || { echo "the SCRIPTORIUM window didn't start: try HERDR_APP_HOME=$SH herdr-app" >&2; exit 1; }
    herdr-app do overlay.close '{"id":"frame-welcome"}' >/dev/null 2>&1 || true # a new home's welcome
    where="the SCRIPTORIUM window (started)"
  fi
  # Its blank desk, never terminals: a layout showing tabs would resize the person's terminals.
  if [ "$(herdr-app status | jq -r '.layout // empty')" != scriptorium ]; then
    herdr-app do layout.switch --name scriptorium >/dev/null
  fi
fi

jq -cn --arg p "$abs" --arg id "$(date +%s)-$$" '{path: $p, id: $id}' > "$HERDR_APP_HOME/scriptorium-request"
if herdr-app status 2>/dev/null | jq -e '[.overlays[]? | tostring] | any(test("scriptorium"))' >/dev/null; then
  echo "scriptorium open in $where: $abs gets a window of its own (or its open one, if it has one)"
else
  herdr-app do mod.open '{"name":"scriptorium"}' >/dev/null
  echo "scriptorium opened in $where: $abs"
fi
