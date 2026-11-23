// AUSPEX sections:
//   REPO-SPIRIT: git branch, upstream ahead/behind, dirty counts, last commit (icon: full
//     message in a dialog), submodules with their state and branch (found for detached commits)
//   PULL-PETITIONS & CI: the PR of every session in the shown tab and PR links found in
//     those terminals' text, with checks and review state (via gh)
//   Jira keys (ABC-123) in branches and PR titles get a link to the Jira site seen in sessions
//   DATA-LITANY: per-repo notes
// AUSPEX: read-only engineering readings for the focused terminal's repository, in the
// Mechanicus look. It never changes anything: git and gh are only asked questions
// (git with --no-optional-locks).
// Polls only while shown; gh answers are cached per branch and link.
import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex, TextareaState, Textarea } from "gpui-base";
import { exec, hc, spaces, panes, terminals, focused, layout, theme, window, home, shared, props, openOverlay, closeOverlay, checking } from "herdr";

// Sidebar animations on unless stilled with a click on the brand emblem.
const motion = () => shared("mechanicus.motion") !== false;
// Header litanies, shown in turn.
const LITANIES = [
  "noospheric readings · read-only",
  "the Omnissiah knows all",
  "machine-spirit appeased",
  "praise the Omnissiah",
  "knowledge is power, guard it well",
  "flesh is weak, the machine endures",
];
// Binharic cant for the ticker: fixed pseudo-random bytes, so the strings stay the same across renders.
const CANT = Array.from({ length: 16 }, (_, i) => ((i * 197 + 89) % 256).toString(2).padStart(8, "0") + " " + ((i * 71 + 13) % 256).toString(16).padStart(2, "0").toUpperCase());

const GIT_EVERY = 15_000;     // branch, dirty, ahead/behind, last commit
const GH_TTL = 180_000;       // gh answers, per branch and per link
const MENTION_EVERY = 60_000; // re-read the shown tab's terminals for PR links
const MENTION_LINES = 400;    // history lines read above each screen
// GitHub pull requests, GitLab merge requests, Bitbucket pull requests.
const PR_URL_RE = /https?:\/\/(?:github\.com\/[\w.-]+\/[\w.-]+\/pull\/\d+|gitlab\.[\w.-]+\/[\w./-]+?\/-\/merge_requests\/\d+|bitbucket\.org\/[\w.-]+\/[\w.-]+\/pull-requests\/\d+)/g;

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

// Jira issue keys (ABC-123) in a branch or title; common non-issue look-alikes are skipped.
const JIRA_RE = /\b([A-Z][A-Z0-9]{1,9})-(\d{1,6})\b/g;
const NOT_JIRA = new Set(["UTF", "ISO", "SHA", "RFC", "HTTP", "TLS", "SSL", "CVE", "GPT", "MD5", "X11", "AES", "RSA"]);
const jiraKeys = (...texts) => {
  const keys = [];
  for (const text of texts) for (const m of (text ?? "").toUpperCase().matchAll(JIRA_RE))
    if (!NOT_JIRA.has(m[1]) && !keys.includes(m[0])) keys.push(m[0]);
  return keys;
};
const JIRA_SITE_RE = /https:\/\/([\w-]+\.atlassian\.net)\/browse\//g;

// "~/…" for a folder under home.
const short = (cwd) => { const h = home(); return !cwd ? "" : cwd === h ? "~" : cwd.startsWith(h + "/") ? "~" + cwd.slice(h.length) : cwd; };

async function sh(cmd, args, opts) {
  try { return await exec(cmd, args, { timeout: 15_000, ...opts }); }
  catch (e) { return { code: -1, stdout: "", stderr: String(e?.message ?? e) }; }
}

const SUB_EVERY = 30_000;     // submodule details, per repository

