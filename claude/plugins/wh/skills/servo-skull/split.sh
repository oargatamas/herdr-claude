#!/bin/bash
# Opens a new Claude session in a Herdr split next to the calling terminal.
#   split.sh [right|down] [--model M] [--effort E] [--folder DIR] [--fork] [--child] [--profile company|personal] [-- <claude args>...]
#     right|down  where the split goes (default: right)
#     --model     an alias (haiku, sonnet, opus, fable) or a full model name
#     --effort    low | medium | high | xhigh | max
#     --folder    folder Claude starts in (default: the current directory)
#     --fork      resume this terminal's Claude conversation as a fork (--resume <id> --fork-session)
#     --child     start it as an hc child of this terminal (SERVITORS nests it under this one) and
#                 then give it the split; for workers that report back (wh:augment's skulls).
#                 It outlives this terminal and types no exit note into it.
#     --profile   Claude profile; default: claude-ws detects it from the workspace
#                 (with --child: this terminal's herdr.profile, else claude-ws detects it)
#     -- ...      passed to claude, e.g. -- "Look at the login bug" for a first prompt
# Prints {"pane": ..., "terminal": ...} on success.
set -euo pipefail

die() { echo "split: $*" >&2; exit 1; }
me="${HC_TERMINAL_ID:-}"
[ -n "$me" ] || die "not inside a Herdr terminal (HC_TERMINAL_ID is unset)"
herdr-app status >/dev/null 2>&1 || die "the Herdr window isn't running"

direction=right folder="$PWD" fork=0 child=0 model="" effort="" ws_args=()
while [ $# -gt 0 ]; do
  case "$1" in
    right|down) direction="$1"; shift ;;
    --model) model="$2"; shift 2 ;;
    --effort) effort="$2"; shift 2 ;;
    --folder) folder="$2"; shift 2 ;;
    --fork) fork=1; shift ;;
    --child) child=1; shift ;;
    --profile) ws_args+=(--profile "$2"); shift 2 ;;
    --) shift; break ;;
    *) die "unknown argument: $1" ;;
  esac
done
[ -d "$folder" ] || die "$folder is not a folder"
folder=$(cd "$folder" && pwd)
case "$effort" in ""|low|medium|high|xhigh|max) ;; *) die "--effort: low, medium, high, xhigh or max" ;; esac
[[ "$model" =~ ^[A-Za-z0-9._-]*$ ]] || die "--model: an alias (haiku, sonnet, opus, fable) or a model name"

claude_args=()
[ -n "$model" ] && claude_args+=(--model "$model")
[ -n "$effort" ] && claude_args+=(--effort "$effort")
if [ "$fork" = 1 ]; then
  session=$(hc get "$me" --json | jq -r '.labels["herdr.claude-session"] // empty')
  [ -n "$session" ] || die "this terminal has no herdr.claude-session label to fork"
  claude_args+=(--resume "$session" --fork-session)
fi
claude_args+=("$@")

pane=$(herdr-app ls | jq -r --arg t "$me" '[.. | objects | select(.terminal? == $t) | .pane] | first // empty')
[ -n "$pane" ] || die "no pane shows terminal $me"

if [ "$child" = 0 ]; then
  # pane.split takes no folder, so a login shell changes into it and execs claude-ws.
  cmd="cd $(printf %q "$folder") && exec $(printf %q "$HOME/.local/bin/claude-ws")"
  for a in ${ws_args[@]+"${ws_args[@]}"} --; do cmd+=" $(printf %q "$a")"; done
  for a in ${claude_args[@]+"${claude_args[@]}"}; do cmd+=" $(printf %q "$a")"; done
  argv=$(jq -cn --arg c "$cmd" '["/bin/zsh", "-lc", $c]')
  herdr-app do pane.split --direction "$direction" --pane "$pane" --argv "$argv"
  exit 0
fi

# --child: a terminal from pane.split has no hc parent, and hc sets one only at start. So start
# Claude with hc run (parent: this terminal), then have Herdr keep it in a split beside this pane,
# as hc-worker's place_split does. No herdr.* labels at start: a tab label would make a column.
# claude-ws can't detect the profile before Herdr labels it, so pass this terminal's.
if [ ${#ws_args[@]} -eq 0 ]; then
  p=$(hc get "$me" --json | jq -r '.labels["herdr.profile"] // empty')
  [ -n "$p" ] && ws_args=(--profile "$p")
fi
addr=$(hc run --bg --json --parent "$me" --outlive-parent --no-notify --cwd "$folder" \
  --label "servo-skull.parent=$me" -- \
  "$HOME/.local/bin/claude-ws" ${ws_args[@]+"${ws_args[@]}"} -- ${claude_args[@]+"${claude_args[@]}"} | jq -r .address)
[ -n "$addr" ] && [ "$addr" != null ] || die "hc run didn't start Claude"

before=$(herdr-app status | jq -r '.focused_pane // empty')
kept=0
# terminal.keep splits the focused pane, and is refused until Herdr has registered the terminal.
for _ in $(seq 30); do
  herdr-app do pane.focus --pane "$pane" >/dev/null 2>&1 || true
  if herdr-app do terminal.keep --terminal "$addr" --place "$direction" >/dev/null 2>&1; then kept=1; break; fi
  sleep 0.2
done
new_pane=""
if [ "$kept" = 1 ]; then
  for _ in $(seq 30); do   # keep is acknowledged before the pane exists
    new_pane=$(herdr-app ls | jq -r --arg t "$addr" '[.. | objects | select(.terminal? == $t) | .pane] | first // empty')
    [ -n "$new_pane" ] && break
    sleep 0.1
  done
fi
if [ -n "$before" ]; then herdr-app do pane.focus --pane "$before" >/dev/null 2>&1 || herdr-app do pane.focus --pane "$pane" >/dev/null 2>&1 || true
else herdr-app do pane.focus --pane "$pane" >/dev/null 2>&1 || true; fi
if [ -z "$new_pane" ]; then
  jq -cn --arg t "$addr" '{error: "Herdr gave the child no pane; it runs as a sub-agent without one (hc kill it to end it)", terminal: $t}'
  exit 1
fi
jq -cn --arg p "$new_pane" --arg t "$addr" '{pane: $p, terminal: $t}'
