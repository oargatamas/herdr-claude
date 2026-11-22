# herdr-claude

My customizations for [Herdr](https://herdr.dev) and Claude Code: two Claude accounts (company
and personal) side by side, profile badges, Claude-aware split and fork shortcuts, and a skill
for parallel development with independent Claude workers coordinated through herdr-core (`hc`).

## Install on a new machine (with Claude)

Prerequisites: macOS, Herdr installed and started once, Claude Code, `jq`, `git`, and `gh`
signed in to the account that owns this (private) repository.

Ask Claude in a terminal on that machine:

> Clone github.com/oargatamas/herdr-claude into ~/projects/herdr-claude, read its README and
> install.sh, then run ./install.sh and tell me what it reported.

Or by hand:

```sh
gh repo clone oargatamas/herdr-claude ~/projects/herdr-claude
~/projects/herdr-claude/install.sh
```

### Notes for Claude when installing

- Read `install.sh` before running it. It only writes: `~/.local/bin/{claude-ws,hc-worker}`,
  `~/.claude/{statusline-account.sh,herdr-profile-label.sh}`, the `hc-parallel-dev` skill, a
  marked block in each profile's `CLAUDE.md`, merged entries in each profile's `settings.json`,
  and its own mods, layout and keys under `~/.config/herdr-app`. Backups:
  `*.bak-herdr-claude-<time>` next to every settings file it changes.
- Changing Claude's own `settings.json` (hooks, permissions) can be refused in auto mode. If so,
  don't work around it: give the person the command (`! ~/projects/herdr-claude/install.sh`)
  to run themselves.
- Report every `!` warning the script prints. Typical ones:
  - **Key already bound to something else**: ask the person; rerun with `--force-keys` only if
    they want the kit's binding.
  - **No personal profile**: the person creates it with `CLAUDE_CONFIG_DIR=~/.claude-personal claude`
    (and logs in), then the installer runs again.
  - **Herdr version differs**: see "Herdr updates" below.
- It's safe to run again; that is also how to update (`git pull && ./install.sh`).

## What you get

| Shortcut | What it does |
|---|---|
| `cmd-shift-n` | New Claude space: name it, pick Company or Personal |
| `cmd-shift-<arrow>` | New Claude session in a split, with the workspace's profile |
| `cmd-shift-t` | Fork the focused Claude conversation into a new tab |
| `cmd-ctrl-<arrow>` | Fork the focused Claude conversation into a split |
| `cmd-shift-h` | Keybinds dialog, Claude shortcuts first |

- **Profile everywhere**: Claude's status line shows `● COMPANY` / `● PERSONAL` and the account
  email; Herdr's sidebar and tab bar show a coloured badge for every space and tab running Claude
  (layout `main-profile`).
- **`hc-parallel-dev` skill**: "split this into workers" → plan, workers as splits beside the
  orchestrator (or tabs) in git worktrees, each on a model and effort the orchestrator picks from
  the task's complexity (`haiku`/`sonnet`/`opus`, `hc-worker start --model … --effort …`) (`hc-worker start`), coordination with `hc send` / `hc wait`, review, merge, cleanup
  (`hc-worker stop`, `hc-worker prune`).
- **`CLAUDE.md` block**: every session knows it runs in Herdr and about these commands.
- **Permissions**: `hc`, `herdr-app`, `hc-worker`, `claude-ws` run without prompts; `hc keys`
  (answering another session's dialogs) is denied.

Profiles: company = `~/.claude` (`claude`), personal = `~/.claude-personal`
(`CLAUDE_CONFIG_DIR=~/.claude-personal claude`, e.g. via an alias `claude-personal`).

## Layout of this repository

| Path | Installed to |
|---|---|
| `bin/claude-ws` | Starts Claude with a profile (detected from the workspace or given); moves a new split left/up |
| `bin/hc-worker` | `start` / `list` / `stop` / `prune` for parallel workers |
| `claude/statusline-account.sh` | Status line: profile and account |
| `claude/herdr-profile-label.sh` | SessionStart/End hook: labels the terminal with `herdr.profile` and `herdr.claude-session` |
| `claude/settings.fragment.json` | Merged into each profile's `settings.json` |
| `claude/CLAUDE.md` | Managed block in each profile's `CLAUDE.md` |
| `claude/skills/hc-parallel-dev/` | The skill (linked into every profile) |
| `herdr/mods/claude-space/` | The `cmd-shift-n` form |
| `herdr/mods/claude-fork*/` | Fork into a tab, or a split per direction (a shortcut can't pass arguments to a mod) |
| `herdr/shared/fork.js` | Copied into every `claude-fork*` mod (mods can't import across folders) |
| `herdr/mods/spaces-profile/`, `tabs-profile/` | Copies of Herdr's sidebar list and tab bar, with badges |
| `herdr/shared/profile.js` | The badge code, copied into both |
| `herdr/mods/help-plus/` | Copy of Herdr's keybinds dialog with the Claude section |
| `herdr/layouts/main-profile.json` | Copy of Herdr's `main` layout using the two copies above |
| `herdr/keys.fragment.json` | Our key bindings (`__HOME__` = home folder), merged into `keys.json` |
| `herdr/programs.fragment.json` | Shows `env …` launched programs by what they run |

## Making changes

Edit here, run `./install.sh`, check, commit, push. Then on other machines: `git pull && ./install.sh`.
Edits made directly in `~/.config/herdr-app` or `~/.claude` are overwritten by the next install.

## Herdr updates

`spaces-profile`, `tabs-profile`, `help-plus` and the `main-profile` layout are copies of
Herdr's shipped versions (see `cloned_from` in the layout). They don't get Herdr's later
improvements. When Herdr changes them, re-copy and re-apply the small changes:

1. `herdr-app do mod.clone '{"name":"spaces","as":"spaces-profile-new"}'` (and `tabs`, `help`,
   `layout.clone` for `main`), then port the changes, marked in the copies:
   - `spaces-profile` / `tabs-profile`: `import { profilesIn, badge } from "./profile.js"` and
     one `.children(profilesIn(...).map(...badge...))` line next to the name.
   - `help-plus`: the `CLAUDE` / `claudeLabel` / `command()` helpers and the `claude` group.
   - layout: `"mod": "spaces-profile"` and `"mod": "tabs-profile"`.
2. Replace the folders here, `./install.sh`, check, commit.
