# Environment: Herdr + herdr-core

When `$HC_TERMINAL_ID` is set, this session runs in a Herdr terminal:

- `hc` (herdr-core) runs terminals and agents: start, read, message (`hc send`), wait (`hc wait`)
  and interrupt them. `$HC_TERMINAL_ID` is this terminal's address. Read `hc --skill` before
  using it for anything beyond a single command.
- `herdr-app do <command>` drives the Herdr window (spaces, tabs, panes); `herdr-app --skill`
  is its manual. Pass explicit ids (`--pane`, `--terminal`, `--id`): focus may be elsewhere.
- Prefer `hc run --bg` + `hc wait` over blocking shell calls for slow work (builds, test
  suites, CI watches), so this session stays reachable.
- Never answer another session's dialogs (permissions, trust, login) with `hc keys` or
  forced sends: tell the person which tab needs them.

Custom commands (in `~/.local/bin`):

- `claude-ws [left|up] [--profile company|personal] [-- <claude args>]`: Claude with this
  workspace's profile (company = `~/.claude`, personal = `~/.claude-personal`).
- `hc-worker start|list|stop`: parallel workers in Herdr subtabs and git worktrees. For
  splitting work across agents, use the `hc-parallel-dev` skill, which drives it.

Each Claude terminal carries the labels `herdr.profile` and `herdr.claude-session` (set by a
SessionStart hook); `claude --resume <session> --fork-session` forks a conversation.
