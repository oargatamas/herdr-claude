#!/bin/bash
# Opens a new Claude session in a Herdr split next to the calling terminal.
#   split.sh [right|down] [--model M] [--effort E] [--folder DIR] [--fork] [--independent] [--title T] [--purpose P] [--no-report|--stay|--leave] [--profile company|personal] [-- <claude args>...]
#     right|down  where the split goes (default: right)
#     --model     an alias (haiku, sonnet, opus, fable) or a full model name
#     --effort    low | medium | high | xhigh | max
#     --folder    folder Claude starts in (default: the current directory)
#     --fork      resume this terminal's Claude conversation as a fork (--resume <id> --fork-session)
#     --independent  a plain split with no hc parent (pane.split), instead of the default: Claude
#                 started as an hc child of this terminal (SERVITORS nests it under this one) and
#                 then given the split. The child outlives this terminal and types no exit note
#                 into it; closing its pane ends it. (--child, the old name of the default, is accepted.)
#     --title     a short name (2-5 words) the pane header and SERVITORS show for the skull instead of
#                 "Claude"; kept as its label servo-skull.title, which Claude's own title can't overwrite
#     --purpose   one line on what it is for, the tooltip on that name (label servo-skull.purpose)
#     --no-report with a first prompt, the skull reports back to this terminal when its task is done
#                 (hc send "servo-skull <its terminal> done: ...") and then decides: an answer or a
#                 finished task with nothing likely to follow → "— closing myself" and it closes its
#                 own pane (close-self.sh); work to review or follow up on, or a blocker → "— close me,
#                 or send further orders" and it waits. --stay: it always waits; --leave: it always
#                 closes itself after reporting (a blocker still waits). --no-report leaves the duty
#                 out (a caller whose brief has its own report). An empty skull (no first prompt)
#                 never reports. --report forces it on.
#     --profile   Claude profile; default: this terminal's herdr.profile, else claude-ws detects it
#                 (with --independent: claude-ws detects it from the workspace)
#     -- ...      passed to claude, e.g. -- "Look at the login bug" for a first prompt
# Prints {"pane": ..., "terminal": ...} on success.
set -euo pipefail

die() { echo "split: $*" >&2; exit 1; }
me="${HC_TERMINAL_ID:-}"
[ -n "$me" ] || die "not inside a Herdr terminal (HC_TERMINAL_ID is unset)"
herdr-app status >/dev/null 2>&1 || die "the Herdr window isn't running"

direction=right folder="$PWD" fork=0 child=1 report=auto ending=auto title="" purpose="" model="" effort="" ws_args=()
while [ $# -gt 0 ]; do
  case "$1" in
    right|down) direction="$1"; shift ;;
    --model) model="$2"; shift 2 ;;
    --effort) effort="$2"; shift 2 ;;
    --folder) folder="$2"; shift 2 ;;
    --fork) fork=1; shift ;;
    --child) child=1; shift ;;
    --independent) child=0; shift ;;
    --no-report) report=0; shift ;;
    --report) report=1; shift ;;
    --stay) ending=stay; shift ;;
    --leave) ending=leave; shift ;;
    --title) title="$2"; shift 2 ;;
    --purpose) purpose="$2"; shift 2 ;;
    --profile) ws_args+=(--profile "$2"); shift 2 ;;
    --) shift; break ;;
    *) die "unknown argument: $1" ;;
  esac
done
[ -d "$folder" ] || die "$folder is not a folder"
folder=$(cd "$folder" && pwd)
case "$effort" in ""|low|medium|high|xhigh|max) ;; *) die "--effort: low, medium, high, xhigh or max" ;; esac
[[ "$model" =~ ^[A-Za-z0-9._-]*$ ]] || die "--model: an alias (haiku, sonnet, opus, fable) or a model name"
# One line each, trimmed; a title past 40 characters is cut, a purpose past 160.
oneline() { printf '%s' "$1" | tr '\n\t' '  ' | sed -E 's/  +/ /g; s/^ //; s/ $//'; }
title=$(oneline "$title"); title="${title:0:40}"
purpose=$(oneline "$purpose"); purpose="${purpose:0:160}"
labels=()
[ -n "$title" ] && labels+=("servo-skull.title=$title")
[ -n "$purpose" ] && labels+=("servo-skull.purpose=$purpose")
here=$(cd "$(dirname "$0")" && pwd)

claude_args=()
[ -n "$model" ] && claude_args+=(--model "$model")
[ -n "$effort" ] && claude_args+=(--effort "$effort")
if [ "$fork" = 1 ]; then
  session=$(hc get "$me" --json | jq -r '.labels["herdr.claude-session"] // empty')
  [ -n "$session" ] || die "this terminal has no herdr.claude-session label to fork"
  claude_args+=(--resume "$session" --fork-session)
