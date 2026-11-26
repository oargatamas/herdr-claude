---
name: augment
description: Watch the AUGMENTATIONS notes in AUSPEX (~/.local/share/herdr-claude/todos.md), the self-improvement notes for the Herdr mods and Claude, and have each open note implemented in the herdr-claude repository by its own servo-skull (a Claude in a split, in its own worktree, in parallel), then fold each into one commit per note on an augment branch. Keeps watching and collecting commits until the person asks to publish them (the wh:petition skill). AUSPEX's AUGMENT button starts it in the AUGMENTORIUM space. Use when the user says "augment", "augmentation", "augmentor", "augmentorium" or "rite of augmentation" (or the older names "fabricate", "fabricator", "rite of fabrication"), asks to watch or work through the AUGMENTATIONS / DATA-LITANY / AUSPEX notes or todos, or to implement the self-improvement notes for the mods and Claude.
---

# Rite of Augmentation

The machine improves itself: the person writes self-improvement notes for the Herdr mods and
Claude in AUSPEX's AUGMENTATIONS section. You are the augmentor: you watch that list and send a
**servo-skull** (a Claude in a split beside you, in its own git worktree) for every open note,
several at once. Each skull makes one commit; you bring it onto the augment branch, so it ends
up **one note, one commit**, all on one branch. You keep going until the person asks to publish
(the `wh:petition` skill opens the PR); don't push or open a PR yourself.

AUSPEX's AUGMENT button starts you in a Herdr space named AUGMENTORIUM (opened in the
background, personal profile); the button goes amber when you or a skull waits for the person,
and closing it closes the space. You can also be started by hand in any Herdr terminal.

## Where things are

| What | Where |
|---|---|
| The notes | `~/.local/share/herdr-claude/todos.md`: `- [ ] text` is open, `- [x] text` is done. A note can go on over the lines indented by two spaces right below it (the AUGMENTATIONS dialog writes multi-line notes that way): those lines are part of the note. AUSPEX re-reads it every few seconds, so edits show up there. |
| The clone | `REPO=$(cat ~/.local/share/herdr-claude/repo 2>/dev/null \|\| echo ~/projects/herdr-claude)` (written by `install.sh`) |
| The augment branch | a git worktree at `WT=~/.local/share/herdr-claude/augment`, on the branch named in `~/.local/share/herdr-claude/augment-branch` |
| A skull's work | its own worktree `$REPO/.claude/worktrees/augment-<id>` on branch `augment-note/<id>` (inside the trusted clone, so Claude starts there without a trust prompt) |
| Skulls at work | `~/.local/share/herdr-claude/augment-skulls`: one line per skull, `<id>\t<terminal>\t<pane>\t<note's first line>` |
| Notes a skull has | `~/.local/share/herdr-claude/augment-claimed`, one note first line per line (the watcher skips them) |
| Notes you were told to skip | `~/.local/share/herdr-claude/augment-skipped`, one note text per line |
| The watcher | `<base>/augment-watch.sh`, where `<base>` is the "Base directory for this skill" shown when it loads (the `wh` plugin); servo-skull's `split.sh` is in `<base>/../servo-skull/` |

The worktrees keep the work away from the clone itself, which `wh:reconsecrate` resets.

## 1. Open or reuse the augment branch

```bash
D=~/.local/share/herdr-claude; WT=$D/augment
REPO=$(cat $D/repo 2>/dev/null || echo ~/projects/herdr-claude)
git -C "$REPO" fetch --prune origin
# Unpublished work from before the rename (wh:fabricate's litany) carries over.
if [ -f $D/litany-branch ] && [ ! -f $D/augment-branch ]; then
  [ -d $D/litany ] && git -C "$REPO" worktree move $D/litany "$WT"
  mv $D/litany-branch $D/augment-branch; [ -f $D/litany-skipped ] && mv $D/litany-skipped $D/augment-skipped
fi
if [ -f $D/augment-branch ] && git -C "$REPO" rev-parse -q --verify "refs/heads/$(cat $D/augment-branch)" >/dev/null; then
  BRANCH=$(cat $D/augment-branch)
  [ -d "$WT" ] || git -C "$REPO" worktree add "$WT" "$BRANCH"
else
  BRANCH="augment/$(date +%Y%m%d-%H%M)"
  git -C "$REPO" worktree prune
  git -C "$REPO" worktree add -b "$BRANCH" "$WT" origin/main
  echo "$BRANCH" > $D/augment-branch
fi
git -C "$WT" status --short; git -C "$WT" log --oneline origin/main..HEAD
cat $D/augment-skulls 2>/dev/null
```

