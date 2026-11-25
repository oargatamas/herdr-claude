// The keybind list (Herdr's prefix+?), grouped, filterable by typing.
// Reads keys.json through keys(); edit keys.json to change any of them.
// A second tab, SKILLS, lists the Claude skills in the herdr-claude repository
// (claude/skills/*/SKILL.md: name and description) and whether each is installed.

import { View, div } from "gpui-kit";
import { v_flex, h_flex, InputState, Input } from "gpui-base";
import { keys, props, closeOverlay, theme, home, exec, readTextFile, checking } from "herdr";

// Our own Claude shortcuts first, in plain words (keys.json: claude-space, claude-fork*,
// and the pane.split bindings that run ~/.local/bin/claude-ws).
const CLAUDE = /claude/;
const ARROW = { left: "left", right: "right", up: "above", down: "below" };
function claudeLabel(keys, action) {
  const arrow = ARROW[keys.split("-").pop()] ?? "";
  if (action === "mod.open:claude-space") return "New Claude space: name it, pick Company or Personal";
  if (action === "mod.open:claude-fork") return "Fork the focused Claude conversation into a new tab";
  if (action.startsWith("mod.open:claude-fork-")) return `Fork the focused Claude conversation into a split ${arrow}`;
  if (action.includes("claude-ws")) return `New Claude session (workspace's profile) in a split ${arrow}`;
  return null;
}

// Bindings with arguments ({"command", "args"}) arrive as JSON text: use their command.
function command(action) {
  if (!action.startsWith("{")) return action;
  try { return JSON.parse(action).command ?? action; } catch { return action; }
}

const GROUPS = [
  ["claude", CLAUDE],
  ["spaces", /^space\./],
  ["tabs", /^tab\./],
  ["panes", /^pane\./],
  ["agents", /^agent\./],
  ["terminal", /^terminal\.|^send:/],
  ["window", /./],
];

function label(action, keys = "") {
  const mine = CLAUDE.test(action) && claudeLabel(keys, action);
  if (mine) return mine;
  action = command(action);
  if (action.startsWith("send:")) return "type " + JSON.stringify(action.slice(5));
  const [name, arg] = action.split(":");
  const words = name.replace(/[._]/g, " ");
  return arg ? `${words} ${arg}` : words;
}

// The repo's skills: [{ name, description, installed }], read from the clone install.sh recorded.
async function repoSkills() {
  const repo = ((await readTextFile(`${home()}/.local/share/herdr-claude/repo`).catch(() => null)) ?? `${home()}/projects/herdr-claude`).trim();
  const ls = await exec("ls", [`${repo}/claude/skills`]).catch(() => null);
  if (!ls || ls.code !== 0) return { repo, skills: [] };
  const dirs = ls.stdout.split("\n").map((x) => x.trim()).filter(Boolean);
  const skills = await Promise.all(dirs.map(async (dir) => {
    const text = (await readTextFile(`${repo}/claude/skills/${dir}/SKILL.md`).catch(() => null)) ?? "";
    const front = text.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
    const field = (k) => front.match(new RegExp(`^${k}:\\s*(.*)$`, "m"))?.[1]?.trim() ?? "";
    const installed = (await readTextFile(`${home()}/.claude/skills/${dir}/SKILL.md`).catch(() => null)) !== null;
    return { name: field("name") || dir, description: field("description"), installed };
  }));
  return { repo, skills };
}

const TABS = [["keys", "Keybinds"], ["skills", "Skills"]];

export default class Help extends View {
  init(_props, cx) {
    this.filter = "";
    this.input = InputState.new({ placeholder: "Type to filter…" });
    this.input.on("change", (_e, cx) => { this.filter = this.input.value(); cx.notify(); });
    this.input.focus();
    cx.timer.after(600, () => this.input.focus());
    this.handle = cx.focus_handle();
    this.tab = "keys";
    this.skills = null; // { repo, skills } once read
    if (checking()) return;
    cx.spawn(async (cx) => { this.skills = await repoSkills().catch(() => ({ repo: "", skills: [] })); cx.notify(); });
  }

