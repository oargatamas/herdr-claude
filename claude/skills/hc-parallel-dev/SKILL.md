---
name: hc-parallel-dev
description: Real parallel development with independent Claude workers in Herdr subtabs, coordinated through herdr-core (hc). Each implementing worker gets its own git worktree; workers can start fresh or as a fork of this conversation; all coordination uses hc send / hc wait / hc read / hc interrupt. Use when the user asks to split work across agents, run tasks in parallel, "spin up workers", fan out implementation, delegate to subtabs, or fork this conversation into workers. Only works inside a Herdr terminal ($HC_TERMINAL_ID set).
---

# Parallel development with hc workers

You are the **orchestrator**. You split the work, start workers in their own Herdr subtabs,
answer their questions, and integrate the result. Workers are full, visible Claude sessions
the person can watch, type into and keep; they are not your built-in subagents.

## Preconditions

- `echo $HC_TERMINAL_ID` is set. If not, you are not in Herdr: say so and stop.
- Read `hc --skill` once if you have not this session (it is the hc manual).
- Leftovers from earlier runs are dealt with: run `hc-worker prune`. It removes clean, merged
  `wt/*` worktrees and branches no live worker uses, and lists the rest (uncommitted or unmerged
  work). Tell the person about anything it kept; don't delete those without their say.
- The repo's working tree state is known (`git status`). Workers start from `HEAD`'s
  **commit**: uncommitted changes in the main checkout are NOT in their worktrees. If there
  are any, tell the person and ask whether to commit them first or leave them out.

## Which tool to use

| Need | Use |
|---|---|
| Start a worker (subtab, worktree, profile, task) | `hc-worker start` (below). Do not hand-roll `herdr-app do tab.new`, `hc run` or `git worktree add`: the helper sets the labels, the trusted worktree folder, the profile, the readiness wait and the reporting rules. |
| Worker that needs this conversation's context | `hc-worker start --fork` (copies the whole conversation: costly, use deliberately) |
| Worker that only needs a clear brief | `hc-worker start` without `--fork` (cheaper, cleaner context) |
| Read-only worker (review, research, tests) | `--no-worktree` |
| Quick lookups that don't need a visible, steerable session | Claude's built-in subagents, not hc workers |
| Messages, waiting, steering | `hc send`, `hc wait`, `hc read`, `hc interrupt`, nothing else (no files as chat, no polling, no sleep) |

## 1. Plan, then confirm

Split the work into parts that can be built **independently**:
- Each part has an exact scope: what to build and which files or directories it owns.
  Scopes must not overlap; if two parts must touch the same file, either give the file to one
  of them or do that change yourself first, commit it, then start the workers.
- Shared interfaces (types, API shapes, function signatures) are decided **before** starting,
  and written into every affected worker's task.
- 2 to 4 workers is usually right. More workers means more integration, not more speed.

Show the person the plan: worker names (short, `a-z0-9-`), each scope, fresh or `--fork`,
the branches (`wt/<name>`), and that workers will **commit on their own branches** and you
will merge them into the current branch only after their review. Wait for their go-ahead.

## 2. Start the workers

Run from the repo (your own terminal), one call per worker:

```sh
hc-worker start --name api -- "Implement ... Scope: only src/api/** and its tests. Interface: ... Done when: tests in src/api pass."
hc-worker start --name ui --fork -- "From the plan we agreed, build the UI part. Scope: only frontend/src/filing/**. Done when: ..."
```

- The task you write is the worker's whole brief: goal, scope (files it may touch), agreed
  interfaces, how to verify, what "done" is. Don't add reporting rules: `hc-worker` appends
  them (report with `hc send <you>`, commit on its branch, never push or merge, no sub-workers).
- Output is JSON. `task_sent: false` with a `status` means the worker stopped at a dialog
  (permissions, login, trust). **Never answer a worker's dialogs yourself** (no `hc keys`,
  no `--force` sends): tell the person which tab needs them, then `hc send <name> "<task>"`
  once they've dealt with it (`hc read <name>` first to check).
- Options: `--profile company|personal` (default: yours), `--base REF` (default: `HEAD`),
  `--branch NAME` (default: `wt/<name>`).

Workers inherit your Claude profile, so their tabs show the same COMPANY/PERSONAL badge.
New tabs open without stealing focus.

## 3. Coordinate while they work

Keep doing useful work yourself (the parts you kept, preparing integration), then:

```sh
hc wait --children any      # wakes on the next report or a worker going idle/blocked
```

- Reports arrive as your next input, tagged: `<hc from="t1g api">api: done; details: ...</hc>`.
  Process each, then wait again. `reason: timeout` is a check-in, not a failure: wait again.
- `hc-worker list` shows every worker: status, branch, commits ahead.
- `hc read <name> --lines 60` to see what a worker is doing without disturbing it.
- Answer questions and redirect with `hc send <name> "..."`. Use `hc interrupt <name>` only to
  stop a worker going the wrong way, then send the correction.
- A `blocked` notice from hc means a dialog: that is the person's to answer (see above).
- Workers may message each other directly to agree on an interface; they must mention it in
  their next report. If two workers disagree, you decide and `hc send` both the decision.

## 4. Review and integrate

When a worker reports done:

```sh
git log --oneline HEAD..wt/<name>
git diff HEAD...wt/<name>
```

- Review like a code review: scope respected, interface as agreed, tests run. Send fixes back
  with `hc send <name> "..."` rather than fixing in its worktree yourself.
- Merge only after the person agreed in step 1, one branch at a time, into the current branch:
  `git merge --no-ff wt/<name>` (or the repo's usual way). Run the project's checks after each
  merge. On conflicts: resolve them yourself if trivial, otherwise ask the owning worker.
- Never push, and never merge into a branch other than the one the person is on, unless asked.

## 5. Clean up

```sh
hc-worker stop <name>          # ends it, removes its worktree if clean, deletes its branch if merged
```

- `stop` refuses if the worktree has uncommitted changes: ask the worker to commit, or, if the
  person agrees to discard them, `hc-worker stop <name> --force`.
- An unmerged branch is kept; mention it in your summary (the person may want it).
- Finish with `hc-worker prune`: it catches anything `stop` missed (a worker that ended on its
  own, a run interrupted earlier) and reports what is still there.
- Workers also end when you end, unless started otherwise, but their worktrees and branches
  stay; the `prune` at the start of the next run picks those up.

## 6. Report to the person

Short summary: what each worker did (branch, commits), what was merged, checks run and their
results, anything left (unmerged branches, open questions, workers still running).

## Reference

- `hc-worker start|list|stop|prune` lives in `~/.local/bin/hc-worker`; `hc-worker` with no
  arguments prints its usage. `prune --dry-run` shows what it would do.
- `prune` only touches `wt/*` worktrees under `<repo>/.claude/worktrees/` and `wt/*` branches:
  other worktrees (Claude's own `agent-*`, other tools') are never its business.
- Worktrees: `<repo>/.claude/worktrees/<name>`, inside the already-trusted repo so Claude
  starts there without a trust prompt. `claude --worktree` is not used: it starts from the
  remote's default branch, not the current branch.
- Profiles: `claude-ws` starts Claude with a profile; the SessionStart hook labels each Claude
  terminal with `herdr.profile` and `herdr.claude-session` (which `--fork` uses).
- The person's own shortcuts do the same by hand: `cmd-shift-t` forks into a tab,
  `cmd-ctrl-<arrow>` forks into a split, `cmd-shift-<arrow>` opens a fresh Claude split
  (`cmd-shift-h` lists them). They act on the focused pane, so don't trigger them yourself;
  use `hc-worker`.
