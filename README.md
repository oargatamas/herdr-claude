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

## How a worker's model is chosen

The orchestrating Claude chooses each worker's model and effort **by judgment, following the
rules in the `hc-parallel-dev` skill**. Nothing scores tasks automatically: `hc-worker` only
starts the worker on what it is told (`--model`, `--effort`).

1. While planning, the orchestrator writes each worker's task (goal, scope, interfaces, done)
   and asks: *how much must this worker figure out for itself*, and *how costly is a subtle
   mistake?*
2. It places the task in a tier:

   | Tier | Model / effort | For tasks that are |
   |---|---|---|
   | Light | `haiku` / `low` | Fully specified and mechanical: boilerplate from a pattern, renames, docs, simple tests, read-only lookups |
   | Standard | `sonnet` / `medium` | Ordinary implementation with a clear spec, one area, existing patterns |
   | Complex | `opus` / `high` | Needs judgment: design, cross-cutting changes, unclear debugging, security, data/migrations, anything where a plausible-but-wrong change is expensive |

3. It adjusts: **up** for gaps in the spec, unfamiliar or tangled code, silent failure modes
   (data, auth, money), or a `--fork` worker reasoning over a long conversation; **down** when
   the change can be written out almost line by line or the worker only reads. `opus` /
   `xhigh`/`max` only for the single hardest problem in a plan, with a stated reason.
4. The plan shown to you lists every worker's model and effort with a one-line reason, and
   waits for your go-ahead. Your instructions override the table ("keep it cheap", "opus for
   everything").
5. After the fact: if a worker gets stuck on reasoning, or fails review twice for reasoning
   reasons, the orchestrator tells you and escalates: the worker commits what it has, is
   stopped (its branch is kept), and a successor one tier up continues from that branch
   (`hc-worker start --name <name>-2 --base wt/<name> --model … --effort …`).

What follows from this:
- **The task description drives the choice.** A well-specified task lands in a cheaper tier;
  a vague one goes up.
- **It's judgment, so it can vary** between runs, like two developers sizing the same ticket.
  The plan is the checkpoint.
- **To make it more predictable**, add fixed rules to the skill's "Choosing each worker's
  model" section, e.g. "anything touching migrations or auth is always `opus`", or a default
  budget per repository.

Tested in a sandbox: `haiku` and `sonnet` workers started on Haiku 5.5 and Sonnet 5.5 (checked
in their status lines), and an escalation from a `haiku` worker to an `opus` successor on its
branch, merged and cleaned up by `hc-worker stop` and `hc-worker prune`.

## Mechanicus look

The main-profile layout uses Herdr's default graphite theme with an amber accent (the green
`herdr/themes/mechanicus.json` theme is still installed and can be picked in Settings). The UI font is Share Tech Mono (OFL, bundled
in `herdr/mods/spaces-profile/fonts/`). The sidebar brand carries an original cog-and-skull
emblem (`herdr/mods/chrome-mechanicus/cog-skull.svg`). AUSPEX and SERVITORS live in the left
sidebar.

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
| `herdr/layouts/main-profile.json` | Copy of Herdr's `main` layout using the two copies above, with the Mechanicus look (theme, fonts, square frames) |
| `herdr/mods/auspex/` | AUSPEX, always shown in the left sidebar between Spaces and Servitors: the focused repo's branch, dirty state, ahead/behind and last commit (an icon opens the full message in a dialog); its submodules as an expandable tree of the import hierarchy, named by repo, each with state (synced, moved, dirty, uninitialized, conflict), branch (found by name for detached commits) and last commit; the open PR of every session in the shown tab and PR links found in its terminals (screens and Claude transcripts), with checks and review state via gh (cached 3 min); Jira links for issue keys; per-repo notes. Read-only, polls only while shown |
| `herdr/mods/servitors-mechanicus/` | Copy of Herdr's `agents` mod (all its features: grouping, sort, pin, peek, history, sub-agents), restyled as SERVITORS |
| `herdr/mods/status-mechanicus/`, `pane-mechanicus/`, `chrome-mechanicus/` | Copies of Herdr's `workspace-status`, `pane` and `workspace-chrome` (sidebar brand and footer) mods, restyled only; `chrome-mechanicus/cog-skull.svg` is the cog-and-skull emblem in the brand block |
| `herdr/backgrounds/mechanicus-logo.png` | The Adeptus Mechanicus emblem in green on transparent (from the image the owner supplied; Games Workshop artwork, keep this repository private) |
| `herdr/backgrounds/mechanicus-emblem-backdrop-grey.png` | That emblem in grey, small and centred, lightly blurred at 10% on graphite's background, behind every terminal (a new file name for every change: Herdr caches backgrounds by name) (pane frame background; layout `terminal_opacity` 0.2) |
| `herdr/themes/mechanicus.json` | Adeptus Mechanicus cogitator theme: phosphor green on black, brass accents, forge-red buttons |
| `herdr/mods/spaces-profile/fonts/` | Share Tech Mono (OFL), the UI font of the Mechanicus look |
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
   - layout: `"mod": "spaces-profile"`, `"mod": "tabs-profile"`, `status-mechanicus`, `pane-mechanicus`, the `auspex` panel child and the Mechanicus look on the root.
   - `status-mechanicus` / `pane-mechanicus`: visual changes only (colors, glyphs, square corners).
2. Replace the folders here, `./install.sh`, check, commit.
