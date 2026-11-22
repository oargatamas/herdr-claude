#!/bin/bash
# Claude hook (both profiles): tags this Herdr terminal with the Claude profile and the
# session it runs, so the Herdr sidebar and tab bar can show a COMPANY / PERSONAL badge
# and cmd-shift-t (mods/claude-fork) can fork this conversation into a new tab.
#   herdr-profile-label.sh set    (SessionStart: also after /clear and /resume, with the new id)
#   herdr-profile-label.sh clear  (SessionEnd)
input=$(cat)
[ -n "$HC_TERMINAL_ID" ] || exit 0
command -v hc >/dev/null 2>&1 || exit 0

case "$CLAUDE_CONFIG_DIR" in
  *claude-personal*) profile=personal ;;
  *)                 profile=company ;;
esac

if [ "$1" = "clear" ]; then
  hc label "$HC_TERMINAL_ID" "herdr.profile=" "herdr.claude-session=" >/dev/null 2>&1
else
  session=$(jq -r '.session_id // empty' <<<"$input" 2>/dev/null)
  hc label "$HC_TERMINAL_ID" "herdr.profile=$profile" "herdr.claude-session=$session" >/dev/null 2>&1
fi
exit 0
