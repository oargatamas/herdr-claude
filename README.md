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
  `~/.claude/{statusline-account.sh,herdr-profile-label.sh}`, the `wh` Claude plugin (skills `wh:conclave`, `wh:servo-skull`, `wh:reconsecrate`, `wh:augment`, `wh:petition`, `wh:scriptorium`, `wh:expurgate`, from a local marketplace copied to `~/.local/share/herdr-claude/marketplace`), a
  marked block in each profile's `CLAUDE.md`, merged entries in each profile's `settings.json`,
  and its own mods, layout and keys under `~/.config/herdr-app`, plus the SCRIPTORIUM window's
  Herdr home in `~/.local/share/herdr-claude/scriptorium-window`. Backups:
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
| `cmd-shift-n` | New Claude space: name it, pick Company or Personal; its first tab is named "Cogitator <name>" |
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
- **`wh:augment` and `wh:petition` skills**: "augment" (or AUSPEX's AUGMENT button, which opens it in an
  AUGMENTORIUM space in the background) → Claude watches AUSPEX's AUGMENTATIONS (the self-improvement notes) and sends a
  servo-skull for each open one (SERVITORS shows them as its sub-agents), in parallel, each in its own worktree; their commits land one per note on an augment branch (marking each note done with its commit);
  "petition" → that branch goes up as one PR.
- **`wh:scriptorium` skill**: "show me README.md" → the file opens as a data-slate (one per file, several at once), a floating
  window showing a markdown file's render, with its source a click away (SOURCE / SPLIT), a `.env` file as a text window with dotenv colouring, or any other file as a simple read-only text window, following edits live; stretch it by its right or
  bottom edge or its corner. They open in the **SCRIPTORIUM window**, a second Herdr window (started when needed) that is blank
  but for a Mechanicus desk, so documents from Claude and its servo-skulls can sit on another display (`--here`: in your own window).
- **`wh:servo-skull` skill** ("servo", "servo-skull" or "split"): "open a Claude in a split" → one Claude beside you (SERVITORS shows it under your session, but it outlives it; closing its pane ends it),
  fresh or a fork of this conversation, on the model and effort that fit; yours to work with. Given a task, it reports the result back
  to the calling Claude (`hc send`, "servo-skull <terminal> done: …") and decides for itself: an answer, or a task with nothing likely to follow,
  ends "— closing myself" and it closes its own pane; work to review or follow up on ends "— close me, or send further orders" and it waits,
  and that Claude relays it and closes it or sends more orders (`--stay` / `--leave`: always wait / always close). The caller gives it a short
  title and purpose (`--title`, `--purpose`), which its pane header and SERVITORS show instead of "Claude" (the purpose as a tooltip).
