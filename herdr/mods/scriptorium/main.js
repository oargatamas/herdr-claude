// SCRIPTORIUM: floating windows, each showing one markdown file: its render, or its source
// (read-only, with line numbers and markdown colouring), or both side by side. Opened by the
// wh:scriptorium skill (`open-md.sh <file>`), which writes {path, id} to REQUEST and, when no
// scriptorium is open, runs `mod.open scriptorium` (mod.open takes no props, so the path goes
// through that file): that first window takes the request. While any is open, each new request
// gets a window of its own, opened by whichever window sees it first (openOverlay with the
// file as its key and prop), unless that file already has one. Each window follows its file:
// edits show within a second.
// Read-only: it never writes the file. It lives inside the Herdr window, like every mod overlay:
// Herdr gives mods no OS window of their own, so it can't be dragged onto another display.

import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex, EditorState, Editor, TextView } from "gpui-base";
import { theme, home, shared, setShared, props, openOverlay, closeOverlay, readTextFile, checking } from "herdr";

const motion = () => shared("mechanicus.motion") !== false;
const REQUEST = () => `${home()}/.local/share/herdr-claude/scriptorium`;
const EVERY = 1000;
const MODES = [["source", "SOURCE"], ["split", "SPLIT"], ["render", "RENDER"]];

// The latest request: { path, id }; a bare path (as earlier versions wrote) is its own id.
async function readRequest() {
  const raw = ((await readTextFile(REQUEST()).catch(() => null)) ?? "").trim();
  if (!raw) return null;
  try { const j = JSON.parse(raw); return j?.path ? { path: String(j.path), id: String(j.id ?? j.path) } : null; }
  catch { return { path: raw, id: raw }; }
}
// The open windows, { [overlay]: { path, at } }, each refreshed every second while it's open
// (a window that went without a goodbye drops out after a few seconds).
const WINDOWS = "scriptorium.windows", HANDLED = "scriptorium.handled";
const liveWindows = () => Object.fromEntries(Object.entries(shared(WINDOWS) ?? {})
  .filter(([, w]) => w && Date.now() - (w.at ?? 0) < 5 * EVERY));

export default class Scriptorium extends View {
  init(_props, cx) {
    // The window mod.open made has the key "scriptorium"; the others, their file.
    this.overlay = props()?.overlay ?? (props()?.path ? `scriptorium:${props().path}` : "scriptorium");
    this.path = props()?.path ?? null; // a window opened for one file keeps it
    this.text = null; // null: not read yet; false: unreadable
    this.mode = "render"; // it opens on the render; SOURCE / SPLIT last while it's open
    this.source = EditorState.new({ language: "markdown", readonly: true, soft_wrap: true, folding: false, value: "" });
    if (checking()) return;
    cx.spawn(async (cx) => {
      // The window mod.open made: it shows the request it was opened for.
      if (!this.path) { const r = await readRequest(); if (r) { this.path = r.path; setShared(HANDLED, r.id); } }
      this.beat();
      this.reload(cx);
    });
    cx.timer.every(EVERY, (cx) => { this.beat(); this.reload(cx); this.takeRequest(cx); });
  }

  close() {
    const w = { ...(shared(WINDOWS) ?? {}) };
    delete w[this.overlay];
    setShared(WINDOWS, w);
  }

  // Tells the other windows which file this one shows.
  beat() {
    if (!this.overlay || !this.path) return;
    setShared(WINDOWS, { ...liveWindows(), [this.overlay]: { path: this.path, at: Date.now() } });
  }

  // A request no window has taken yet: a window of its own, unless its file has one already.
  takeRequest(cx) {
    cx.spawn(async () => {
      const r = await readRequest();
      if (!r || shared(HANDLED) === r.id) return;
      setShared(HANDLED, r.id);
      const shown = Object.values(liveWindows());
      if (shown.some((w) => w.path === r.path)) return;
      const n = shown.length;
      openOverlay({ mod: "scriptorium", kind: "window", key: `scriptorium:${r.path}`, width: 0.6, height: 0.75,
        at: { x: 120 + 36 * n, y: 80 + 36 * n }, props: { path: r.path } });
    });
  }

