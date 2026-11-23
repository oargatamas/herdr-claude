#!/bin/bash
# Installs (or updates) the Herdr + Claude Code customizations from this repository.
# Safe to run again: it replaces its own files, merges into shared ones, and never removes
# anything it didn't install. Backups of every settings file it changes go next to them.
#
#   ./install.sh [--force-keys] [--no-herdr] [--no-switch]
#     --force-keys  take over a Herdr key that is already bound to something else
#     --no-herdr    only the Claude Code part (no Herdr app on this machine)
#     --no-switch   don't switch the running Herdr window to the main-profile layout
#
# Claude profiles: every folder in $CLAUDE_PROFILES (default: ~/.claude, plus
# ~/.claude-personal when it exists). Run again after creating a new profile.
set -euo pipefail

REPO="$(cd "$(dirname "$0")" && pwd)"
FORCE_KEYS=0 HERDR=1 SWITCH=1
for a in "$@"; do
  case "$a" in
    --force-keys) FORCE_KEYS=1 ;;
    --no-herdr) HERDR=0 ;;
    --no-switch) SWITCH=0 ;;
    *) echo "unknown option $a" >&2; exit 2 ;;
  esac
done

STAMP=$(date +%Y%m%d%H%M%S)
say()  { printf '\033[1m%s\033[0m\n' "$*"; }
ok()   { printf '  ✓ %s\n' "$*"; }
warn() { printf '  ! %s\n' "$*"; WARNINGS=$((WARNINGS+1)); }
WARNINGS=0

backup() { [ -f "$1" ] && cp "$1" "$1.bak-herdr-claude-$STAMP" || true; }

say "Checking prerequisites"
for c in jq git; do command -v $c >/dev/null || { echo "  ✗ $c is required" >&2; exit 1; }; done
ok "jq, git"
command -v claude >/dev/null && ok "claude" || warn "claude not on PATH: install Claude Code first, then run this again"
if [ "$HERDR" = 1 ]; then
  command -v hc >/dev/null && ok "hc $(hc --version 2>/dev/null | awk '{print $2}')" || warn "hc (herdr-core) not on PATH: the hc-worker and claude-ws commands need it"
  command -v herdr-app >/dev/null && ok "herdr-app $(herdr-app --version 2>/dev/null | awk '{print $2}')" || warn "herdr-app not on PATH"
fi

