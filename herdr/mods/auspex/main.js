// AUSPEX: read-only engineering readings for the focused terminal's repository, in the
// Mechanicus look. It never changes anything: git and gh are only asked questions
// (git with --no-optional-locks), tests are never run, only their last results read.
// Polls only while its panel is shown; gh answers are cached per repository.
import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex, TextareaState, Textarea } from "gpui-base";
import { exec, spaces, agents, terminals, focused, layout, theme, run, checking } from "herdr";

const GIT_EVERY = 15_000;     // branch, dirty, ahead/behind, last commit
const GH_TTL = 180_000;       // pull requests and CI runs, per repository
const SLOW_TTL = 60_000;      // TODO scan and test results
const TEST_RE = /(^|[\s/])(test|tests|pytest|vitest|jest|rspec|phpunit|mocha|ava|nextest|go test|cargo test|npm test|bun test|pnpm test|yarn test|make test|tox)\b/;

const find = (node, id) => {
  if (node?.id === id) return node;
  for (const c of node?.children ?? []) { const f = find(c, id); if (f) return f; }
  return null;
};

const ago = (ms) => {
  if (!ms) return "";
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  if (s < 86400) return `${Math.round(s / 3600)}h`;
  return `${Math.round(s / 86400)}d`;
};

// statusCheckRollup → "pass" | "fail" | "pending" | null
function rollup(checks) {
  if (!checks?.length) return null;
  let pending = false;
  for (const c of checks) {
    const v = (c.conclusion || c.state || c.status || "").toUpperCase();
    if (["FAILURE", "ERROR", "TIMED_OUT", "CANCELLED", "ACTION_REQUIRED", "STARTUP_FAILURE"].includes(v)) return "fail";
    if (!c.conclusion && c.status && c.status !== "COMPLETED") pending = true;
    if (["PENDING", "EXPECTED", "IN_PROGRESS", "QUEUED", "WAITING"].includes(v)) pending = true;
  }
  return pending ? "pending" : "pass";
}

function runState(r) {
  if (!r) return null;
  if (r.status !== "completed") return "pending";
  return r.conclusion === "success" ? "pass" : ["skipped", "neutral"].includes(r.conclusion) ? "idle" : "fail";
}

async function sh(cmd, args, opts) {
  try { return await exec(cmd, args, { timeout: 15_000, ...opts }); }
  catch (e) { return { code: -1, stdout: "", stderr: String(e?.message ?? e) }; }
}

export default class Auspex extends View {
  init(_props, cx) {
    this.repo = null;          // { root, machine, branch, upstream, ahead, behind, staged, unstaged, untracked, conflicts, commit }
    this.cwdKey = null;
    this.gh = {};              // root → { at, prs, run, error }
    this.slow = {};            // root → { at, todos, todoCount, tests }
    this.busy = false;
    this.notesRoot = null;
    this.notes = TextareaState.new({ placeholder: "Inscribe litanies, TODOs, reminders… (kept on this machine, per repository)" });
    this.notes.set_soft_wrap(true);
    this.notes.on("change", () => {
      if (!this.notesRoot) return;
      try { localStorage.setItem(`notes:${this.notesRoot}`, this.notes.value()); } catch {}
    });
    if (checking()) return;
    // Cheap check every 2s (no processes): follow focus changes at once.
    cx.timer.every(2000, (cx) => {
      if (!this.visible()) return;
      const key = this.focusKey();
      if (key !== this.cwdKey || Date.now() - (this.gitAt ?? 0) > GIT_EVERY) this.refresh(cx);
    });
    this.refresh(cx);
  }

  visible() {
    const root = layout(), panel = find(root, "panel"), body = find(root, "panel-body");
    if (!panel) return true; // shown in another layout or a window
    return !panel.hidden && body?.active === "auspex";
  }

  focusKey() {
    const f = focused(), space = spaces().find((s) => s.id === f?.space) ?? spaces().find((s) => s.active);
    const cwd = f?.cwd ?? space?.folder ?? null;
    return cwd ? `${space?.machine ?? ""}\u0000${cwd}` : null;
  }

