---
name: reconsecrate
description: Update the herdr-claude customizations (Herdr mods, layouts, themes, keys, Claude hooks, skills, CLAUDE.md block) from the remote repository. Throws away local changes in the herdr-claude clone (kept in a stash and a backup branch), resets it to the latest origin/main and runs install.sh. Use when the user asks to update, refresh, reinstall, re-sync or "reconsecrate" herdr-claude, the Mechanicus look, AUSPEX, SERVITORS or the Herdr plugin/mods from remote.
---

# Rite of Reconsecration

Brings the installed herdr-claude up to date with `origin/main`: any local work in the clone is
put aside, the clone is reset to the remote `main`, and `install.sh` runs again. The person asked
for this, so don't ask before discarding local changes. Nothing is lost, though: dirty files go
to a stash and unpushed commits to a backup branch, and you tell the person both names.

## 1. Find the clone

```bash
REPO=$(cat ~/.claude/skills/reconsecrate/repo-path 2>/dev/null || echo ~/projects/herdr-claude)
git -C "$REPO" remote get-url origin   # must point at a herdr-claude repository
```

If the folder or the remote is missing, stop and ask the person where the clone is (or offer
`gh repo clone oargatamas/herdr-claude ~/projects/herdr-claude`).

## 2. Record what is about to be discarded

```bash
cd "$REPO"
git fetch --prune origin
BEFORE=$(git rev-parse HEAD); BRANCH=$(git branch --show-current)
git status --short
git log --oneline origin/main..HEAD        # commits only here, not on origin/main
```

Another Claude session may be working in this clone (look for `hc` terminals whose cwd is
`$REPO`, or very recent changes). If one is, tell the person and stop: resetting would wipe its
work. Otherwise carry on.

## 3. Put local work aside, then reset

```bash
STAMP=$(date +%Y%m%d-%H%M%S)
# Unpushed commits on any branch you're leaving: keep them on a backup branch.
[ -n "$(git log --oneline origin/main..HEAD)" ] && git branch "backup/reconsecrate-$STAMP" HEAD
# Modified and untracked files (not ignored ones): keep them in a stash.
[ -n "$(git status --porcelain)" ] && git stash push -u -m "reconsecrate $STAMP"
git checkout -f main 2>/dev/null || git checkout -f -b main origin/main
git reset --hard origin/main
git clean -fd
git log --oneline -1
```

Only make the backup branch when it would hold something; don't touch other branches or
existing stashes.

## 4. Install

```bash
"$REPO/install.sh" --no-personal
```

`--no-personal` keeps it from stopping at the personal-subscription question. It keeps the
current Mechanicus look (grey or green); it only switches layouts when another one is shown. If
auto mode refuses the run (it changes Claude's own `settings.json`), don't work around it: give
the person `! <REPO>/install.sh --no-personal` to run themselves.

## 5. Report

In a few lines:

- the commit before and after (`git log --oneline $BEFORE..HEAD` lists what came in; say
  "already up to date" when it is empty),
- anything put aside: the stash message and/or `backup/reconsecrate-<stamp>` branch, and how to
  get it back (`git stash pop`, `git cherry-pick`),
- every `!` warning `install.sh` printed,
- that running Claude sessions need a restart to pick up new hooks, skills and `CLAUDE.md`.