- **`wh:expurgate` skill** ("expurgate", "purge the heresy" or "clean up the comments in this PR"): finds the PR (the branch's open PR,
  a given number or branch, else the branch against its base) and sends a servo-skull (`sonnet`/`medium`) to remove the comments its
  changes add that say nothing (restating the code, narrating the change, debug leftovers, commented-out code), keeping the why, warnings,
  API docs, directives and referenced TODOs; it commits once without pushing and reports back, and the caller asks whether to push and close it.
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
| `claude/plugins/wh/skills/servo-skull/` | Opens one Claude beside you in a split, fresh or a fork (`split.sh`; it starts as an hc child of the caller, so SERVITORS nests it there, outliving the caller; `--independent`: a plain split with no parent; `--title` / `--purpose`: its labels `servo-skull.title` / `servo-skull.purpose`, shown by the pane header and SERVITORS; with a first prompt it reports back to the caller with `hc send`, then closes itself (`close-self.sh`) when nothing is likely to follow, else waits to be closed or given more orders (`--stay` / `--leave` force one), `--no-report` leaves that out) |
| `claude/plugins/wh/skills/reconsecrate/` | Update skill: resets this clone to `origin/main` (local work kept in a stash / backup branch) and runs `install.sh` |
| `claude/plugins/wh/skills/augment/` | Watches the AUGMENTATIONS notes (`augment-watch.sh`), sends a servo-skull per note (up to 4 at once, worktrees in `<clone>/.claude/worktrees/augment-<id>`, reporting back with `hc send`) and cherry-picks each one's commit onto an `augment/<time>` branch, in a worktree at `~/.local/share/herdr-claude/augment` (takes over an unpublished `litany` one from before the rename) |
| `claude/plugins/wh/skills/scriptorium/` | Opens a file in the scriptorium mod (`open-md.sh [--here] <file>`: in the SCRIPTORIUM window, started with `HERDR_APP_HOME=~/.local/share/herdr-claude/scriptorium-window herdr-app` when it isn't running and switched to its `scriptorium` layout, or with `--here` in your window; writes `{path, id}` to that home's `scriptorium-request`, then `mod.open scriptorium` unless one is open, which then opens a window for the file; `close-md.sh [--here] <file>... | --all` closes data-slates: writes `{id, at, all, paths}` to the home's `scriptorium-close`, which every open window reads and obeys when its file is named, since `herdr-app` can't close a mod's overlay by key) |
| `claude/plugins/wh/skills/expurgate/` | Comment cleanup for a PR: works out the PR and its base, then sends a servo-skull (`../servo-skull/split.sh`) with the brief; it works on the branch checked out here (clean tree required) or in a worktree at `<repo>/.claude/worktrees/expurgate-<branch>` for another branch, commits once, doesn't push |
| `claude/plugins/wh/skills/petition/` | Publishes the augment branch: push, PR to `main` with one line per note, then clears the augment state |
| `herdr/mods/claude-space/` | The `cmd-shift-n` form (the first tab is named "Cogitator <name>") |
| `herdr/mods/claude-fork*/` | Fork into a tab, or a split per direction (a shortcut can't pass arguments to a mod) |
| `herdr/shared/fork.js` | Copied into every `claude-fork*` mod (mods can't import across folders) |
| `herdr/mods/spaces-profile/`, `tabs-profile/` | Copies of Herdr's sidebar list and tab bar, with badges |
| `herdr/mods/spaces-profile/skulls/` | Ten one-color servo-skulls (ocular, antenna, vox-grille, cog crest, cables, mechadendrite, iron jaw, wings, thrusters, visor), the space avatars on their colored squares: each space draws one at random from those no open space bears yet (any once all ten are taken), kept by space id in `space.skulls`; `~` keeps the first |
| `herdr/shared/profile.js` | The badge code, copied into both |
| `herdr/mods/help-plus/` | Copy of Herdr's keybinds dialog with the Claude section, plus a Skills tab (`Tab` / `Shift-Tab` switch, while the filter keeps the keyboard) listing the wh plugin's Claude skills (read from the installed marketplace copy, as Claude loaded them) with their descriptions and whether each is installed |
| `herdr/layouts/mechanicus-grey.json`, `mechanicus-green.json` (+ `.svg` previews) | Copies of Herdr's `main` layout using the mods here, with the Mechanicus look (theme, fonts, square frames, terminal emblem); identical except theme, background and emblem |
| `herdr/mods/auspex/` | AUSPEX, always shown in the left sidebar between Spaces and Servitors: the focused repo's branch, dirty state, ahead/behind and last commit (an icon opens the full message in a dialog); its submodules as an expandable tree of the import hierarchy, named by repo, each with state (synced, moved, dirty, uninitialized, conflict), branch (found by name for detached commits) and last commit; the open PR of every session in the shown tab and PR links found in its terminals (screens and Claude transcripts), with checks and review state via gh (cached 3 min); Jira links for issue keys; AUGMENTATIONS, a list of self-improvement todos for the mods and Claude (an input adds (Enter in the sidebar, ⇧↵ in both), a checkbox ticks off, an expand icon shows them all in a dialog, whose input is multi-line: ⇧↵ or ⌘↵ adds, and the further lines are kept indented under the todo; what is being typed is one draft shared live by the sidebar and the dialog, the one-line sidebar field showing its line breaks as ⏎, so you can start small and carry on in the big box), kept in `~/.local/share/herdr-claude/todos.md`, with an AUGMENT toggle that opens (or closes) the AUGMENTORIUM, a Herdr space on the clone opened without taking the focus, whose Claude (personal profile) runs the `wh:augment` skill and its servo-skulls: blue when none runs, green while it works, amber when it or a skull waits for you, and then a click shows the space (■ beside it closes it; while it works, an eye shows it). Read-only apart from that file and the augmentor, polls only while shown |
| `herdr/mods/scriptorium/` | SCRIPTORIUM, floating windows (overlay `kind: window`, `frame: none`, one per file, keyed by its path so each remembers where it's dropped; an open one opens the window for each new request; the copy `mod.open` makes only measures the default size, 60% × 75% of the Herdr window, opens the first one and closes): a markdown (`.md`, `.markdown`) file's source (read-only editor, line numbers, markdown colouring) beside its render (set at the terminals' `font_size`), opening on RENDER (SOURCE / SPLIT a click away); a dotenv file (`.env` or a name ending in `.env`, not `.env.local`) is a text window with the editor's shell colouring (title `◇ DOTENV`, no render or mode switch); any other file is a simple text window (the read-only editor, plain, no render or mode switch), with the auspex scanner (a faint grey line sweeping down and up) over its body while motion is on; sized by its own content, so it resizes itself: grips on the right edge, bottom edge and bottom-right corner (a brass bracket), and while one is dragged a transparent margin and a layer over the window catch the moves; the left and top edges don't stretch (Herdr anchors windows at their top left); the size is kept per file in shared `scriptorium.sizes` (the latest 40); stays inside its Herdr window (mods get no OS window of their own); re-reads its home's `scriptorium-request`, `scriptorium-close` and the file every second; Esc closes the window that has the keyboard (the one last pressed, or the newest). Read-only |
| `herdr/scriptorium-window/` | The SCRIPTORIUM window's own Herdr home, installed to `~/.local/share/herdr-claude/scriptorium-window` (with the `scriptorium` and `chrome-mechanicus` mods, the themes, backgrounds and Share Tech Mono): `layouts/scriptorium.json`, a blank layout (no spaces, tabs or terminals: a window showing them would resize your terminals) with a title band and the emblem desk; `mods/scriptorium-desk/` draws both (band: SCRIPTORIUM, how many data-slates are open, window drag; desk: a line of lore while empty) and stands in for its toast mod, closing every notification (your window shows them); `settings.json`: sounds off. A second Herdr process on the same herdr-core: same world, its own home, window, layout and shared state. Its home path stays short: Herdr's socket lives in it |
| `herdr/mods/composer/` | Prompt composer: the LITANY button in an agent pane's header opens a big text box; Send (⌘↵) submits it to that session with `hc send`, Insert (⌘I) puts it into the prompt without sending (through the clipboard, restored after), Copy copies it. The draft is kept per terminal until sent |
| `herdr/mods/servitors-mechanicus/` | Copy of Herdr's `agents` mod (all its features: grouping, sort, pin, peek, history, sub-agents), restyled as SERVITORS; a Noosphere group on top lists servitors without a pane that ask for it (label `herdr.servitor=<name>`; the paneless augmentor of earlier versions had it), and a click peeks at them; a servo-skull's row shows its title (label `servo-skull.title`, its purpose as the tooltip) |
| `herdr/mods/status-mechanicus/`, `pane-mechanicus/`, `chrome-mechanicus/` | Copies of Herdr's `workspace-status`, `pane` and `workspace-chrome` (sidebar brand and footer) mods, restyled (`pane-mechanicus` also names a servo-skull's pane by its title label, its purpose as the tooltip); `chrome-mechanicus/cog-skull.svg` is the cog-and-skull emblem in the brand block |
| `herdr/icons/` | The Dock icons, `cogitator.svg` (Herdr, the main window: the Mechanicus emblem of the terminal backdrop, `mechanicus-logo.png` recoloured grey and embedded, on transparent) and `scriptorium.svg` (the SCRIPTORIUM window: a red wax purity seal with the cog pressed in and its parchment strips, on transparent), and `apply-icons.sh` (macOS; `install.sh` runs it): COGITATOR becomes Herdr.app's custom Finder icon, leaving the bundle and its signature alone (a Herdr update drops it until the next install); SCRIPTORIUM goes on `~/Applications/Scriptorium.app`, an APFS clone of Herdr.app with its own name, bundle id (`dev.herdr.scriptorium`) and icon, signed ad hoc and rebuilt when Herdr's version changes, which `open-md.sh` starts for the SCRIPTORIUM window so it has its own Dock tile. The Dock shows a new icon from the app's next start. `--remove` undoes both |
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
   - `status-mechanicus` / `pane-mechanicus`: visual changes only (colors, glyphs, square corners), and in `pane-mechanicus` the servo-skull title label.
2. Replace the folders here, `./install.sh`, check, commit.