  refresh(cx) {
    if (this.busy) return;
    this.busy = true;
    const key = this.focusKey();
    cx.spawn(async (cx) => {
      try {
        this.cwdKey = key;
        this.gitAt = Date.now();
        if (!key) { this.repo = null; return; }
        const [machine, cwd] = key.split("\u0000");
        const on = machine || null;
        const top = await sh("git", ["-C", cwd, "rev-parse", "--show-toplevel"], { on });
        if (top.code !== 0) { this.repo = { root: null, cwd, machine: on }; return; }
        const root = top.stdout.trim();
        const [st, log] = await Promise.all([
          sh("git", ["--no-optional-locks", "-C", root, "status", "--porcelain=v2", "--branch"], { on }),
          sh("git", ["-C", root, "log", "-1", "--format=%h\u0001%s\u0001%ct"], { on }),
        ]);
        const repo = { root, machine: on, staged: 0, unstaged: 0, untracked: 0, conflicts: 0, ahead: 0, behind: 0 };
        for (const line of st.stdout.split("\n")) {
          if (line.startsWith("# branch.head ")) repo.branch = line.slice(14);
          else if (line.startsWith("# branch.upstream ")) repo.upstream = line.slice(18);
          else if (line.startsWith("# branch.ab ")) { const m = line.match(/\+(\d+) -(\d+)/); if (m) { repo.ahead = +m[1]; repo.behind = +m[2]; } }
          else if (line.startsWith("? ")) repo.untracked++;
          else if (line.startsWith("u ")) repo.conflicts++;
          else if (/^[12] /.test(line)) { const xy = line.slice(2, 4); if (xy[0] !== ".") repo.staged++; if (xy[1] !== ".") repo.unstaged++; }
        }
        const [h, s, ct] = log.stdout.trim().split("\u0001");
        if (h) repo.commit = { hash: h, subject: s, at: (+ct) * 1000 };
        this.repo = repo;
        if (root !== this.notesRoot) {
          this.notesRoot = root;
          let saved = "";
          try { saved = localStorage.getItem(`notes:${root}`) ?? ""; } catch {}
          this.notes.set_value(saved);
        }
        cx.notify();
        await Promise.all([this.loadGh(repo), this.loadSlow(repo)]);
      } finally {
        this.busy = false;
        cx.notify();
      }
    });
  }

  async loadGh(repo) {
    const c = this.gh[repo.root];
    if (c && Date.now() - c.at < GH_TTL) return;
    const on = repo.machine, cwd = repo.root;
    const [prs, runs] = await Promise.all([
      sh("gh", ["pr", "list", "--limit", "6", "--json", "number,title,isDraft,headRefName,reviewDecision,statusCheckRollup,author"], { cwd, on }),
      repo.branch && repo.branch !== "(detached)"
        ? sh("gh", ["run", "list", "--branch", repo.branch, "--limit", "1", "--json", "status,conclusion,workflowName,createdAt,displayTitle"], { cwd, on })
        : Promise.resolve({ code: 0, stdout: "[]" }),
    ]);
    const entry = { at: Date.now(), prs: [], run: null, error: null };
    try { if (prs.code === 0) entry.prs = JSON.parse(prs.stdout || "[]"); else entry.error = (prs.stderr || "gh failed").trim().split("\n")[0]; } catch { entry.error = "unreadable gh answer"; }
    try { if (runs.code === 0) entry.run = JSON.parse(runs.stdout || "[]")[0] ?? null; } catch {}
    this.gh[repo.root] = entry;
  }

  async loadSlow(repo) {
    const c = this.slow[repo.root];
    if (c && Date.now() - c.at < SLOW_TTL) return;
    const on = repo.machine, root = repo.root;
    const todo = await sh("git", ["-C", root, "grep", "-n", "-I", "-E", "\\b(TODO|FIXME|HACK|XXX)\\b", "--", "."], { on, timeout: 8000 });
    const lines = todo.code === 0 ? todo.stdout.split("\n").filter(Boolean) : [];
    // Last test results the tools themselves left behind (read only, never run).
    const probe = await sh("sh", ["-c",
      'for f in .pytest_cache/v/cache/lastfailed node_modules/.vite/vitest/results.json node_modules/.vitest/results.json; do [ -f "$f" ] && echo "$f $(date -r "$f" +%s)"; done; true'],
      { cwd: root, on });
    let tests = null;
    for (const line of probe.stdout.split("\n").filter(Boolean)) {
      const i = line.lastIndexOf(" "), file = line.slice(0, i), at = +line.slice(i + 1) * 1000;
      if (tests && tests.at >= at) continue;
      const text = await sh("cat", [file], { cwd: root, on });
      try {
        const data = JSON.parse(text.stdout || "{}");
        if (file.includes("pytest")) {
          const failed = Object.keys(data).length;
          tests = { tool: "pytest", at, failed, ok: failed === 0 };
        } else {
          const results = Object.values(data.results ?? {});
          const failed = results.filter((r) => r?.failed).length;
          tests = { tool: "vitest", at, failed, total: results.length, ok: failed === 0 };
        }
      } catch {}
    }
    // A test command hc ran in this repository (e.g. `hc run --bg --name test bun test`).
    for (const term of terminals()) {
      const cmd = (term.argv ?? []).join(" ");
      if (term.state !== "finished" || !TEST_RE.test(cmd) || !(term.cwd ?? "").startsWith(root)) continue;
      const at = term.finished_ms ?? 0;
      if (!tests || at > tests.at) tests = { tool: cmd.replace(/^.*?(\S+ test\b|\S*test\S*)/, "$1").slice(0, 40), at, ok: term.exit_code === 0, code: term.exit_code };
    }
    this.slow[root] = { at: Date.now(), todoCount: lines.length, todos: lines.slice(0, 8), tests };
  }