  // This window's file; redraws only on a change.
  reload(cx) {
    cx.spawn(async (cx) => {
      const path = this.path;
      const text = path ? await readTextFile(path).catch(() => null) : null;
      const next = path && text == null ? false : text;
      if (next === this.text) return;
      this.text = next;
      this.source.set_value(typeof next === "string" ? next : "");
      cx.notify();
    });
  }

  setMode(mode, cx) {
    this.mode = mode;
    cx.notify();
  }

  render() {
    const t = theme();
    const stop = (_e, cx) => cx.stop_propagation(); // controls and text don't drag the window
    const name = this.path ? this.path.split("/").pop() : "no data-slate";
    const where = this.path ? this.path.replace(home(), "~") : "";
    const tabs = h_flex().gap(0).flex_none().children(MODES.map(([id, label]) => div().id(`mode-${id}`).px(6).h(20)
      .flex().items_center().text_size(10.5).border(1).border_color(this.mode === id ? t.accent : t.input)
      .text_color(this.mode === id ? t.background : t.dim).when(this.mode === id, (el) => el.bg(t.accent))
      .cursor_pointer().hover((el) => (this.mode === id ? el : el.text_color(t.foreground)))
      .on_mouse_down("left", stop).on_click((_e, cx) => this.setMode(id, cx)).child(label)));
    const pane = (label, body) => v_flex().flex_1().min_w(0).h_full().min_h(0)
      .child(div().h(22).flex_none().px(10).flex().items_center().text_size(10).text_color(t.dim)
        .border_b(1).border_color(t.input).child(label))
      .child(v_flex().flex_1().min_h(0).on_mouse_down("left", stop).child(body));
    let body;
    if (!this.path) body = div().p(16).text_color(t.dim).text_size(12)
      .child("No data-slate requested. Ask Claude to open a markdown file (the wh:scriptorium skill).");
    else if (this.text === false) body = div().p(16).text_color(t.blocked).text_size(12)
      .child(`The machine spirit cannot read ${where}.`);
    else if (this.text == null) body = div().p(16).text_color(t.dim).text_size(12).child("Retrieving the data-slate…");
    else {
      const src = pane("◇ SOURCE", Editor.new(this.source).size_full());
      const rendered = pane("◆ RENDER", div().id("render-scroll").size_full().px(16).py(10).overflow_y_scrollbar()
        .child(TextView.markdown("render", this.text).selectable(true)));
      body = h_flex().size_full().min_h(0)
        .when(this.mode !== "render", (el) => el.child(src))
        .when(this.mode === "split", (el) => el.child(div().w(1).h_full().flex_none().bg(t.input)))
        .when(this.mode !== "source", (el) => el.child(rendered));
    }
    return v_flex().size_full().bg(t.popover).border(1).border_color(t.accent)
      .child(h_flex().h(36).flex_none().px(14).gap(8).items_center().border_b(1).border_color(t.input)
        .text_size(12).text_color(t.accent)
        .child(svg("mods/chrome-mechanicus/gear.svg").size(13).flex_none().when(motion(), (g) => g.spin(9000)))
        .child(div().flex_none().child("SCRIPTORIUM"))
        .child(div().min_w(0).truncate().text_color(t.foreground).child(name))
        .child(div().flex_1().min_w(0).truncate().text_size(10.5).text_color(t.dim).child(where))
        .child(tabs)
        .child(div().id("close-scriptorium").px(6).cursor_pointer().text_color(t.dim)
          .hover((el) => el.text_color(t.foreground)).tooltip("Close the scriptorium")
          .on_mouse_down("left", stop).on_click(() => closeOverlay(props().overlay))
          .child(svg("mods/chrome-mechanicus/x.svg").size(13))))
      .child(v_flex().flex_1().min_h(0).child(body));
  }
}