// The branch a checkout is on; for a detached commit, a branch pointing at it, else the
// nearest branch containing it (git name-rev, e.g. "origin/main~3": 3 commits below its tip).
async function branchOf(dir, on) {
  const head = await sh("git", ["-C", dir, "symbolic-ref", "-q", "--short", "HEAD"], { on });
  if (head.code === 0 && head.stdout.trim()) return { name: head.stdout.trim(), detached: false };
  const at = await sh("git", ["-C", dir, "for-each-ref", "--points-at", "HEAD", "--format=%(refname:short)", "refs/heads", "refs/remotes"], { on });
  const refs = at.stdout.split("\n").map((x) => x.trim()).filter((x) => x && !x.endsWith("/HEAD"));
  if (refs.length) return { name: refs[0], detached: true };
  const nr = await sh("git", ["-C", dir, "name-rev", "--name-only", "--no-undefined", "--exclude=tags/*", "HEAD"], { on });
  const name = nr.code === 0 ? nr.stdout.trim().replace(/^remotes\//, "") : "";
  return { name: name || null, detached: true };
}

// Dirty counts and upstream from `git status --porcelain=v2 --branch`.
function parseStatus(text, into) {
  Object.assign(into, { staged: 0, unstaged: 0, untracked: 0, conflicts: 0, ahead: 0, behind: 0 });
  for (const line of text.split("\n")) {
    if (line.startsWith("# branch.head ")) into.head = line.slice(14);
    else if (line.startsWith("# branch.upstream ")) into.upstream = line.slice(18);
    else if (line.startsWith("# branch.ab ")) { const m = line.match(/\+(\d+) -(\d+)/); if (m) { into.ahead = +m[1]; into.behind = +m[2]; } }
    else if (line.startsWith("? ")) into.untracked++;
    else if (line.startsWith("u ")) into.conflicts++;
    else if (/^[12] /.test(line)) { const xy = line.slice(2, 4); if (xy[0] !== ".") into.staged++; if (xy[1] !== ".") into.unstaged++; }
  }
  return into;
}

// "github.com:acme/widgets.git" / "../widgets" → "widgets".
const repoName = (url) => (url ?? "").replace(/\/+$/, "").replace(/\.git$/, "").split(/[\/:]/).pop() || url;

// submodule path (relative to the repo that declares it) → url, from that repo's .gitmodules.
async function gitmodules(dir, on) {
  const r = await sh("git", ["config", "-f", `${dir}/.gitmodules`, "--get-regexp", "^submodule\\..*\\.(path|url)$"], { on });
  const byName = {};
  for (const line of r.stdout.split("\n")) {
    const m = line.match(/^submodule\.(.+)\.(path|url) (.+)$/);
    if (m) (byName[m[1]] ??= {})[m[2]] = m[3];
  }
  return Object.fromEntries(Object.values(byName).filter((x) => x.path).map((x) => [x.path, x.url]));
}

async function lastCommit(dir, on) {
  const log = await sh("git", ["-C", dir, "log", "-1", "--format=%h\u0001%s\u0001%ct"], { on });
  const [hash, subject, ct] = log.stdout.trim().split("\u0001");
  return hash ? { hash, subject, at: (+ct) * 1000 } : null;
}

export default class Auspex extends View {
  init(_props, cx) {
    // Opened as the commit dialog: { commit: { dir, on, hash, branch, label } }.
    const spec = props()?.commit;
    if (spec) {
      this.dialog = spec;
      cx.spawn(async (cx) => {
        const r = await sh("git", ["-C", spec.dir, "show", "-s", "--format=%H%x01%an <%ae>%x01%ad%x01%B", "--date=format:%Y-%m-%d %H:%M", spec.hash], { on: spec.on });
        const [full, author, date, ...msg] = r.stdout.split("\u0001");
        this.full = r.code === 0 ? { full, author, date, message: msg.join("\u0001").replace(/\s+$/, "") } : { error: (r.stderr || "git failed").trim() };
        cx.notify();
      });
      return;
    }
    this.subs = {};            // root → { at, list: [{ path, parent, name, url, mark, recorded, ...status, branch, commit }] }
    this.subOpen = new Set();  // opened submodule nodes (repo|path); all start collapsed
    this.repo = null;          // { root, machine, branch, upstream, ahead, behind, staged, unstaged, untracked, conflicts, commit }
    this.cwdKey = null;
    this.busy = false;
    this.tabPrs = [];          // [{ key, sessions: [names], branch, cwd, pr, error }] for the shown tab
    this.prCache = {};         // machine|cwd|branch → { at, pr, error }
    this.mentions = [];        // [{ url, sessions: [names], pr }] PR links seen in the shown tab's terminals
    this.urlCache = {};        // url → { at, pr }
    try { this.jiraSite = localStorage.getItem("jira-site"); } catch { this.jiraSite = null; } // e.g. acme.atlassian.net
    this.tabKeyNow = null;
    this.tabBusy = false;
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
      const tk = this.tabKey();
      if (tk !== this.tabKeyNow || Date.now() - (this.tabAt ?? 0) > MENTION_EVERY) this.loadTab(cx);
    });
    this.refresh(cx);
    this.loadTab(cx);
  }

  // In the sidebar: shown unless the auspex block or the sidebar is hidden, or the sidebar is a rail.
  visible() {
    const root = layout(), me = find(root, "auspex"), sidebar = find(root, "sidebar");
    if (!me) return true; // shown in another layout or a window
    return !me.hidden && !sidebar?.hidden && (sidebar?.size?.px ?? Infinity) >= 160;
  }

  focusKey() {
    // A copy opened with props.cwd (e.g. as a window) stays on that folder instead of following focus.
    if (props()?.cwd) return `${props().machine ?? ""}\u0000${props().cwd}`;
    const f = focused(), space = spaces().find((s) => s.id === f?.space) ?? spaces().find((s) => s.active);
    const cwd = f?.cwd ?? space?.folder ?? null;
    return cwd ? `${space?.machine ?? ""}\u0000${cwd}` : null;
  }

  // The shown tab's terminal sessions with a git branch, as "machine|cwd|branch" keys.
  tabSessions() {
    const f = focused();
    const space = spaces().find((s) => s.id === f?.space) ?? spaces().find((s) => s.active);
    const tab = f?.tab ?? space?.tabs?.find((x) => x.active)?.id;
    const machine = space?.machine ?? "";
    return panes().filter((p) => p.tab === tab && p.terminal && p.cwd && p.branch && p.branch !== "HEAD")
      .map((p) => ({ key: `${machine}|${p.cwd}|${p.branch}`, machine: machine || null, cwd: p.cwd, branch: p.branch,
        name: (p.program?.agent || p.program?.shell) && p.program.name ? p.program.name : p.title || p.terminal }));
  }

  tabKey() {
    const f = focused();
    const terms = panes().filter((p) => p.tab === f?.tab && p.terminal).map((p) => p.terminal).sort().join(",");
    return `${f?.tab}|${terms}|` + this.tabSessions().map((x) => x.key).sort().join("\n");
  }

  // PR links in the shown tab's terminals: each screen (plus MENTION_LINES of history on a
  // normal screen; full-screen apps are never scrolled) and, for a Claude session, its whole
  // transcript (found by the herdr.claude-session / herdr.profile labels; read-only grep).
  async scanMentions() {
    const f = focused();
    const space = spaces().find((s) => s.id === f?.space) ?? spaces().find((s) => s.active);
    const tab = f?.tab ?? space?.tabs?.find((x) => x.active)?.id;
    const found = new Map(); // url → names
    let site = null;
    for (const p of panes().filter((x) => x.tab === tab && x.terminal)) {
      const r = await hc(["read", p.terminal, "--lines", String(p.scroll ? MENTION_LINES : 0)]).catch(() => null);
      if (!r || r.code !== 0) continue;
      const name = (p.program?.agent || p.program?.shell) && p.program.name ? p.program.name : p.title || p.terminal;
      let text = r.stdout;
      const labels = terminals().find((x) => x.address === p.terminal)?.labels ?? {};
      const sid = labels["herdr.claude-session"];
      if (sid && /^[\w-]+$/.test(sid)) {
        const dir = labels["herdr.profile"] === "personal" ? "$HOME/.claude-personal" : "$HOME/.claude";
        const g = await sh("sh", ["-c", `grep -ohE -e 'https?://[^"\\\\ )<>]+/(pull|merge_requests|pull-requests)/[0-9]+' -e 'https://[A-Za-z0-9-]+\\.atlassian\\.net/browse/' ${dir}/projects/*/"$1".jsonl 2>/dev/null | tail -n 300; true`, "sh", sid], { on: space?.machine ?? null });
        text = g.stdout + "\n" + text; // transcript first, the screen (newest) last
      }
      for (const m of text.matchAll(JIRA_SITE_RE)) site = m[1]; // the last one seen wins
      for (const m of text.matchAll(PR_URL_RE)) {
        const url = m[0].replace(/[).,;:'"\]]+$/, "");
        const names = found.get(url) ?? [];
        if (!names.includes(name)) names.push(name);
        found.delete(url); // re-insert: Map order = last seen, newest at the end
        found.set(url, names);
      }
    }
    if (site && site !== this.jiraSite) {
      this.jiraSite = site;
      try { localStorage.setItem("jira-site", site); } catch {}
    }
    // Details from gh for GitHub links (cached GH_TTL); other hosts show as plain links.
    await Promise.all([...found.keys()].filter((u) => u.includes("github.com/")).map(async (url) => {
      const c = this.urlCache[url];
      if (c && Date.now() - c.at < GH_TTL) return;
      const r = await sh("gh", ["pr", "view", url, "--json", "number,title,url,state,isDraft,reviewDecision,statusCheckRollup"]);
      let pr = null;
      try { if (r.code === 0) pr = JSON.parse(r.stdout); } catch {}
      this.urlCache[url] = { at: Date.now(), pr };
    }));
    const own = new Set(this.tabPrs.map((g) => g.pr?.url).filter(Boolean));
    this.mentions = [...found.entries()].filter(([url]) => !own.has(url)).slice(-12).reverse()
      .map(([url, sessions]) => ({ url, sessions, pr: this.urlCache[url]?.pr ?? null }));
  }

  // One `gh pr list --head <branch>` per session branch, cached GH_TTL; sessions on the same PR merge.
  loadTab(cx) {
    if (this.tabBusy) return;
    this.tabBusy = true;
    const sessions = this.tabSessions();
    this.tabKeyNow = this.tabKey();
    cx.spawn(async (cx) => {
      try {
        this.tabAt = Date.now();
        await Promise.all([...new Map(sessions.map((x) => [x.key, x])).values()].map(async (x) => {
          const c = this.prCache[x.key];
          if (c && Date.now() - c.at < GH_TTL) return;
          const r = await sh("gh", ["pr", "list", "--head", x.branch, "--state", "open", "--limit", "1",
            "--json", "number,title,url,isDraft,reviewDecision,statusCheckRollup"], { cwd: x.cwd, on: x.machine });
          let pr = null, error = null;
          try { if (r.code === 0) pr = JSON.parse(r.stdout || "[]")[0] ?? null; else error = (r.stderr || "gh failed").trim().split("\n")[0]; } catch { error = "unreadable gh answer"; }
          this.prCache[x.key] = { at: Date.now(), pr, error };
        }));
        const groups = new Map();
        for (const x of sessions) {
          const c = this.prCache[x.key] ?? {};
          const id = c.pr?.url ?? `${x.machine ?? ""}|${x.cwd}|${x.branch}`;
          const g = groups.get(id) ?? { id, sessions: [], branch: x.branch, cwd: x.cwd, pr: c.pr ?? null, error: c.error ?? null };
          if (!g.sessions.includes(x.name)) g.sessions.push(x.name);
          groups.set(id, g);
        }
        // PRs first, then branches without one.
        this.tabPrs = [...groups.values()].sort((a, b) => (b.pr ? 1 : 0) - (a.pr ? 1 : 0));
        cx.notify();
        await this.scanMentions();
      } finally {
        this.tabBusy = false;
        cx.notify();
      }
    });
  }

  // Opens a PR in the browser (only on a click).
  open(url) {
    const p = window()?.platform;
    sh(p === "macos" ? "open" : p === "windows" ? "explorer" : "xdg-open", [url]);
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
        const [st, commit] = await Promise.all([
          sh("git", ["--no-optional-locks", "-C", root, "status", "--porcelain=v2", "--branch"], { on }),
          lastCommit(root, on),
        ]);
        const repo = parseStatus(st.stdout, { root, machine: on, commit });
        repo.branch = repo.head;
        if (repo.head === "(detached)") { const b = await branchOf(root, on); repo.branch = null; repo.detachedOn = b.name; }
        this.repo = repo;
        if (root !== this.notesRoot) {
          this.notesRoot = root;
          let saved = "";
          try { saved = localStorage.getItem(`notes:${root}`) ?? ""; } catch {}
          this.notes.set_value(saved);
        }
        cx.notify();
        await this.loadSubs(root, on);
      } finally {
        this.busy = false;
        cx.notify();
      }
    });
  }

  // Submodules (recursive) as a tree by nesting: name from the declaring .gitmodules url,
  // recorded vs checked-out commit, dirty counts, branch, last commit.
  async loadSubs(root, on) {
    const c = this.subs[root];
    if (c && Date.now() - c.at < SUB_EVERY) return;
    const st = await sh("git", ["-C", root, "submodule", "status", "--recursive"], { on });
    const list = [];
    for (const line of st.stdout.split("\n")) {
      const m = line.match(/^([ +\-U])([0-9a-f]+) (\S+)/);
      if (m) list.push({ mark: m[1], recorded: m[2].slice(0, 7), path: m[3] });
    }
    // Names: each repo that declares submodules (the root and initialized parents) has a .gitmodules.
    list.sort((a, b) => a.path.localeCompare(b.path));
    for (const x of list) x.parent = list.filter((y) => x.path.startsWith(y.path + "/")).sort((a, b) => b.path.length - a.path.length)[0]?.path ?? null;
    const declarers = [{ dir: root, prefix: "" }, ...list.filter((x) => x.mark !== "-" && list.some((y) => y.parent === x.path)).map((x) => ({ dir: `${root}/${x.path}`, prefix: `${x.path}/` }))];
    const urls = {};
    for (const d of await Promise.all(declarers.map(async (d) => ({ ...d, map: await gitmodules(d.dir, on) }))))
      for (const [path, url] of Object.entries(d.map)) urls[d.prefix + path] = url;
    for (const x of list) { x.url = urls[x.path] ?? null; x.name = repoName(x.url) || x.path.split("/").pop(); }
    await Promise.all(list.slice(0, 32).map(async (x) => {
      if (x.mark === "-") return; // not initialized: nothing checked out to read
      const dir = `${root}/${x.path}`;
      const [s, commit, branch] = await Promise.all([
        sh("git", ["--no-optional-locks", "-C", dir, "status", "--porcelain=v2", "--branch"], { on }),
        lastCommit(dir, on),
        branchOf(dir, on),
      ]);
      parseStatus(s.stdout, x);
      Object.assign(x, { dir, commit, branch });
    }));
    this.subs[root] = { at: Date.now(), list };
  }

  // Opens or closes one submodule node (until AUSPEX restarts; they start collapsed).
  toggleSub(key) {
    if (this.subOpen.has(key)) this.subOpen.delete(key); else this.subOpen.add(key);
  }

  // Full commit message in a dialog (this mod, opened again with props.commit).
  showCommit(dir, on, commit, label) {
    openOverlay({ mod: "auspex", kind: "dialog", width: 620, height: 440, props: { commit: { dir, on, hash: commit.hash, label } } });
  }

  renderDialog() {
    const t = theme(), d = this.dialog, f = this.full;
    const meta = (k, v) => h_flex().gap(8).text_size(12).child(div().w(64).flex_none().text_color(t.dim).child(k)).child(div().flex_1().min_w(0).truncate().text_color(t.foreground).child(v ?? ""));
    const lines = (f?.message ?? "").split("\n");
    return v_flex().size_full().bg(t.popover).border(1).border_color(t.accent)
      .child(h_flex().h(36).flex_none().px(14).gap(8).items_center().border_b(1).border_color(t.input).text_color(t.accent).text_size(12)
        .child(svg("mods/chrome-mechanicus/gear.svg").size(13).when(motion(), (g) => g.spin(9000)))
        .child(`DATA-SCROLL · ${d.label ?? ""} · ${d.hash}`).child(div().flex_1())
        .child(div().id("close-scroll").px(6).cursor_pointer().text_color(t.dim).hover((el) => el.text_color(t.foreground))
          .on_click(() => closeOverlay(props().overlay)).child(svg("mods/chrome-mechanicus/x.svg").size(13))))
      .child(!f ? div().p(14).text_size(12).text_color(t.dim).child("consulting the archive…")
        : f.error ? div().p(14).text_size(12).text_color(t.blocked).child(f.error)
        : v_flex().flex_1().min_h(0).p(14).gap(3)
          .child(meta("commit", f.full)).child(meta("author", f.author)).child(meta("date", f.date))
          .child(div().h(1).my(8).bg(t.border))
          .child(div().id("scroll-body").flex_1().min_h(0).overflow_y_scrollbar()
            .child(v_flex().gap(2).text_size(12.5).text_color(t.foreground)
              .children(lines.map((l, i) => l.trim() ? div().whitespace_normal().text_color(i === 0 ? t.accent : t.foreground).child(l) : div().h(8))))));
  }

  render() {
    if (this.dialog) return this.renderDialog();
    const t = theme();
    const tone = (s) => ({ pass: t.done, fail: t.blocked, pending: t.working, idle: t.dim }[s] ?? t.dim);
    const word = (s) => ({ pass: "BLESSED", fail: "CORRUPTED", pending: "IN RITE", idle: "DORMANT" }[s] ?? "—");
    const heading = (glyph, title, extra) => h_flex().mt(10).mb(4).gap(6).items_center().text_size(11).text_color(t.accent)
      .child(glyph).child(title).child(div().flex_1().h(1).bg(t.border)).when(Boolean(extra), (el) => el.child(div().text_color(t.dim).child(extra)));
    const row = (label, value, color) => h_flex().gap(8).text_size(12)
      .child(div().w(78).flex_none().text_color(t.dim).child(label))
      .child(div().flex_1().min_w(0).truncate().text_color(color ?? t.foreground).child(value));
    // A commit line with an icon that opens the full message.
    const commitRow = (label, id, dir, on, c, name) => h_flex().gap(8).text_size(label ? 12 : 11).items_center()
      .when(Boolean(label), (el) => el.child(div().w(78).flex_none().text_color(t.dim).child(label)))
      .child(div().flex_1().min_w(0).truncate().text_color(t.muted).child(`${c.hash} ${c.subject} · ${ago(c.at)}`))
      .child(div().id(`${id}-msg`).flex_none().p(1).cursor_pointer().text_color(t.dim)
        .hover((el) => el.text_color(t.accent).bg(t.hover)).tooltip("Read the full commit message")
        .on_click((_e, cx) => { cx.stop_propagation(); this.showCommit(dir, on, c, name); })
        .child(svg("mods/chrome-mechanicus/file-text.svg").size(12)));
    const plate = (text, color) => div().flex_none().px(4).border(1).border_color(color).text_color(color).text_size(10)
      .when(text === "IN RITE" && motion(), (el) => el.loop("opacity", { from: 0.35, to: 1, period: 1200 })).child(text);
    // Clickable Jira chips for the keys in these texts (nothing without a known Jira site).
    const jira = (id, ...texts) => {
      const site = this.jiraSite, keys = site ? jiraKeys(...texts) : [];
      return keys.map((k) => div().id(`${id}-jira-${k}`).flex_none().px(4).border(1).border_color(t.ansi4 ?? t.accent)
        .text_color(t.ansi4 ?? t.accent).text_size(10).cursor_pointer().hover((el) => el.bg(t.hover))
        .tooltip(`Open ${k} in Jira (${site})`)
        .on_click((_e, cx) => { cx.stop_propagation(); this.open(`https://${site}/browse/${k}`); })
        .child(`◆ ${k}`));
    };

    const r = this.repo;
    const body = v_flex().px(16).pb(14);

    // ── Repository
    body.child(heading("⚙", "REPO-SPIRIT", this.busy ? "consulting…" : ""));
    if (!r) body.child(row("focus", "no terminal focused", t.dim));
    else if (!r.root) body.child(row("folder", r.cwd, t.muted)).child(row("git", "not a sanctified repository", t.dim));
    else {
      const dirty = r.staged + r.unstaged + r.untracked + r.conflicts;
      body.child(row("repo", r.root.split("/").pop() + (r.machine ? ` @${r.machine}` : "")))
        .child(row("branch", r.branch ?? (r.detachedOn ? `detached · on ${r.detachedOn}` : "detached"), r.branch ? t.accent : t.working))
        .when(jira("repo", r.branch).length > 0, (el) => el.child(h_flex().gap(4).pl(86).flex_wrap().children(jira("repo", r.branch))))
        .child(row("upstream", r.upstream ? `${r.upstream}  ↑${r.ahead} ↓${r.behind}` : "none bound", r.upstream ? (r.behind ? t.working : t.foreground) : t.dim))
        .child(row("state", dirty ? `+${r.staged} staged · ~${r.unstaged} changed · ?${r.untracked} new${r.conflicts ? ` · ✕${r.conflicts} conflict` : ""}` : "pure (clean)", r.conflicts ? t.blocked : dirty ? t.working : t.done))
        .when(Boolean(r.commit), (el) => el.child(commitRow("last", "repo-last", r.root, r.machine, r.commit, r.root.split("/").pop())));
      // Submodules: the import hierarchy as a tree; a click opens or closes one node.
      const subs = this.subs[r.root]?.list ?? [];
      if (subs.length) {
        body.child(div().text_size(10.5).text_color(t.dim).mt(6).mb(2).child(`SUBMODULES · ${subs.length}`));
        const mark = { "+": ["MOVED", t.working, "checked-out commit differs from the one recorded here"], "-": ["UNINIT", t.dim, "not initialized"], "U": ["CONFLICT", t.blocked, "merge conflict"] };
        const kids = (path) => subs.filter((y) => y.parent === path);
        const node = (x, lead, last, depth) => {
          const key = `${r.root}|${x.path}`, open = this.subOpen.has(key);
          const dirty = (x.staged ?? 0) + (x.unstaged ?? 0) + (x.untracked ?? 0) + (x.conflicts ?? 0);
          const [word0, color0, why] = mark[x.mark] ?? (dirty ? ["DIRTY", t.working, "uncommitted changes"] : ["SYNCED", t.done, "at the recorded commit, clean"]);
          const children = kids(x.path);
          const branchGlyph = depth === 0 ? "" : last ? "└─" : "├─";
          const under = lead + (depth === 0 ? "" : last ? "  " : "│ "); // what continues below this node
          const tree = (text) => div().flex_none().text_color(t.border).child(text);
          body.child(h_flex().id(`sub-${x.path}`).gap(4).items_center().text_size(12).py(1).cursor_pointer()
            .hover((el) => el.bg(t.hover)).tooltip(`${x.path}${x.url ? ` · ${x.url}` : ""}`)
            .on_click((_e, cx) => { this.toggleSub(key); cx.notify(); })
            .when(Boolean(lead + branchGlyph), (el) => el.child(tree(lead + branchGlyph)))
            .child(div().w(10).flex_none().text_color(t.accent).child(open ? "▾" : "▸"))
            .child(div().flex_1().min_w(0).truncate().text_color(open ? t.accent : t.foreground).child(x.name))
            .when(children.length > 0 && !open, (el) => el.child(div().flex_none().text_size(10).text_color(t.dim).child(`+${children.length}`)))
            .child(div().id(`sub-mark-${x.path}`).child(plate(word0, color0)).tooltip(why)));
          if (!open) return;
          const pad = under + (children.length ? "│ " : "  ") + "  ";
          const where = !x.branch ? (x.mark === "-" ? `not initialized · recorded ${x.recorded}` : "")
            : x.branch.detached ? (x.branch.name ? `detached · on ${x.branch.name}` : "detached · on no branch") : x.branch.name;
          const updown = x.upstream ? ` ↑${x.ahead} ↓${x.behind}` : "";
          body.child(h_flex().gap(4).text_size(11)
            .child(tree(pad))
            .child(div().flex_1().min_w(0).truncate().text_color(x.branch?.detached || x.mark === "-" ? t.working : t.accent).child(`${where}${updown}`))
            .when(dirty > 0, (el) => el.child(div().flex_none().text_color(t.working).child(`+${x.staged} ~${x.unstaged} ?${x.untracked}`))));
          if (x.commit) body.child(h_flex().gap(4).child(tree(pad)).child(div().flex_1().min_w(0).child(commitRow(null, `sub-last-${x.path}`, x.dir, r.machine, x.commit, x.name))));
          children.forEach((c, i) => node(c, under, i === children.length - 1, depth + 1));
        };
        const tops = kids(null);
        tops.forEach((x, i) => node(x, "", i === tops.length - 1, 0));
      }
    }

    // ── PRs and CI
    body.child(heading("✠", "PULL-PETITIONS & CI", this.tabAt ? ago(this.tabAt) : ""));
    // The PR of every session in the shown tab, with its link.
    body.child(div().text_size(10.5).text_color(t.dim).mb(2).child("THIS TAB'S SESSIONS"));
    if (!this.tabPrs.length) body.child(row("sessions", this.tabBusy ? "consulting…" : "no session on a git branch", t.dim));
    for (const g of this.tabPrs) {
      const pr = g.pr, s = pr ? rollup(pr.statusCheckRollup) : null;
      const who = div().text_size(10.5).text_color(t.dim).truncate().child(`${g.sessions.join(", ")} · ${g.branch} · ${short(g.cwd)}`);
      if (!pr) {
        body.child(v_flex().id(`tab-branch-${g.id}`).py(2).child(who)
          .child(h_flex().gap(4).items_center()
            .child(div().flex_1().min_w(0).text_size(11.5).text_color(t.dim).truncate().child(g.error ? `gh: ${g.error}` : "no open pull-petition"))
            .children(jira(`tb-${g.id}`, g.branch))));
        continue;
      }
      body.child(v_flex().id(`tab-pr-${pr.url}`).py(2).px(2).cursor_pointer().hover((el) => el.bg(t.hover))
        .on_click(() => this.open(pr.url)).tooltip(`Open ${pr.url}`)
        .child(who)
        .child(h_flex().gap(6).items_center().text_size(12)
          .child(div().flex_none().text_color(t.accent).child(`#${pr.number}`))
          .child(div().flex_1().min_w(0).truncate().text_color(t.foreground).child(`${pr.isDraft ? "[draft] " : ""}${pr.title}`))
          .when(pr.reviewDecision === "APPROVED", (el) => el.child(plate("✓", t.done)))
          .when(pr.reviewDecision === "CHANGES_REQUESTED", (el) => el.child(plate("Δ", t.blocked)))
          .child(plate(s ? word(s) : "—", tone(s))))
        .child(h_flex().gap(4).items_center()
          .child(div().flex_1().min_w(0).text_size(10.5).text_color(t.ansi4 ?? t.muted).truncate().child(`↗ ${pr.url.replace(/^https?:\/\//, "")}`))
          .children(jira(`tp-${pr.url}`, pr.title, g.branch))));
    }
    // PR links found in the text of this tab's terminals (newest first).
    if (this.mentions.length) {
      body.child(div().text_size(10.5).text_color(t.dim).mt(6).mb(2).child("LINKED IN THIS TAB'S TERMINALS"));
      const stateTone = { OPEN: t.done, MERGED: t.ansi5 ?? t.accent, CLOSED: t.blocked };
      for (const m of this.mentions) {
        const pr = m.pr, s = pr ? rollup(pr.statusCheckRollup) : null;
        const path = m.url.replace(/^https?:\/\/(www\.)?/, "");
        body.child(v_flex().id(`mention-${m.url}`).py(2).px(2).cursor_pointer().hover((el) => el.bg(t.hover))
          .on_click(() => this.open(m.url)).tooltip(`Open ${m.url}`)
          .child(div().text_size(10.5).text_color(t.dim).truncate().child(`in ${m.sessions.join(", ")}`))
          .when(Boolean(pr), (el) => el.child(h_flex().gap(6).items_center().text_size(12)
            .child(div().flex_none().text_color(t.accent).child(`#${pr.number}`))
            .child(div().flex_1().min_w(0).truncate().text_color(t.foreground).child(`${pr.isDraft ? "[draft] " : ""}${pr.title}`))
            .when(pr.reviewDecision === "APPROVED", (el) => el.child(plate("✓", t.done)))
            .when(pr.reviewDecision === "CHANGES_REQUESTED", (el) => el.child(plate("Δ", t.blocked)))
            .child(plate(pr.state, stateTone[pr.state] ?? t.dim))
            .when(pr.state === "OPEN", (el) => el.child(plate(s ? word(s) : "—", tone(s))))))
          .child(h_flex().gap(4).items_center()
            .child(div().flex_1().min_w(0).text_size(10.5).text_color(t.ansi4 ?? t.muted).truncate().child(`↗ ${path}`))
            .children(jira(`mp-${m.url}`, pr?.title))));
      }
    }

    // ── Notes
    if (r?.root) {
      body.child(heading("✎", "DATA-LITANY (NOTES)", ""));
      body.child(div().id("notes").border(1).border_color(t.border).bg(t.background).p(6).text_size(12).text_color(t.foreground)
        .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
        .child(Textarea.new(this.notes).h(90).w_full()));
    }

    const sidebar = find(layout(), "sidebar");
    if ((sidebar?.size?.px ?? Infinity) < 160) // the sidebar rail: just the sigil
      return v_flex().size_full().items_center().pt(8).bg(t.chrome).border_t(1).border_color(t.input).text_color(t.accent).child("⚙");
    const on = motion(), h = this.height ?? 0;
    return v_flex().id("auspex-root").size_full().min_h(0).bg(t.chrome).border_t(1).border_color(t.input)
      .child(h_flex().h(32).flex_none().px(16).gap(8).items_center().border_b(1).border_color(t.input).text_size(12).text_color(t.accent)
        .child("+++ AUSPEX +++")
        .child(div().flex_1().min_w(0).text_size(10).text_color(t.dim).truncate()
          .when(on, (el) => el.frames(LITANIES, 4200)).when(!on, (el) => el.child(LITANIES[0])))
        .when(on, (el) => el.child(div().flex_none().text_size(9).text_color(t.border).frames(CANT, 160))))
      .child(div().id("auspex-body").relative().flex_1().min_h(0)
        .on_size_change((size, cx) => { if (Math.abs((this.height ?? 0) - size.height) > 1) { this.height = size.height; cx.notify(); } })
        .child(div().id("auspex-scroll").size_full().overflow_y_scrollbar().child(body))
        // Auspex scanner: a faint grey line sweeping down and up the readings.
        .when(on && h > 20, (el) => el.child(div().absolute().left(0).right(0).top(0).h(2).bg(t.muted).opacity(0.22)
          .loop("top", { from: 0, to: h - 2, period: 9000, easing: "linear" }))));
  }
}
