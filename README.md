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
  `~/.claude/{statusline-account.sh,herdr-profile-label.sh}`, the `wh` Claude plugin (skills `wh:conclave`, `wh:servo-skull`, `wh:reconsecrate`, `wh:fabricate`, `wh:petition`, from a local marketplace copied to `~/.local/share/herdr-claude/marketplace`), a
  marked block in each profile's `CLAUDE.md`, merged entries in each profile's `settings.json`,
  and its own mods, layout and keys under `~/.config/herdr-app`. Backups:
  `*.bak-herdr-claude-<time>` next to every settings file it changes.
- Changing Claude's own `settings.json` (hooks, permissions) can be refused in auto mode. If so,
  don't work around it: give the person the command (`! ~/projects/herdr-claude/install.sh`)
  to run themselves.
- Report every `!` warning the script prints. Typical ones:
  - **Key already bound to something else**: ask the person; rerun with `--force-keys` only if
    they want the kit's binding.
  - **No personal profile**: the person creates it with `claude-personal` (or
    `CLAUDE_CONFIG_DIR=~/.claude-personal claude`) and logs in, then the installer runs again.
- **Personal subscription (optional)**: run in a terminal, the installer asks whether to set up a
  second, personal Claude subscription and, if yes, adds the `claude-personal` alias to `~/.zshrc`
  (or `~/.bashrc` / `~/.bash_profile`) in a marked block, after a backup. Claude can't answer that
  question, so ask the person and pass `--personal` or `--no-personal`.
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
  (layouts `mechanicus-grey` and `mechanicus-green`).
- **`wh:conclave` skill**: "split this into workers" → plan, workers as splits beside the
  orchestrator (or tabs) in git worktrees, each on a model and effort the orchestrator picks from
  the task's complexity (`haiku`/`sonnet`/`opus`, `hc-worker start --model … --effort …`) (`hc-worker start`), coordination with `hc send` / `hc wait`, review, merge, cleanup
  (`hc-worker stop`, `hc-worker prune`).
- **`wh:fabricate` and `wh:petition` skills**: "fabricate" → Claude watches AUSPEX's DATA-LITANY notes and
  implements each open one as its own commit on a litany branch (marking it done with the commit);
  "petition" → that branch goes up as one PR.
- **`wh:servo-skull` skill** ("servo", "servo-skull" or "split"): "open a Claude in a split" → one independent Claude beside you,
  fresh or a fork of this conversation, on the model and effort that fit; yours to work with.
- **`wh:reconsecrate` skill**: "update herdr-claude" → local changes in the clone set aside
  (stash / backup branch), reset to `origin/main`, `install.sh` run again.
