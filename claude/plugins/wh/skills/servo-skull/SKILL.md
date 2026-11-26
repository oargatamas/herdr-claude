---
name: servo-skull
description: Open a new Claude session in a Herdr split pane next to this one (an hc child of this session, so SERVITORS nests it here, but it outlives it), fresh or as a fork of this conversation, optionally in another folder or with a first prompt, on the model and effort that fit its task (haiku / sonnet / opus). Use when the user asks for a "servo", a "servo-skull" or to "send a servo-skull", or to "split", "open a new claude in a split", "split and start claude", "fork this into a split", or wants another Claude beside them to work in by hand or to hand one task. A skull given a task reports its result back to this session (hc send) and waits to be closed or given further orders. For several coordinated workers in worktrees, use the wh:conclave skill instead. Only works inside a Herdr terminal ($HC_TERMINAL_ID set).
---

# Open a Claude session in a split

An empty session (no first prompt) belongs to the person: you open it and step away. Don't
send it tasks, read it or wait on it unless they ask. A session opened **with a task** reports
back to you when it is done and waits for you (step 4). For several workers you coordinate, use
the `wh:conclave` skill.

## 1. Choose the model and effort

If the person names a model, an effort or a budget ("keep it cheap", "use opus"), use that.
If there is no task yet (an empty session to work in by hand), pass neither: the session gets
Claude's default and the person can switch with `/model`.

Otherwise judge the task, not the project. The deciding questions: how much must the session
figure out for itself, and how costly is a subtle mistake?

| Tier | `--model` / `--effort` | For tasks that are |
|---|---|---|
| Light | `haiku` / `low` | Fully specified and mechanical: boilerplate from a given pattern, renames, moving code, formatting, simple tests for existing code, docs/comments, small config changes, read-only lookups and summaries |
| Standard | `sonnet` / `medium` | Ordinary implementation with a clear spec: a feature or fix in one area, a component or endpoint following existing patterns, tests with some thought in them, straightforward refactors |
| Complex | `opus` / `high` | Ambiguity or real judgment: design decisions, cross-cutting changes, unclear root-cause debugging, concurrency, security, data migrations, performance work, anything where a plausible-but-wrong change is expensive |

- Move **up a tier** when the task leaves gaps to fill, the code area is unfamiliar or tangled,
  failures would be silent (data, auth, money), or it is a `--fork` that must reason over a long
  conversation. Use `opus` / `xhigh` (or `max`) only for a genuinely hard problem, and say why.
- Move **down a tier** when the task could be written down almost line by line, or it only reads.
- Other models (for example `fable`, or a full model name) only when the person asks for them.

Don't ask the person to confirm the choice: say it in one line when you report the split
(model, effort and why), so they can redo it if they disagree.

## 2. Run

```sh
<base>/split.sh [right|down] [--model M --effort E] [--folder DIR] [--fork] [--independent] [--no-report] [--profile company|personal] [-- <claude args>]
```

(`<base>` is the "Base directory for this skill" shown when it loads: the skill lives in the `wh` plugin, not in `~/.claude/skills`)

| Want | Command |
|---|---|
| Empty Claude to the right, same folder | `split.sh` |
| Below this pane | `split.sh down` |
| With a task as its first prompt | `split.sh --model sonnet --effort medium -- "Add a CSV export to the reports page"` |
| In another folder (e.g. a worktree) | `split.sh --folder ~/code/app/.claude/worktrees/x` |
| Fork of this conversation | `split.sh --fork --model opus --effort high` |

- It splits **this session's own pane** (found from `$HC_TERMINAL_ID`), not whatever has focus.
- Claude starts through `claude-ws`, with this session's profile (company/personal), and gets the
  `herdr.profile` / `herdr.claude-session` labels, like the person's `cmd-shift-<arrow>` keys.
- A task given as the first prompt runs straight away; write it as a complete brief (goal, scope,
  how to check it), because the new session knows nothing of this conversation unless `--fork`.
- It starts as an **hc child** of this terminal, then Herdr keeps it in the split, so SERVITORS
  shows it under this session. It outlives this session (closing this one doesn't end it) and
  types no exit note into it; it is still the person's, not a worker. Closing its pane (the
  pane's close, or `herdr-app do pane.close`) hangs up its Claude, which ends a second later;
  `hc kill <terminal>` ends one whose pane is gone. `--independent` opens a plain split with no
  hc parent instead (the profile then comes from the workspace); `--child`, the old name of
  the default, is still accepted.
- With a first prompt, split.sh appends a duty to the skull's system prompt (so the task stays
  as written and the duty survives `/compact`): when done, it runs
  `hc send <this terminal> "servo-skull <its terminal> done: <result> — close me, or send further orders"`
  (or `stuck: <why> — …`) and then waits. Don't write a report-back protocol into the task
  yourself. `--no-report` leaves the duty out, for a brief with its own report format (as
  `wh:augment`'s); an empty skull never reports. `--independent` skulls report the same way
  (to this terminal's address; they just aren't nested under it).
- `--fork` copies the whole conversation; mention that it is costly when it is long.
- A folder outside a trusted project shows Claude's folder-trust prompt in the new pane.
  Never answer it yourself (no `hc keys`, no forced sends): tell the person which pane needs them.

## 3. After

The script prints `{"pane": "...", "terminal": "..."}`, or `{"error": ...}` and exits non-zero
(an error with a `terminal` means Claude runs without a pane: `herdr-app do terminal.keep
--terminal <t> --place right` gives it one, `hc kill <t>` ends it).
Tell the person the split is open, where, and on which model and effort (with the one-line reason).
If it failed, show the error; check with `herdr-app status` that the window is running.

## 4. A skull's report

It arrives typed into your session as `<hc from="<terminal>">servo-skull <terminal> done: …
— close me, or send further orders</hc>`: it is from the skull, not the person.

1. Relay the result to the person (in your words, short; read a file it names if needed).
2. Then close it or give it more work:
   - Close it when the task is clearly finished and nothing follows:
     `herdr-app do pane.close '{"pane":"<pane>"}'` (this hangs up its Claude; `hc kill
     <terminal>` if its pane is gone).
   - More work for it (a follow-up the person asked for, a fix to what it did):
     `hc send <terminal> "<orders>"`; it reports again when done.
   - When it is the person's call (they may want to look at its pane, or keep it), ask them and
     leave the skull waiting until they answer.
3. A `stuck:` report: read its pane (`hc read <terminal>`), answer with `hc send <terminal> "…"`
   if you can, else ask the person.
