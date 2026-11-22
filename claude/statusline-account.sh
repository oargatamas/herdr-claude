#!/bin/bash
# Status line shared by both Claude profiles: which account this session uses.
input=$(cat)

if [ -n "$CLAUDE_CONFIG_DIR" ]; then
  account_file="${CLAUDE_CONFIG_DIR/#\~/$HOME}/.claude.json"
else
  account_file="$HOME/.claude.json"
fi

email=$(jq -r '.oauthAccount.emailAddress // empty' "$account_file" 2>/dev/null)
model=$(echo "$input" | jq -r '.model.display_name // empty')

case "$CLAUDE_CONFIG_DIR" in
  *claude-personal*) label="PERSONAL"; color="\033[1;35m" ;;  # magenta
  *)                 label="COMPANY";  color="\033[1;36m" ;;  # cyan
esac

line="${color}● ${label}\033[0m ${email:-not logged in}"
[ -n "$model" ] && line="$line \033[2m· $model\033[0m"
printf "%b" "$line"