- **`CLAUDE.md` block**: every session knows it runs in Herdr and about these commands.
- **Permissions**: `hc`, `herdr-app`, `hc-worker`, `claude-ws` run without prompts; `hc keys`
  (answering another session's dialogs) is denied.

Profiles: company = `~/.claude` (`claude`), personal = `~/.claude-personal`
(`claude-personal`, the alias the installer adds on request: `--personal`, or answer yes when asked;
`claude-ws --profile personal` works without it).

## How a worker's model is chosen

The orchestrating Claude chooses each worker's model and effort **by judgment, following the
rules in the `wh:conclave` skill**. Nothing scores tasks automatically: `hc-worker` only
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

Two looks, each a layout with its own theme and terminal emblem; pick one in Settings → Layouts or
with `herdr-app do layout.switch --name mechanicus-grey` (or `mechanicus-green`). The installer
switches to grey unless one of them is already shown.

| Layout | Theme | Terminal emblem |
|---|---|---|
| `mechanicus-grey` (default) | `mechanicus-grey`: Herdr's graphite with an amber accent | grey |
| `mechanicus-green` | `mechanicus-green`: phosphor green on black, brass accents, forge-red buttons | green |

The UI font is Share Tech Mono (OFL, bundled
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
| `.claude-plugin/marketplace.json` | The `herdr-claude` plugin marketplace (one plugin, `wh`); `install.sh` copies it with the plugin to `~/.local/share/herdr-claude/marketplace` and installs `wh@herdr-claude` in every profile |
| `claude/plugins/wh/` | The `wh` plugin: the Mechanicus skills, called `/wh:<name>` and also by their lore names |
| `claude/plugins/wh/skills/conclave/` | Parallel workers skill |
| `claude/plugins/wh/skills/servo-skull/` | Opens one Claude beside you in a split, fresh or a fork (`split.sh`) |
| `claude/plugins/wh/skills/reconsecrate/` | Update skill: resets this clone to `origin/main` (local work kept in a stash / backup branch) and runs `install.sh` |
| `claude/plugins/wh/skills/fabricate/` | Watches the DATA-LITANY notes (`litany-watch.sh`) and implements each one as its own commit on a `litany/<time>` branch, in a worktree at `~/.local/share/herdr-claude/litany` |
| `claude/plugins/wh/skills/petition/` | Publishes the litany branch: push, PR to `main` with one line per note, then clears the litany state |
| `herdr/mods/claude-space/` | The `cmd-shift-n` form |
| `herdr/mods/claude-fork*/` | Fork into a tab, or a split per direction (a shortcut can't pass arguments to a mod) |
| `herdr/shared/fork.js` | Copied into every `claude-fork*` mod (mods can't import across folders) |
| `herdr/mods/spaces-profile/`, `tabs-profile/` | Copies of Herdr's sidebar list and tab bar, with badges |
| `herdr/shared/profile.js` | The badge code, copied into both |
| `herdr/mods/help-plus/` | Copy of Herdr's keybinds dialog with the Claude section, plus a Skills tab (`Tab` switches) listing the repo's Claude skills with their descriptions and whether each is installed |
| `herdr/layouts/mechanicus-grey.json`, `mechanicus-green.json` (+ `.svg` previews) | Copies of Herdr's `main` layout using the mods here, with the Mechanicus look (theme, fonts, square frames, terminal emblem); identical except theme, background and emblem |
| `herdr/mods/auspex/` | AUSPEX, always shown in the left sidebar between Spaces and Servitors: the focused repo's branch, dirty state, ahead/behind and last commit (an icon opens the full message in a dialog); its submodules as an expandable tree of the import hierarchy, named by repo, each with state (synced, moved, dirty, uninitialized, conflict), branch (found by name for detached commits) and last commit; the open PR of every session in the shown tab and PR links found in its terminals (screens and Claude transcripts), with checks and review state via gh (cached 3 min); Jira links for issue keys; DATA-LITANY, a todo list for improving the mods and Claude (an input adds, a checkbox ticks off, an expand icon shows them all in a dialog, whose input is multi-line: ⌘↵ adds, and the further lines are kept indented under the todo), kept in `~/.local/share/herdr-claude/todos.md`, with a FABRICATE toggle that starts or stops a hidden Claude (hc terminal `litany-fabricator`, personal profile) running the `wh:fabricate` skill: blue when none runs, green while one watches the notes, amber when it waits for you (an eye shows its terminal in a tab). Read-only apart from that file and the fabricator, polls only while shown |
| `herdr/mods/composer/` | Prompt composer: the COMPOSE button in an agent pane's header opens a big text box; Send (⌘↵) submits it to that session with `hc send`, Insert (⌘I) puts it into the prompt without sending (through the clipboard, restored after), Copy copies it. The draft is kept per terminal until sent |
| `herdr/mods/servitors-mechanicus/` | Copy of Herdr's `agents` mod (all its features: grouping, sort, pin, peek, history, sub-agents), restyled as SERVITORS |
| `herdr/mods/status-mechanicus/`, `pane-mechanicus/`, `chrome-mechanicus/` | Copies of Herdr's `workspace-status`, `pane` and `workspace-chrome` (sidebar brand and footer) mods, restyled only; `chrome-mechanicus/cog-skull.svg` is the cog-and-skull emblem in the brand block |
| `herdr/backgrounds/mechanicus-logo.png` | The Adeptus Mechanicus emblem in green on transparent (from the image the owner supplied; Games Workshop artwork, keep this repository private) |
| `herdr/backgrounds/mechanicus-emblem-backdrop-grey.png`, `-green.png` | That emblem in grey / green, small and centred, lightly blurred at 10%, behind every terminal of the matching layout (pane frame background; `terminal_opacity` 0.2). Use a new file name for every change: Herdr caches backgrounds by name |
| `herdr/themes/mechanicus-grey.json`, `mechanicus-green.json` | The two themes (see Mechanicus look) |
| `herdr/mods/spaces-profile/fonts/` | Share Tech Mono (OFL), the UI font of the Mechanicus look |
| `herdr/keys.fragment.json` | Our key bindings (`__HOME__` = home folder), merged into `keys.json` |
| `herdr/programs.fragment.json` | Shows `env …` launched programs by what they run |

## Making changes

Edit here, run `./install.sh`, check, commit, push. Then on other machines: `git pull && ./install.sh`.
Edits made directly in `~/.config/herdr-app` or `~/.claude` are overwritten by the next install.

## Herdr updates

`spaces-profile`, `tabs-profile`, `help-plus` and the two `mechanicus-*` layouts are copies of
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