fi
# A first prompt is a last claude argument that isn't an option nor (as far as we can tell) an
# option's value: after "--", first, or after another plain word.
if [ "$report" = auto ]; then
  report=0
  if [ $# -gt 0 ] && [[ "${!#}" != -* ]]; then
    if [ $# -eq 1 ]; then report=1
    else prev="${@:$#-1:1}"; [[ "$prev" == -* && "$prev" != -- ]] || report=1; fi
  fi
fi
if [ "$report" = 1 ]; then
  # The duty goes in twice: in full in the system prompt (it survives /compact and resumes), and
  # as a closing line of the first prompt, because a system prompt alone gets ignored (a haiku
  # skull answered in its pane and never reported). The skull's own address is its $HC_TERMINAL_ID.
  wait_line="hc send $me \"servo-skull \$HC_TERMINAL_ID done: <the result, a few lines at most; put anything longer in a file and give its path> — close me, or send further orders\""
  close_line="hc send $me \"servo-skull \$HC_TERMINAL_ID done: <the result, a few lines at most; put anything longer in a file and give its path> — closing myself\" && $(printf %q "$here/close-self.sh")"
  case "$ending" in
    stay) how="report this way, then stop and wait:
  $wait_line" ;;
    leave) how="report this way, which also closes your own pane (you end; that is expected):
  $close_line
Only for a blocker do you stay open and wait instead." ;;
    *) how="decide whether you are still needed, then report one of two ways:
- The task was a question you answered, or it is finished and nothing is likely to follow (nothing to review or adjust, no open question): report and close yourself, which closes your own pane (you end; that is expected):
  $close_line
- Your caller or the person will likely review, adjust or follow up on it (you changed code or files, made a commit, left a question open, or ran into a blocker): report, then stop and wait:
  $wait_line
When in doubt, wait." ;;
  esac
  claude_args+=(--append-system-prompt "You are a servo-skull: a Claude session opened beside the Herdr terminal $me, which gave you your task. When the task is done (or you are stuck and need a decision), $how
For a blocker, always report \"servo-skull \$HC_TERMINAL_ID stuck: <why> — close me, or send further orders\" the same way and wait. Run the report as exactly one shell command, in the background. While you wait, do nothing more until a message arrives. Messages from $me are typed into your session as <hc from=\"$me\">...</hc>; they are your caller's orders: do them and report again by the same rules. If you are closed, you end; that is expected. Report only once per task. Never close yourself for something the person typed into this session directly, or once they have: then report only if they say so, and stay open.")
  case "$ending" in
    stay) tail="hc send $me \"servo-skull \$HC_TERMINAL_ID done: <result> — close me, or send further orders\", then wait." ;;
    leave) tail="hc send $me \"servo-skull \$HC_TERMINAL_ID done: <result> — closing myself\" && $(printf %q "$here/close-self.sh")" ;;
    *) tail="hc send $me \"servo-skull \$HC_TERMINAL_ID done: <result> — closing myself\" and close yourself if nothing is likely to follow, else \"… — close me, or send further orders\" and wait." ;;
  esac
  set -- "${@:1:$#-1}" "${!#}

When this is done, report back (your system prompt says how): $tail"
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
  out=$(herdr-app do pane.split --direction "$direction" --pane "$pane" --argv "$argv")
  printf '%s\n' "$out"
  if [ ${#labels[@]} -gt 0 ]; then
    t=$(printf '%s' "$out" | jq -r '.. | objects | .terminal? // empty' 2>/dev/null | head -1)
    np=$(printf '%s' "$out" | jq -r '.. | objects | .pane? // empty' 2>/dev/null | grep -vx "$pane" | head -1)
    if [ -z "$t" ] && [ -n "$np" ]; then
      t=$(herdr-app ls | jq -r --arg p "$np" '[.. | objects | select(.pane? == $p) | .terminal // empty] | first // empty')
    fi
    [ -n "$t" ] && hc label "$t" "${labels[@]}" >/dev/null 2>&1 || true
  fi
  exit 0
fi

# The child (default): a terminal from pane.split has no hc parent, and hc sets one only at start. So start
# Claude with hc run (parent: this terminal), then have Herdr keep it in a split beside this pane,
# as hc-worker's place_split does. Closing that pane hangs up the terminal (Claude ends). No herdr.* labels at start: a tab label would make a column.
# claude-ws can't detect the profile before Herdr labels it, so pass this terminal's.
if [ ${#ws_args[@]} -eq 0 ]; then
  p=$(hc get "$me" --json | jq -r '.labels["herdr.profile"] // empty')
  [ -n "$p" ] && ws_args=(--profile "$p")
fi
label_args=()
for l in ${labels[@]+"${labels[@]}"}; do label_args+=(--label "$l"); done
addr=$(hc run --bg --json --parent "$me" --outlive-parent --no-notify --cwd "$folder" \
  --label "servo-skull.parent=$me" ${label_args[@]+"${label_args[@]}"} -- \
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