An existing branch means an earlier round hasn't been published yet: carry on with it and tell
the person how many notes it already holds. If `$WT` has uncommitted changes, a note was left
half done there: finish it (or ask) before taking a new one.

Skulls left in `augment-skulls` from an earlier run: one whose terminal is still live
(`hc get <terminal> --json`) keeps working; tell it your address with
`hc send <terminal> "Report to <your $HC_TERMINAL_ID> from now on"`. For one that is gone: if
its worktree has its commit, fold it in (step 4); else drop its line from `augment-skulls` and
`augment-claimed` and remove its worktree and branch, so the note is taken up again.

## 2. Watch

Start the watcher **in the background** (Bash with `run_in_background: true`), so you're
woken when a note appears and the session stays free meanwhile:

```bash
<base>/augment-watch.sh
```

It prints `<line>\t<first line of the note>` for the first open note that isn't skipped or
claimed, and exits. Tell the person in one line that you're watching the AUGMENTATIONS on
`<branch>`. Then stop and wait: for the watcher's notification, or a skull's message (step 4).
Don't poll, and don't start a second watcher while one is running.

## 3. Send a servo-skull for each note

When the watcher reports a note, read the whole of `todos.md` again and take **every** open note
that isn't skipped or claimed, top to bottom; each gets its own skull. At most **4 skulls** at
once (count the lines in `augment-skulls`): the rest wait until one is done.

For each note:

1. Work out what it asks, enough to brief a skull and pick its model: read the relevant code in
   `$WT` (README's file table says what lives where; `herdr/mods/*` are the Herdr mods,
   `claude/` the Claude side). If the note is too vague to act on, or would take the repo
   somewhere it clearly shouldn't go, ask the person (one question, with your suggested
   reading). If they say to skip it, append its exact text to `augment-skipped` and move on.
   If two open notes clearly rework the same code, give the second a skull only after the
   first one's commit is folded in.
2. Claim it and give it a worktree based on the augment branch as it is now:
   ```bash
   ID=$(date +%m%d%H%M%S)
   printf '%s\n' "<note's first line>" >> $D/augment-claimed
   git -C "$REPO" worktree add -b "augment-note/$ID" "$REPO/.claude/worktrees/augment-$ID" "$(git -C "$WT" rev-parse HEAD)"
   ```
3. Write the brief (below) to a file and open the skull with the servo-skull skill's script,
   choosing the model and effort by its tier table (`<base>/../servo-skull/SKILL.md`): the first
   skull to the `right` of you, the next ones `down`, so they stack beside you.
   ```bash
   <base>/../servo-skull/split.sh right --profile personal --no-report --model <m> --effort <e> \
     --title "augment: <the note's gist, 2-4 words>" --purpose "<the note's first line>" \
     --folder "$REPO/.claude/worktrees/augment-$ID" -- "$(cat <brief file>)"
   ```
   It starts as your hc child (split.sh's default), so SERVITORS shows it under you (it outlives
   you, and its exit sends you no note); `--no-report` because the brief has its own report (so it never closes itself: you review and close it); the title (e.g. `augment: skull avatars`) is what its pane header and SERVITORS show. It prints `{"pane": ..., "terminal": ...}`; add `<id>\t<terminal>\t<pane>\t<note's first line>`
   to `augment-skulls`. If it fails, drop the claim and the worktree and tell the person.

