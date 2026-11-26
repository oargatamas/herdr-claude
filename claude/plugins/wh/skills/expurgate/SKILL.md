---
name: expurgate
description: Clean the unnecessary code comments out of a pull request's changes (comments that restate the code, narrate the change, leftover debug or commented-out code), keeping those that explain why, warn, document an API, or are directives / licences / referenced TODOs. Works out the PR (the current branch's open PR, a given PR number or branch, or else the branch against its base) and sends a servo-skull (a Claude in a split beside you) to do it and commit it, then relays its report. Use when the user says "expurgate" or "purge the heresy" (from a PR), or asks to "clean up comments", "remove unnecessary comments from the PR", "strip the noise comments", or "tidy the comments in this branch". Only works inside a Herdr terminal ($HC_TERMINAL_ID set).
---

# Expurgate: purge the needless comments from a PR

You don't edit the code yourself: you find the PR's changes, open a servo-skull with a complete
brief (it edits, checks and commits), and relay its report. The skull touches only the lines the
PR adds or changes.

## 1. Find the PR and its base

In the repository the person is in (or the one they name):

```bash
git rev-parse --show-toplevel
gh pr view [<number>|<branch>] --json number,url,headRefName,baseRefName 2>/dev/null
```

- No argument: the current branch's open PR. A number or branch given: that PR.
- No PR (or no `gh`): the current branch (or the branch named) against its base: the repo's
  default branch (`git symbolic-ref --short refs/remotes/origin/HEAD`, else `main` / `master`),
  unless the person names another.
- `git fetch origin <base>` and use `BASE=origin/<base>` (the local one may be stale). Check
  there is something to do: `git diff --stat $BASE...<branch>`; if it is empty, say so and stop.

## 2. Choose where the skull works

**The branch checked out here** (the usual case): the skull works in this folder, on this branch,
so its commit lands where the person already is, with no merge step. Its edits mix with theirs
if the tree is dirty, so first `git status --porcelain`: when it lists anything, ask the person
to commit or stash it (or say go anyway: the skull then commits only the hunks it made, which
is fragile), and wait.

**Another branch** (a PR number or branch that isn't checked out here): don't switch the
person's checkout. If `git worktree list` shows the branch checked out somewhere, work there
(same clean-tree check). Otherwise make a worktree for it:

```bash
git fetch origin <branch>
git worktree add .claude/worktrees/expurgate-<branch-with-slashes-as-dashes> <branch>   # or -b <branch> origin/<branch> when it only exists on the remote
```

and tell the person where it is (remove it with `git worktree remove <path>` once they're done).

## 3. Send the skull

Use the `wh:servo-skull` skill's `split.sh` (its directory is `../servo-skull` next to this
skill's base directory), on `sonnet` / `medium`: the rules are given, but each comment is a
small judgment call.

```bash
<base>/../servo-skull/split.sh --model sonnet --effort medium --stay --title "expurgate <branch>" \
  --purpose "Purge needless comments from <PR or branch>" [--folder <worktree>] -- "<brief>"
```

The brief, filled in (it knows nothing of this conversation); `<attribution>` is the commit
attribution lines this session was given (the `Co-Authored-By:` line), copied exactly:

```text
Remove the unnecessary code comments from the changes of <PR url, or branch <branch>> in <repo folder>, on branch <branch> (already checked out there; don't switch branches). The PR's changes are `git diff <BASE>...HEAD` (BASE = <BASE>).

Scope: only comments on lines this diff adds or changes. Don't touch comments outside the diff, and don't change code, whitespace or formatting beyond deleting a comment (when a whole comment line goes, delete the line; when a trailing comment goes, delete it and the spaces before it). Never change a file the diff doesn't touch.

Remove comments that add nothing:
- restating what the code plainly says (`// increment i`, `# return the result`, `// constructor`);
- narrating the change or its history (`// added X`, `// now uses Y`, `// fixed bug`, `// changed from Z`, `// new:`), which belongs in the commit message;
- leftover debug lines and commented-out code;
- noise: empty or decorative comments, `// end if`, banners with nothing in them, and TODO / FIXME notes with nothing to act on.

Keep:
- comments that explain why (a reason, a constraint, a non-obvious decision, a link to an issue or doc), and warnings (`// must run before X`, `// not thread-safe`);
- API docs: docstrings, JSDoc / TSDoc, rustdoc, Javadoc, `///` and `/** */` doc comments;
- licence and copyright headers;
- tool directives: eslint-disable, prettier-ignore, `# type: ignore`, `# noqa`, `# pragma`, `@ts-ignore` / `@ts-expect-error`, `//go:` / `// +build`, `#!` shebangs, `# -*- coding -*-`, `// @flow`, `/* istanbul ignore */`, `rubocop:disable`, `nolint`, and the like;
- TODO / FIXME / HACK with a ticket, issue, name or concrete next step;
- anything you are unsure about: leave it and list it in your report.
If a comment mixes noise and a reason, trim it to the reason only when that is a clean cut; otherwise keep it.

Then: if the project has a cheap formatter or linter for the touched files (a configured prettier, ruff, gofmt, rustfmt, eslint --fix, a `make fmt` / `npm run lint`), run it on only those files and keep only changes to lines you edited (revert any others it made). Check `git diff` shows only comment removals. Make one commit with only your changes (`git add` the files you edited), subject `Remove unnecessary comments`, a line or two of body (what kinds of comments went), then a blank line and:
<attribution>
Don't push and don't amend or rebase anything.

Your report: the short sha, the files touched, how many comments removed (roughly by kind), and any you weren't sure about and left (file:line, one line each). If nothing needed removing, make no commit and say so.
```

The brief holds backticks and quotes: pass it as one argument without letting the shell expand
it, e.g. write it to a file in your scratchpad and pass `-- "$(cat <file>)"`. A new worktree
may show Claude's folder-trust prompt in the skull's pane: tell the person, never answer it.
`split.sh` appends the report-back duty itself; don't add one. `--stay` keeps it open after its
report, for the person's answer below. Tell the person the skull is
out (its pane, model and effort, which branch and folder) and go on; its report arrives
typed into your session.

## 4. The report

As the `wh:servo-skull` skill says (step 4): relay it in a few lines (commit, files, count, the
doubtful ones). Then ask the person:

- whether to **push** the commit (`git push` in that folder; never push without a yes), and
- whether to **close the skull** (`herdr-app do pane.close '{"pane":"<pane>"}'`) or send it
  more orders (`hc send <terminal> "…"`: put back a comment it removed, take out one it left,
  amend the commit), and, if you made a worktree, whether to remove it.

Leave the skull waiting until they answer. A `stuck:` report: read its pane (`hc read
<terminal>`), answer it if the brief already settles the question, else ask the person.