  setTab(tab, cx) {
    this.tab = tab;
    this.input.focus();
    cx.notify();
  }

  skillRows(t, f) {
    if (!this.skills) return [div().px(8).text_color(t.dim).child("Reading the skills…")];
    const shown = this.skills.skills.filter((s) => !f || s.name.toLowerCase().includes(f) || s.description.toLowerCase().includes(f));
    if (!shown.length) return [div().px(8).text_color(t.dim).child(this.skills.skills.length ? "No skill matches." : `No skills found in ${this.skills.repo}/claude/skills.`)];
    return shown.map((s) =>
      v_flex().id(`skill-${s.name}`).px(8).py(6).gap(3).rounded(7)
        .child(h_flex().gap(8).items_center()
          .child(div().text_color(t.accent).font_medium().child(`/${s.name}`))
          .child(div().text_size(10.5).text_color(t.dim).child(s.installed ? "installed" : "not installed: run install.sh")))
        .child(div().text_color(t.foreground).child(s.description)));
  }

  render(cx) {
    const t = theme();
    const f = this.filter.toLowerCase();
    const all = keys().filter((k) => !f || k.keys.includes(f) || label(k.action, k.keys).toLowerCase().includes(f));
    const seen = new Set();
    const groups = GROUPS.map(([name, re]) => {
      const rows = all.filter((k) => !seen.has(k) && (re === CLAUDE ? re.test(k.action) : re.test(command(k.action))) && (seen.add(k) || true));
      return [name, rows];
    }).filter(([, rows]) => rows.length > 0);
    return v_flex()
      .id("help")
      .track_focus(this.handle)
      .on_key_down((e, cx) => {
        if (e.key === "escape") return closeOverlay(props().overlay);
        if (e.key === "tab") { cx.stop_propagation(); this.setTab(this.tab === "keys" ? "skills" : "keys", cx); }
      })
      .size_full()
      .min_h(0)
      .p(18)
      .gap(14)
      .bg(t.popover)
      .text_size(12)
      .child(
        h_flex()
          .h(22)
          .items_center()
          .justify_between()
          .child(h_flex().gap(4).items_center().children(TABS.map(([id, name]) =>
            div().id(`help-tab-${id}`).px(8).py(2).rounded(5).cursor_pointer()
              .text_size(15).font_semibold()
              .text_color(this.tab === id ? t.foreground : t.dim)
              .when(this.tab === id, (el) => el.border_b(2).border_color(t.accent))
              .hover((s) => s.text_color(t.foreground))
              .on_click((_e, cx) => this.setTab(id, cx))
              .child(name))))
          .child(div().id("help-esc").px(6).py(2).rounded(5).text_size(11).text_color(t.dim).cursor_pointer().hover((s) => s.bg(t.hover).text_color(t.foreground)).on_click(() => closeOverlay(props().overlay)).child("Esc")),
      )
      .child(Input.new(this.input).h(36).flex_none().px(10).rounded(9).border_1().border_color(t.accent).bg(t.background).text_size(12.8).text_color(t.foreground))
      .child(
        v_flex()
          .flex_1()
          .min_h(0)
          .overflow_y_scrollbar()
          .py(2)
          .gap(10)
          .when(this.tab === "skills", (el) => el.children(this.skillRows(t, f)))
          .when(this.tab === "keys", (el) => el.children(
            groups.map(([name, rows]) =>
              v_flex()
                .gap(2)
                .child(div().text_size(11.5).font_medium().text_color(t.dim).child(name))
                .children(
                  rows.map((k) =>
                    h_flex()
                      .h(32)
                      .px(8)
                      .rounded(7)
                      .items_center()
                      .child(div().w(190).text_color(t.accent).child(k.keys + (k.section !== "global" ? `  (${k.section})` : "")))
                      .child(div().text_color(t.foreground).child(label(k.action, k.keys))),
                  ),
                ),
            ),
          )),
      );
  }
}