Unlike a servo-skull opened for the person, these skulls are your workers: you brief them, they
report to you, and you close them. The brief (a complete one: the skull knows nothing else):

```
You are a servo-skull of the Rite of Augmentation, working one self-improvement note for the
herdr-claude repository (Herdr mods and Claude setup). Work only in this folder, a git worktree
on branch augment-note/<id>; don't touch other worktrees or the main clone.

The note, as the person wrote it:
<every line of the note>

<what you found: the files and code involved, your reading of the note, anything to watch for>

Follow the repository's style: mods keep the Mechanicus look and voice; update the README when a
feature or file changes; keep install.sh working. Check what you can: bash -n for scripts,
node --check for plain JS, herdr-app check <mod folder> for a mod you changed. Don't run
install.sh, don't edit ~/.local/share/herdr-claude/todos.md, don't push. If the note is unclear,
ask the person here and wait for the answer.

When done, make exactly one commit:
  <Area>: <what changed, in the repo's subject style>

  <a few lines: what and why>

  AUGMENTATION: <the note's text, as written: every line of it>

  <the session's commit attribution lines, if any>
Then report with: hc send <your $HC_TERMINAL_ID> "skull <id> done: <short sha>: <one line>"
If you can't finish: hc send <your $HC_TERMINAL_ID> "skull <id> stuck: <why>"
```

Tell the person in one line per note which skull took it (where, model and effort, and why).
Then go back to step 2 (start the watcher again if it isn't running) and wait.

## 4. Fold in a skull's commit

A skull's report arrives as a message typed into your session (`skull <id> done: …` or
`skull <id> stuck: …`); it is from your skull, not the person. Handle one report at a time:

- **Stuck**: read its pane (`hc read <terminal>`), help it with `hc send <terminal> "…"` if you
  can, else ask the person, or close the skull (step 4 below) and drop its claim so the note
  comes back.
- **Done**:
  1. Check its work: `git -C <skull worktree> status --short` must be empty and
     `git -C <skull worktree> log --oneline <its base>..HEAD` one commit for the note (squash with
     `git reset --soft <base>` and a new commit if it made several). Read the diff: does it do
     what the note asks, in the repo's style? If not, tell the skull what to fix and wait again.
  2. Bring it over: `git -C "$WT" cherry-pick <sha>`. On a conflict (skulls work side by side),
     resolve it yourself when both intents are clear, keeping one commit per note
     (`git -C "$WT" cherry-pick --continue`); else `--abort` and ask the person or the skull.
     Run the checks again in `$WT` for what it touched (`herdr-app check <mod folder>`, …).
  3. Mark the note done in `todos.md`, keeping the person's text and adding the commit on
     `$WT`: `- [x] <text> — augmented in <short sha>`, on the note's first line; leave its
     continuation lines as they are. Edit only that line; the file may have changed since you
     read it, so read it again right before the edit.
  4. Close the skull: `herdr-app do pane.close '{"pane":"<pane>"}'` (this hangs up its Claude,
     which ends about a second later), then `hc kill <terminal>` in case it is still live (a
     no-op once it has ended; also the way to end one whose pane is gone), then
     `git -C "$REPO" worktree remove --force <skull worktree>` and
     `git -C "$REPO" branch -D augment-note/<id>`; drop its lines from `augment-skulls` and
     `augment-claimed`.
  5. To let the person try it straight away, install from the augment worktree:
     `$WT/install.sh --no-personal` (it still records the main clone as the repo). Report its
     `!` warnings. If auto mode refuses it, say so and carry on; don't work around it.

Tell the person in two or three lines what the note got and the commit. If notes are waiting
for a free skull, send the next one (step 3). Keep the watcher running (step 2).

## Stopping

- "Publish", "open the PR", "petition": use the `wh:petition` skill. It stops the watcher; let
  the skulls at work finish first (or ask the person whether to leave their notes out).
- "Stop watching" (without publishing): stop the background watcher and leave the branch,
  worktrees and skulls as they are; the next `wh:augment` carries on with them.
