#!/bin/bash
# Opens a new Claude session in a Herdr split next to the calling terminal.
#   split.sh [right|down] [--model M] [--effort E] [--folder DIR] [--fork] [--profile company|personal] [-- <claude args>...]
#     right|down  where the split goes (default: right)
#     --model     an alias (haiku, sonnet, opus, fable) or a full model name
#     --effort    low | medium | high | xhigh | max
#     --folder    folder Claude starts in (default: the current directory)
#     --fork      resume this terminal's Claude conversation as a fork (--resume <id> --fork-session)
#     --profile   Claude profile; default: claude-ws detects it from the workspace
#     -- ...      passed to claude, e.g. -- "Look at the login bug" for a first prompt
# Prints {"pane": ..., "terminal": ...} on success.
set -euo pipefail

die() { echo "split: $*" >&2; exit 1; }
me="${HC_TERMINAL_ID:-}"
[ -n "$me" ] || die "not inside a Herdr terminal (HC_TERMINAL_ID is unset)"
herdr-app status >/dev/null 2>&1 || die "the Herdr window isn't running"

direction=right folder="$PWD" fork=0 model="" effort="" ws_args=()
while [ $# -gt 0 ]; do
  case "$1" in
    right|down) direction="$1"; shift ;;
    --model) model="$2"; shift 2 ;;
    --effort) effort="$2"; shift 2 ;;
    --folder) folder="$2"; shift 2 ;;
    --fork) fork=1; shift ;;
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

# pane.split takes no folder, so a login shell changes into it and execs claude-ws.
cmd="cd $(printf %q "$folder") && exec $(printf %q "$HOME/.local/bin/claude-ws")"
for a in ${ws_args[@]+"${ws_args[@]}"} --; do cmd+=" $(printf %q "$a")"; done
for a in ${claude_args[@]+"${claude_args[@]}"}; do cmd+=" $(printf %q "$a")"; done
argv=$(jq -cn --arg c "$cmd" '["/bin/zsh", "-lc", $c]')

herdr-app do pane.split --direction "$direction" --pane "$pane" --argv "$argv"
