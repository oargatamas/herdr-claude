---
name: fabricate
description: Watch the DATA-LITANY notes in AUSPEX (~/.local/share/herdr-claude/todos.md) and implement each open note in the herdr-claude repository, one commit per note, on a litany branch in its own worktree. Keeps watching and collecting commits until the person asks to publish them (the wh:petition skill). Use when the user says "fabricate", "fabricator" or "rite of fabrication", asks to watch or work through the DATA-LITANY / AUSPEX notes or todos, or implement the improvement notes for the mods and Claude.
---

# Rite of Fabrication

The person writes improvement notes for the Herdr mods and Claude in AUSPEX's DATA-LITANY
section. You watch that list, and for every open note you implement it in the herdr-claude
repository and commit it: **one note, one commit**, all on one branch. You keep going until the
person asks to publish (the `wh:petition` skill opens the PR); don't push or open a PR yourself.

## Where things are

| What | Where |
|---|---|
| The notes | `~/.local/share/herdr-claude/todos.md`: `- [ ] text` is open, `- [x] text` is done. AUSPEX re-reads it every few seconds, so edits show up there. |
| The clone | `REPO=$(cat ~/.local/share/herdr-claude/repo 2>/dev/null \|\| echo ~/projects/herdr-claude)` (written by `install.sh`) |
| The work | a git worktree at `WT=~/.local/share/herdr-claude/litany`, on the branch named in `~/.local/share/herdr-claude/litany-branch` |
| Notes you were told to skip | `~/.local/share/herdr-claude/litany-skipped`, one note text per line |
| The watcher | `<base>/litany-watch.sh`, where `<base>` is the "Base directory for this skill" shown when it loads (the `wh` plugin) |

The worktree keeps the work away from the clone itself, which `wh:reconsecrate` resets.

## 1. Open or reuse the litany branch

```bash
D=~/.local/share/herdr-claude; WT=$D/litany
REPO=$(cat $D/repo 2>/dev/null || echo ~/projects/herdr-claude)
git -C "$REPO" fetch --prune origin
if [ -f $D/litany-branch ] && git -C "$REPO" rev-parse -q --verify "refs/heads/$(cat $D/litany-branch)" >/dev/null; then
  BRANCH=$(cat $D/litany-branch)
  [ -d "$WT" ] || git -C "$REPO" worktree add "$WT" "$BRANCH"
else
  BRANCH="litany/$(date +%Y%m%d-%H%M)"
  git -C "$REPO" worktree prune
  git -C "$REPO" worktree add -b "$BRANCH" "$WT" origin/main
  echo "$BRANCH" > $D/litany-branch
fi
git -C "$WT" status --short; git -C "$WT" log --oneline origin/main..HEAD
```

An existing branch means an earlier round hasn't been published yet: carry on with it and tell
the person how many notes it already holds. If its worktree has uncommitted changes, a note was
left half done: finish it (or ask) before taking a new one.

## 2. Watch

Start the watcher **in the background** (Bash with `run_in_background: true`), so you're
woken when a note appears and the session stays free meanwhile:

```bash
<base>/litany-watch.sh
```

It prints `<line>\t<note>` for the first open note that isn't skipped and exits. Tell the
person in one line that you're watching the DATA-LITANY on `<branch>`. Then stop and wait for
the notification: don't poll, and don't start a second watcher while one is running.

## 3. Fabricate one note

When the watcher reports a note:

1. Read the whole of `todos.md` again: there may be more open notes. Take them **one at a time,
   top to bottom**; each one goes through steps 2 to 5 on its own.
2. Work out what the note asks. Read the relevant code in `$WT` first (README's file table says
   what lives where; `herdr/mods/*` are the Herdr mods, `claude/` the Claude side). If the note is
   too vague to act on, or would take the repo somewhere it clearly shouldn't go, ask the person
   (one question, with your suggested reading). If they say to skip it, append its exact text to
   `litany-skipped` and move on.
3. Implement it **in `$WT` only**, following the repository's style: mods keep the Mechanicus
   look and voice; update the README when a feature or file changes; keep `install.sh` working.
   Check what you can: `bash -n` for scripts, `node --check` for plain JS, and
   `herdr-app check <mod folder>` for a mod you changed.
4. Commit just that note:
   ```bash
   git -C "$WT" add -A
   git -C "$WT" commit -F - <<'MSG'
   <Area>: <what changed, in the repo's subject style>

   <a few lines: what and why>

   DATA-LITANY: <the note's text, as written>

   <the session's commit attribution lines, if any>
   MSG
   ```
   One commit per note: no unrelated changes in it, and no note spread over several commits
   (amend if you need to fix your own commit for the same note before moving on).
5. Mark the note done in `todos.md`, keeping the person's text and adding the commit:
   `- [x] <text> — fabricated in <short sha>`. Edit only that line; the file may have changed
   since you read it, so read it again right before the edit.
6. To let the person try it straight away, install from the worktree:
   `$WT/install.sh --no-personal` (it still records the main clone as the repo). Report its `!`
   warnings. If auto mode refuses it, say so and carry on; don't work around it.

Then tell the person in two or three lines what you did for the note and the commit, and go back
to step 2 (start the watcher again).

## Stopping

- "Publish", "open the PR", "petition": use the `wh:petition` skill. It stops the watcher.
- "Stop watching" (without publishing): stop the background watcher and leave the branch and
  worktree as they are; the next `wh:fabricate` carries on with them.
