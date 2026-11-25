---
name: petition
description: Publish the DATA-LITANY work collected by the wh:fabricate skill: stop watching the notes, push the litany branch of herdr-claude and open a pull request to main with one line per implemented note, then clear the litany state so the next fabricate starts a fresh branch. Use when the user says "petition" or "petition the Omnissiah", or asks to publish, push or open the PR for the fabricated / DATA-LITANY / AUSPEX notes.
---

# Petition of the Litany

Turns the branch that `wh:fabricate` filled (one commit per DATA-LITANY note) into a pull request.
Never merge it: the person reviews and merges.

## 1. Stop watching

Stop the `litany-watch.sh` background task if one is running in this session (TaskStop), else
`pkill -f fabricate/litany-watch.sh || true`. If you were in the middle of a note, finish and
commit it first, or ask whether to leave it out.

## 2. Check what there is

```bash
D=~/.local/share/herdr-claude; WT=$D/litany
REPO=$(cat $D/repo 2>/dev/null || echo ~/projects/herdr-claude)
BRANCH=$(cat $D/litany-branch)
git -C "$WT" status --short                  # must be empty: every note committed
git -C "$REPO" fetch --prune origin
git -C "$WT" log --reverse --format='%h %s' origin/main..HEAD
```

No litany branch, or no commits on it: say there's nothing to publish and stop. Uncommitted
changes: show them and ask whether to commit them as their own note or drop them.

## 3. Bring it up to date

If `origin/main` moved on, `git -C "$WT" rebase origin/main`. Resolve conflicts yourself when
the intent is clear (keep one commit per note), else stop and show the person.

## 4. Push and open the PR as oargatamas

The repository belongs to the `oargatamas` GitHub account, the only one that can open (and
merge) PRs there. `gh` is usually set to another account (the company one), so switch to
`oargatamas` for the PR and **always switch back afterwards, also when a step fails**. The
switch is global: other sessions on this machine use the same `gh`, so keep it short. Do the
switch, the PR and the switch back within one Bash call, not spread over several.

```bash
ACCOUNT=oargatamas
PREV=$(gh api user -q .login)                 # the account to return to
gh auth status 2>&1 | grep -q "account $ACCOUNT" \
  || { echo "$ACCOUNT is not logged in to gh"; exit 1; }
[ "$PREV" = "$ACCOUNT" ] || gh auth switch --user "$ACCOUNT"
trap '[ "$PREV" = "$ACCOUNT" ] || gh auth switch --user "$PREV"' EXIT
git -C "$WT" push -u origin "$BRANCH"
cd "$WT" && gh pr create --base main --head "$BRANCH" --title "DATA-LITANY: <n> notes fabricated" --body-file <file>
```

If `oargatamas` isn't logged in, stop and give the person `! gh auth login` to add it; don't
open the PR from another account. Afterwards check `gh api user -q .login` is `$PREV` again, and
say in the report that `gh` is back on it. (`git push` uses git's own stored credential, not the
`gh` account; it is inside the switch only so the call is all in one place.)

The body: a short intro, then one bullet per commit, in order: the note's text (from the
`DATA-LITANY:` line of the commit message), then the commit's subject and short sha. End it with
the session's PR attribution line, if any. If the branch already has an open PR (an earlier
petition), just push: the PR picks up the new commits; say so and give its link. Merging is the
person's: never merge, not even with `oargatamas`.

## 5. Clear the litany state

```bash
git -C "$REPO" worktree remove "$WT"
rm -f $D/litany-branch $D/litany-skipped
```

The branch stays (local and on GitHub) for the PR. The done notes stay in `todos.md` with their
commits; the next `wh:fabricate` opens a new branch from `origin/main`.

## 6. Report

The PR link, the notes in it, that `gh` is back on the account it was on, and that after
merging, `wh:reconsecrate` installs the result from `main`.
