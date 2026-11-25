---
name: servo-skull
description: Open a new, independent Claude session in a Herdr split pane next to this one, fresh or as a fork of this conversation, optionally in another folder or with a first prompt, on the model and effort that fit its task (haiku / sonnet / opus). Use when the user asks to "split", "open a new claude in a split", "split and start claude", "fork this into a split", or wants another Claude beside them to work in by hand. For coordinated workers that report back, use the conclave skill instead. Only works inside a Herdr terminal ($HC_TERMINAL_ID set).
---

# Open a Claude session in a split

The new session belongs to the person: you open it and step away. Don't send it tasks,
read it or wait on it unless they ask (for workers you coordinate, use the `conclave` skill).

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
~/.claude/skills/servo-skull/split.sh [right|down] [--model M --effort E] [--folder DIR] [--fork] [--profile company|personal] [-- <claude args>]
```

| Want | Command |
|---|---|
| Empty Claude to the right, same folder | `split.sh` |
| Below this pane | `split.sh down` |
| With a task as its first prompt | `split.sh --model sonnet --effort medium -- "Add a CSV export to the reports page"` |
| In another folder (e.g. a worktree) | `split.sh --folder ~/code/app/.claude/worktrees/x` |
| Fork of this conversation | `split.sh --fork --model opus --effort high` |

- It splits **this session's own pane** (found from `$HC_TERMINAL_ID`), not whatever has focus.
- Claude starts through `claude-ws`, so it gets the workspace's profile (company/personal) and
  the `herdr.profile` / `herdr.claude-session` labels, like the person's `cmd-shift-<arrow>` keys.
- A task given as the first prompt runs straight away; write it as a complete brief (goal, scope,
  how to check it), because the new session knows nothing of this conversation unless `--fork`.
- `--fork` copies the whole conversation; mention that it is costly when it is long.
- A folder outside a trusted project shows Claude's folder-trust prompt in the new pane.
  Never answer it yourself (no `hc keys`, no forced sends): tell the person which pane needs them.

## 3. After

The script prints `{"pane": "...", "terminal": "..."}`, or `{"error": ...}` and exits non-zero.
Tell the person the split is open, where, and on which model and effort (with the one-line reason).
If it failed, show the error; check with `herdr-app status` that the window is running.