# ---------------------------------------------------------------- commands
say "Commands → ~/.local/bin"
mkdir -p "$HOME/.local/bin"
for f in "$REPO"/bin/*; do install -m 0755 "$f" "$HOME/.local/bin/$(basename "$f")"; ok "$(basename "$f")"; done
case ":$PATH:" in *":$HOME/.local/bin:"*) ;; *) warn "~/.local/bin is not on PATH: add it in your shell profile" ;; esac

# ---------------------------------------------------------------- Claude Code
PROFILES=()
if [ -n "${CLAUDE_PROFILES:-}" ]; then
  for p in $CLAUDE_PROFILES; do PROFILES+=("${p/#\~/$HOME}"); done
else
  PROFILES=("$HOME/.claude"); [ -d "$HOME/.claude-personal" ] && PROFILES+=("$HOME/.claude-personal")
fi
MAIN="${PROFILES[0]}"

say "Claude Code hook and status-line scripts → $MAIN"
mkdir -p "$MAIN"
for f in statusline-account.sh herdr-profile-label.sh; do install -m 0755 "$REPO/claude/$f" "$HOME/.claude/$f"; ok "$f"; done

say "Skill hc-parallel-dev"
mkdir -p "$MAIN/skills"; rm -rf "$MAIN/skills/hc-parallel-dev"; cp -R "$REPO/claude/skills/hc-parallel-dev" "$MAIN/skills/"
ok "$MAIN/skills/hc-parallel-dev"
for p in "${PROFILES[@]:1}"; do
  mkdir -p "$p/skills"; rm -rf "$p/skills/hc-parallel-dev"; ln -s "$MAIN/skills/hc-parallel-dev" "$p/skills/hc-parallel-dev"
  ok "$p/skills/hc-parallel-dev → $MAIN/skills/hc-parallel-dev"
done

say "CLAUDE.md (a marked block; the rest of the file is left as it is)"
BEGIN="<!-- herdr-claude:begin (managed by herdr-claude/install.sh; edit the repo, not this block) -->"
END="<!-- herdr-claude:end -->"
BLOCK="$(printf '%s\n%s\n%s' "$BEGIN" "$(cat "$REPO/claude/CLAUDE.md")" "$END")"
DONE_MD=""
for p in "${PROFILES[@]}"; do
  md="$p/CLAUDE.md"
  real="$md"   # one file linked into several profiles is updated once
  if [ -L "$md" ]; then t=$(readlink "$md"); case "$t" in /*) real="$t" ;; *) real="$(dirname "$md")/$t" ;; esac; fi
  case " $DONE_MD " in *" $real "*) ok "$md (same file as one already done)"; continue ;; esac
  DONE_MD="$DONE_MD $real"
  if [ ! -e "$md" ] || cmp -s "$md" "$REPO/claude/CLAUDE.md"; then
    printf '%s\n' "$BLOCK" > "$md"; ok "$md (written)"
  elif grep -qF "herdr-claude:begin" "$md"; then
    backup "$md"
    # The block comes in through the environment: macOS awk rejects newlines in -v values.
    BLOCK="$BLOCK" awk '/herdr-claude:begin/{print ENVIRON["BLOCK"]; skip=1; next} /herdr-claude:end/{skip=0; next} !skip' "$md" > "$md.tmp"
    mv "$md.tmp" "$md"
    ok "$md (block updated)"
  else
    backup "$md"; printf '\n%s\n' "$BLOCK" >> "$md"; ok "$md (block appended)"
  fi
done

say "Claude Code settings (status line, hooks, permissions)"
FRAG="$REPO/claude/settings.fragment.json"
for p in "${PROFILES[@]}"; do
  s="$p/settings.json"; [ -f "$s" ] || echo '{}' > "$s"
  backup "$s"
  ours=$(jq -r '.statusLine.command' "$FRAG"); theirs=$(jq -r '.statusLine.command // empty' "$s")
  if [ -n "$theirs" ] && [ "$theirs" != "$ours" ]; then
    warn "$s already has a different status line ($theirs): left as it is"
    set_status=false
  else
    set_status=true
  fi
  jq --slurpfile f "$FRAG" --argjson set_status "$set_status" '
    def addhook($ev):
      ($f[0].hooks[$ev][0]) as $entry
      | .hooks[$ev] = ((.hooks[$ev] // []) as $a
          | if ([$a[].hooks[]?.command] | index($entry.hooks[0].command)) then $a else $a + [$entry] end);
    (if $set_status then .statusLine = $f[0].statusLine else . end)
    | .hooks = (.hooks // {}) | addhook("SessionStart") | addhook("SessionEnd")
    | .permissions.allow = (((.permissions.allow // []) + $f[0].permissions.allow) | unique)
    | .permissions.deny  = (((.permissions.deny  // []) + $f[0].permissions.deny)  | unique)
  ' "$s" > "$s.tmp"
  mv "$s.tmp" "$s"
  ok "$s"
done

if [ ! -d "$HOME/.claude-personal" ]; then
  warn "no personal profile (~/.claude-personal). To add one: CLAUDE_CONFIG_DIR=~/.claude-personal claude  (log in), then run this again"
fi
grep -qs "claude-personal" "$HOME/.zshrc" "$HOME/.bashrc" 2>/dev/null \
  || warn "no claude-personal alias found; optional: alias claude-personal='CLAUDE_CONFIG_DIR=~/.claude-personal claude'"

# ---------------------------------------------------------------- Herdr
if [ "$HERDR" = 1 ]; then
  H="$HOME/.config/herdr-app"
  if [ ! -f "$H/keys.json" ]; then
    warn "Herdr isn't set up here yet ($H/keys.json missing): start Herdr once, then run this again (or use --no-herdr)"
  else
    say "Herdr mods and layout → $H"
    built=$(jq -r '.cloned_from.version // empty' "$REPO/herdr/layouts/main-profile.json")
    have=$(herdr-app --version 2>/dev/null | awk '{print $2}' || true)
    if [ -n "$have" ] && [ -n "$built" ] && [ "$have" != "$built" ]; then
      warn "these copies of Herdr's sidebar, tab bar and help were made from Herdr $built; this is $have. If anything looks off, re-copy them (see README: Herdr updates)"
    fi
    for m in "$REPO"/herdr/mods/*/; do
      name=$(basename "$m"); rm -rf "$H/mods/$name"; cp -R "$m" "$H/mods/$name"
    done
    for d in claude-fork claude-fork-left claude-fork-right claude-fork-up claude-fork-down; do cp "$REPO/herdr/shared/fork.js" "$H/mods/$d/"; done
    for d in spaces-profile tabs-profile; do cp "$REPO/herdr/shared/profile.js" "$H/mods/$d/"; done
    ok "mods: $(ls "$REPO/herdr/mods" | tr '\n' ' ')"
    cp "$REPO/herdr/layouts/main-profile.json" "$H/layouts/main-profile.json"; ok "layout main-profile"
    mkdir -p "$H/themes"; cp "$REPO"/herdr/themes/*.json "$H/themes/"; ok "themes: $(ls "$REPO/herdr/themes" | tr '\n' ' ')"
    mkdir -p "$H/backgrounds"; cp "$REPO"/herdr/backgrounds/* "$H/backgrounds/"; ok "backgrounds: $(ls "$REPO/herdr/backgrounds" | tr '\n' ' ')"

    say "Herdr keys"
    frag=$(sed "s|__HOME__|$HOME|g" "$REPO/herdr/keys.fragment.json")
    conflicts=$(jq -r --argjson f "$frag" '.global as $g | $f.global | to_entries[]
      | select($g[.key] != null and $g[.key] != .value) | "\(.key) (now: \($g[.key] | tostring))"' "$H/keys.json")
    if [ -n "$conflicts" ] && [ "$FORCE_KEYS" = 0 ]; then
      while IFS= read -r c; do warn "key $c is bound to something else: skipped (--force-keys to take it)"; done <<<"$conflicts"
    fi
    backup "$H/keys.json"
    jq --argjson f "$frag" --argjson force "$FORCE_KEYS" '
      .global as $g
      | .global += ($f.global | with_entries(select($force == 1 or $g[.key] == null or $g[.key] == .value)))
    ' "$H/keys.json" > "$H/keys.json.tmp"
    mv "$H/keys.json.tmp" "$H/keys.json"
    ok "keys.json"

    [ -f "$H/programs.json" ] || echo '{}' > "$H/programs.json"
    backup "$H/programs.json"
    jq --slurpfile f "$REPO/herdr/programs.fragment.json" '
      .programs = ((.programs // {}) + ($f[0].programs // {}))
      | .interpreters = (((.interpreters // []) + ($f[0].interpreters // [])) | unique)
    ' "$H/programs.json" > "$H/programs.json.tmp"
    mv "$H/programs.json.tmp" "$H/programs.json"
    ok "programs.json"

    if command -v herdr-app >/dev/null; then
      say "Checking mods"
      for m in "$REPO"/herdr/mods/*/; do
        name=$(basename "$m")
        if herdr-app check "$H/mods/$name" >/dev/null 2>&1; then ok "$name"; else warn "$name failed: herdr-app check $H/mods/$name"; fi
      done
      sleep 1
      for e in keys layout settings programs; do [ -f "$H/$e.error" ] && warn "Herdr rejected $e: see $H/$e.error"; done
      if [ "$SWITCH" = 1 ] && herdr-app status >/dev/null 2>&1; then
        herdr-app do layout.switch --name main-profile >/dev/null && ok "Herdr switched to the main-profile layout (cmd-shift-l switches layouts)"
      else
        echo "  → to show the profile badges: herdr-app do layout.switch --name main-profile"
      fi
    fi
  fi
fi

say "Done$([ "$WARNINGS" -gt 0 ] && echo ", with $WARNINGS warning(s) above")."
echo "  New Claude sessions pick up the hooks, status line, skill and permissions."
echo "  Sessions already running: restart them once (so their session id is recorded for forks)."