  render() {
    const t = theme();
    const tone = (s) => ({ pass: t.done, fail: t.blocked, pending: t.working, idle: t.dim }[s] ?? t.dim);
    const word = (s) => ({ pass: "BLESSED", fail: "CORRUPTED", pending: "IN RITE", idle: "DORMANT" }[s] ?? "—");
    const heading = (glyph, title, extra) => h_flex().mt(10).mb(4).gap(6).items_center().text_size(11).text_color(t.accent)
      .child(glyph).child(title).child(div().flex_1().h(1).bg(t.border)).when(Boolean(extra), (el) => el.child(div().text_color(t.dim).child(extra)));
    const row = (label, value, color) => h_flex().gap(8).text_size(12)
      .child(div().w(78).flex_none().text_color(t.dim).child(label))
      .child(div().flex_1().min_w(0).truncate().text_color(color ?? t.foreground).child(value));
    const plate = (text, color) => div().flex_none().px(4).border(1).border_color(color).text_color(color).text_size(10).child(text);

    const r = this.repo, gh = r?.root ? this.gh[r.root] : null, slow = r?.root ? this.slow[r.root] : null;
    const body = v_flex().px(12).pb(14);

    // ── Repository
    body.child(heading("⚙", "REPO-SPIRIT", this.busy ? "consulting…" : ""));
    if (!r) body.child(row("focus", "no terminal focused", t.dim));
    else if (!r.root) body.child(row("folder", r.cwd, t.muted)).child(row("git", "not a sanctified repository", t.dim));
    else {
      const dirty = r.staged + r.unstaged + r.untracked + r.conflicts;
      body.child(row("repo", r.root.split("/").pop() + (r.machine ? ` @${r.machine}` : "")))
        .child(row("branch", r.branch ?? "?", t.accent))
        .child(row("upstream", r.upstream ? `${r.upstream}  ↑${r.ahead} ↓${r.behind}` : "none bound", r.upstream ? (r.behind ? t.working : t.foreground) : t.dim))
        .child(row("state", dirty ? `+${r.staged} staged · ~${r.unstaged} changed · ?${r.untracked} new${r.conflicts ? ` · ✕${r.conflicts} conflict` : ""}` : "pure (clean)", r.conflicts ? t.blocked : dirty ? t.working : t.done))
        .when(Boolean(r.commit), (el) => el.child(row("last", `${r.commit.hash} ${r.commit.subject} · ${ago(r.commit.at)}`, t.muted)));
    }

    // ── PRs and CI
    if (r?.root) {
      body.child(heading("✠", "PULL-PETITIONS & CI", gh ? ago(gh.at) : "…"));
      if (!gh) body.child(row("gh", "awaiting the noosphere…", t.dim));
      else {
        if (gh.run) {
          const s = runState(gh.run);
          body.child(h_flex().gap(6).items_center().text_size(12)
            .child(div().w(78).flex_none().text_color(t.dim).child("branch CI"))
            .child(plate(word(s), tone(s)))
            .child(div().flex_1().min_w(0).truncate().text_color(t.muted).child(`${gh.run.workflowName} · ${ago(Date.parse(gh.run.createdAt))}`)));
        }
        if (gh.error) body.child(row("gh", gh.error, t.dim));
        else if (!gh.prs.length) body.child(row("open PRs", "none", t.dim));
        else for (const pr of gh.prs) {
          const s = rollup(pr.statusCheckRollup), mine = pr.headRefName === r.branch;
          body.child(h_flex().gap(6).items_center().text_size(12).py(1)
            .child(div().w(44).flex_none().text_color(mine ? t.accent : t.dim).child(`#${pr.number}`))
            .child(div().flex_1().min_w(0).truncate().text_color(mine ? t.foreground : t.muted).child(`${pr.isDraft ? "[draft] " : ""}${pr.title}`))
            .when(pr.reviewDecision === "APPROVED", (el) => el.child(plate("✓", t.done)))
            .when(pr.reviewDecision === "CHANGES_REQUESTED", (el) => el.child(plate("Δ", t.blocked)))
            .child(plate(s ? word(s) : "—", tone(s))));
        }
      }
    }

    // ── Tests
    if (r?.root) {
      body.child(heading("☩", "RITE OF TESTING", ""));
      const tests = slow?.tests;
      if (!slow) body.child(row("last", "…", t.dim));
      else if (!tests) body.child(row("last", "no recorded rite (pytest/vitest cache, hc runs)", t.dim));
      else body.child(h_flex().gap(6).items_center().text_size(12)
        .child(div().w(78).flex_none().text_color(t.dim).child("last"))
        .child(plate(tests.ok ? "BLESSED" : "CORRUPTED", tests.ok ? t.done : t.blocked))
        .child(div().flex_1().min_w(0).truncate().text_color(t.muted)
          .child(`${tests.tool}${tests.failed ? ` · ${tests.failed} failed` : ""}${tests.total ? `/${tests.total}` : ""}${tests.code != null && !tests.ok ? ` · exit ${tests.code}` : ""} · ${ago(tests.at)}`)));
    }

    // ── Agents and terminals
    const list = agents(), live = terminals().filter((x) => x.state === "live").length;
    const count = (s) => list.filter((a) => a.status === s).length;
    body.child(heading("☠", "SERVITORS", `${live} terminals`));
    body.child(h_flex().gap(6).mb(4).flex_wrap()
      .child(plate(`WORKING ${count("working")}`, t.working))
      .child(plate(`BLOCKED ${count("blocked")}`, t.blocked))
      .child(plate(`DONE ${count("done")}`, t.done))
      .child(plate(`IDLE ${count("idle")}`, t.idle)));
    const order = { blocked: 0, working: 1, done: 2, idle: 3 };
    for (const a of [...list].sort((x, y) => (order[x.status] ?? 9) - (order[y.status] ?? 9)).slice(0, 8)) {
      const where = spaces().find((s) => s.id === a.space)?.name ?? "";
      body.child(h_flex().id(`agent-${a.terminal}`).gap(6).items_center().text_size(12).py(1).px(2).cursor_pointer()
        .hover((s) => s.bg(t.hover)).on_click(() => run("agent.focus", { terminal: a.terminal }))
        .child(div().size(6).flex_none().bg(t[a.status] ?? t.dim))
        .child(div().w(90).flex_none().truncate().text_color(t.foreground).child(where))
        .child(div().flex_1().min_w(0).truncate().text_color(t.muted).child(a.title || a.program?.name || a.terminal)));
    }

    // ── TODOs
    if (r?.root) {
      body.child(heading("◈", "HERESIES TO PURGE", slow ? `${slow.todoCount} TODO/FIXME` : "…"));
      for (const line of slow?.todos ?? []) {
        const m = line.match(/^([^:]+):(\d+):(.*)$/);
        if (!m) continue;
        body.child(v_flex().py(1)
          .child(div().text_size(10.5).text_color(t.dim).truncate().child(`${m[1]}:${m[2]}`))
          .child(div().text_size(11.5).text_color(t.muted).truncate().child(m[3].trim())));
      }
    }

    // ── Notes
    if (r?.root) {
      body.child(heading("✎", "DATA-LITANY (NOTES)", ""));
      body.child(div().id("notes").border(1).border_color(t.border).bg(t.background).p(6).text_size(12).text_color(t.foreground)
        .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
        .child(Textarea.new(this.notes).h(120).w_full()));
    }

    return v_flex().size_full().min_h(0).bg(t.chrome).border_l(1).border_color(t.input)
      .child(h_flex().h(34).flex_none().px(12).gap(8).items_center().border_b(1).border_color(t.input).text_size(12).text_color(t.accent)
        .child("+++ AUSPEX +++")
        .child(div().flex_1().text_size(10).text_color(t.dim).truncate().child("noospheric readings · read-only")))
      .child(div().id("auspex-scroll").flex_1().min_h(0).overflow_y_scrollbar().child(body));
  }
}
