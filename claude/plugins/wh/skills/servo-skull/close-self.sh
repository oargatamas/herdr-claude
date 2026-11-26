#!/bin/bash
# A servo-skull closes itself after its report: closes the pane showing its terminal
# ($HC_TERMINAL_ID), which hangs up its Claude; without a pane, hc kill ends it.
# Detached and a moment late, so the command that ran it (its report) returns first.
set -uo pipefail
me="${HC_TERMINAL_ID:-}"
[ -n "$me" ] || { echo "close-self: not inside a Herdr terminal (HC_TERMINAL_ID is unset)" >&2; exit 1; }
(
  sleep 1
  pane=$(herdr-app ls 2>/dev/null | jq -r --arg t "$me" '[.. | objects | select(.terminal? == $t) | .pane] | first // empty')
  if [ -n "$pane" ] && herdr-app do pane.close --pane "$pane" >/dev/null 2>&1; then exit 0; fi
  hc kill "$me" >/dev/null 2>&1
) </dev/null >/dev/null 2>&1 &
disown
echo "closing $me"
