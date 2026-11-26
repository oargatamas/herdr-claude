// SCRIPTORIUM: floating windows, each showing one file. A markdown file (.md, .markdown) shows its
// render, or its source (read-only, with line numbers and markdown colouring), or both side by
// side; a dotenv file (.env, prod.env) is a text window with shell colouring (comments, keys, "=",
// quoted values, export, ${VAR}); any other file is a simple text window: just its read-only text
// (plain, no render). Dotenv files hold secrets: they are only read and shown, never copied. Opened by the
// wh:scriptorium skill (`open-md.sh <file>`), which writes {path, id} to this Herdr home's REQUEST
// file and, when no scriptorium is open, runs `mod.open scriptorium` (mod.open takes no props, so
// the path goes through that file). The copy mod.open makes is only a launcher: it measures the
// default window size (its own, 60% x 75% of the Herdr window), opens the window for the request
// and closes itself. While any window is open, each new request gets a window of its own, opened
// by whichever window sees it first (openOverlay keyed by the file), unless that file already has
// one. Each window follows its file: edits show within a second. Esc closes the window that has
// the keyboard; Claude closes them through the close request file (see readClose).
// Resizing: the windows draw their own frame (frame "none") and are sized by their content, so a
// window is as big as this mod says: grab its right edge, bottom edge or bottom-right corner and
// drag. Herdr anchors a window at its top left, so the left and top edges don't stretch (drag the
// window by its title instead). The size is kept per file (shared, per Herdr home).
// The look: Mechanicus, with the auspex scanner (a faint grey line sweeping over the slate's body,
// only while motion is on) and a turning gear in the title.
// Read-only: it never writes the file. It lives inside a Herdr window, like every mod overlay:
// open-md.sh puts it in the SCRIPTORIUM window (a second Herdr window with its own home, see
// herdr/scriptorium-window), which can go to another display; `--here` puts it in yours.

import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex, EditorState, Editor, TextView } from "gpui-base";
import { theme, settings, home, appHome, shared, setShared, props, openOverlay, closeOverlay, readTextFile, checking } from "herdr";

const motion = () => shared("mechanicus.motion") !== false;
// One request file per Herdr home, so the person's window and the SCRIPTORIUM window don't take
// each other's files (open-md.sh writes the one of the window it sends to).
const REQUEST = () => `${appHome()}/scriptorium-request`;
const EVERY = 1000;
// The render is set at the terminals' font size (settings.json / the layout), so it reads like them.
const renderSize = () => { const n = Number(settings()?.font_size); return n > 0 ? n : 13; };
// Only markdown files get the render (and the SOURCE / SPLIT / RENDER switch).
const isMarkdown = (path) => /\.(md|markdown)$/i.test(path ?? "");
// Dotenv files: the basename is ".env" or ends in ".env" (prod.env); .env.local and the like stay plain.
// They get the editor's shell language, which colours them the way a dotenv file reads.
const isDotenv = (path) => /(^|\/)[^/]*\.env$/i.test(path ?? "");
const languageFor = (path) => (isMarkdown(path) ? "markdown" : isDotenv(path) ? "bash" : null);
const MODES = [["source", "SOURCE"], ["split", "SPLIT"], ["render", "RENDER"]];
// Sizes: per file, the default one (measured by the launcher), and the limits of a drag.
const SIZES = "scriptorium.sizes", ROOM = "scriptorium.room", KEEP_SIZES = 40;
const MIN_W = 380, MIN_H = 220, GRIP = 6, CATCH = 240;
const sizeFor = (path) => shared(SIZES)?.[path ?? ""] ?? shared(ROOM) ?? { w: 860, h: 620 };

// The latest request: { path, id }; a bare path is its own id.
async function readRequest() {
  const raw = ((await readTextFile(REQUEST()).catch(() => null)) ?? "").trim();
  if (!raw) return null;
  try { const j = JSON.parse(raw); return j?.path ? { path: String(j.path), id: String(j.id ?? j.path) } : null; }
  catch { return { path: raw, id: raw }; }
}
// A close request, { id, at, all?, paths? } in <home>/scriptorium-close (close-md.sh writes it; herdr-app
// can't close a mod's overlay by its key, and status doesn't show their ids): every window sees it
// and closes itself when its file is named (or all). A request older than the window is ignored.
const CLOSE = () => `${appHome()}/scriptorium-close`;
async function readClose() {
  const raw = ((await readTextFile(CLOSE()).catch(() => null)) ?? "").trim();
  try { const j = JSON.parse(raw); return j?.id ? { id: String(j.id), at: Number(j.at) || 0, all: j.all === true, paths: Array.isArray(j.paths) ? j.paths.map(String) : [] } : null; }
  catch { return null; }
}
// The open windows, { [key]: { path, at } }, each refreshed every second while it's open
// (a window that went without a goodbye drops out after a few seconds).
const WINDOWS = "scriptorium.windows", HANDLED = "scriptorium.handled";
const keyFor = (path) => `scriptorium:${path ?? "none"}`;
const liveWindows = () => Object.fromEntries(Object.entries(shared(WINDOWS) ?? {})
  .filter(([, w]) => w && Date.now() - (w.at ?? 0) < 5 * EVERY));

// A window of its own for a file, unless it has one already; staggered so they don't stack.
function openWindow(path) {
  const shown = Object.values(liveWindows());
  if (path && shown.some((w) => w.path === path)) return;
  const n = shown.length % 8;
  openOverlay({ mod: "scriptorium", kind: "window", frame: "none", key: keyFor(path),
    at: { x: 120 + 36 * n, y: 80 + 36 * n }, props: { doc: true, path } });
}

export default class Scriptorium extends View {
  init(_props, cx) {
    // The copy mod.open made launches the window and closes; the others show a file.
    this.launcher = !props()?.doc;
    if (this.launcher) return;
    this.path = props()?.path ?? null;
    this.key = keyFor(this.path);
    this.size = sizeFor(this.path);
    this.born = Date.now();
    this.drag = null; // while resizing: { edge: "e" | "s" | "se", x, y, w, h } at the press
    this.text = null; // null: not read yet; false: unreadable
    this.md = isMarkdown(this.path); // other files: read-only text (.env coloured), no render
    this.mode = this.md ? "render" : "source"; // markdown opens on the render; SOURCE / SPLIT last while it's open
    this.source = EditorState.new({ ...(languageFor(this.path) ? { language: languageFor(this.path) } : {}), readonly: true, soft_wrap: true, folding: false, value: "" });
    // The window with the keyboard closes on Esc: a press anywhere in it gives it the keyboard
    // (the source keeps it for itself, and its Esc comes up to the window too), and a new one has it.
    this.handle = cx.focus_handle();
    if (checking()) return;
    cx.timer.after(200, () => this.handle.focus());
    this.beat();
    this.reload(cx);
    cx.timer.every(EVERY, (cx) => { this.beat(); this.reload(cx); this.takeRequest(cx); this.takeClose(cx); });
  }

  close() {
    if (this.launcher) return;
    const w = { ...(shared(WINDOWS) ?? {}) };
    delete w[this.key];
    setShared(WINDOWS, w);
  }

  // The launcher: once laid out, its size is the default window size; then the request's window.
  launch(size, cx) {
    if (this.launched || checking()) return;
    this.launched = true;
    if (size?.width > 0 && size?.height > 0) setShared(ROOM, { w: Math.round(size.width), h: Math.round(size.height) });
    cx.spawn(async () => {
      const r = await readRequest();
      if (r) setShared(HANDLED, r.id);
      openWindow(r?.path ?? null);
      closeOverlay(props().overlay);
    });
  }

  // Tells the other windows which file this one shows.
  beat() {
    if (!this.path) return;
    setShared(WINDOWS, { ...liveWindows(), [this.key]: { path: this.path, at: Date.now() } });
  }

  // A request no window has taken yet: a window of its own, unless its file has one already.
  takeRequest(cx) {
    cx.spawn(async () => {
      const r = await readRequest();
      if (!r || shared(HANDLED) === r.id) return;
      setShared(HANDLED, r.id);
      openWindow(r.path);
    });
  }

  // A close request naming this window's file (or all): it closes.
  takeClose(cx) {
    cx.spawn(async () => {
      const r = await readClose();
      if (!r || r.at < this.born || this.closedBy === r.id) return;
      this.closedBy = r.id;
      if (r.all || r.paths.includes(this.path)) closeOverlay(props().overlay);
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

  // Resizing. A press on a grip starts it (and isn't a window drag); while it lasts, the window
  // grows a transparent margin and a layer over everything, so the moves and the release reach
  // this mod even when the pointer runs ahead of the edge or crosses the text.
  grab(edge, e, cx) {
    cx.stop_propagation();
    this.handle.focus();
    this.drag = { edge, x: e.position.x, y: e.position.y, w: this.size.w, h: this.size.h };
    cx.notify();
  }
  stretch(e, cx) {
    const d = this.drag;
    if (!d) return;
    const w = d.edge === "s" ? d.w : Math.max(MIN_W, Math.round(d.w + e.position.x - d.x));
    const h = d.edge === "e" ? d.h : Math.max(MIN_H, Math.round(d.h + e.position.y - d.y));
    if (w === this.size.w && h === this.size.h) return;
    this.size = { w, h };
    cx.notify();
  }
  release(cx) {
    if (!this.drag) return;
    this.drag = null;
    // Kept per file (the latest few), for the next time it opens.
    const sizes = Object.entries({ ...(shared(SIZES) ?? {}) }).filter(([k]) => k !== (this.path ?? ""));
    setShared(SIZES, Object.fromEntries([...sizes.slice(-(KEEP_SIZES - 1)), [this.path ?? "", this.size]]));
    cx.notify();
  }

  render() {
    if (this.launcher) return div().id("scriptorium-launcher").size_full()
      .on_size_change((size, cx) => this.launch(size, cx));
    const t = theme();
    // Controls and text don't drag the window; pressing them still gives this window the keyboard
    // (but the source editor's own focus is left alone).
    const stop = (_e, cx) => { cx.stop_propagation(); this.handle.focus(); };
    const stopOnly = (_e, cx) => cx.stop_propagation();
    const name = this.path ? this.path.split("/").pop() : "no data-slate";
    const where = this.path ? this.path.replace(home(), "~") : "";
    const tabs = !this.md ? null : h_flex().gap(0).flex_none().children(MODES.map(([id, label]) => div().id(`mode-${id}`).px(6).h(20)
      .flex().items_center().text_size(10.5).border(1).border_color(this.mode === id ? t.accent : t.input)
      .text_color(this.mode === id ? t.background : t.dim).when(this.mode === id, (el) => el.bg(t.accent))
      .cursor_pointer().hover((el) => (this.mode === id ? el : el.text_color(t.foreground)))
      .on_mouse_down("left", stop).on_click((_e, cx) => this.setMode(id, cx)).child(label)));
    const pane = (label, body, own = stop) => v_flex().flex_1().min_w(0).h_full().min_h(0)
      .child(div().h(22).flex_none().px(10).flex().items_center().text_size(10).text_color(t.dim)
        .border_b(1).border_color(t.input).child(label))
      .child(v_flex().flex_1().min_h(0).on_mouse_down("left", own).child(body));
    let body;
    if (!this.path) body = div().p(16).text_color(t.dim).text_size(12)
      .child("No data-slate requested. Ask Claude to open a file (the wh:scriptorium skill).");
    else if (this.text === false) body = div().p(16).text_color(t.blocked).text_size(12)
      .child(`The machine spirit cannot read ${where}.`);
    else if (this.text == null) body = div().p(16).text_color(t.dim).text_size(12).child("Retrieving the data-slate…");
    else {
      const src = pane(this.md ? "◇ SOURCE" : isDotenv(this.path) ? "◇ DOTENV" : "◇ TEXT", Editor.new(this.source).size_full(), stopOnly);
      if (!this.md) body = src;
      else {
      const rendered = pane("◆ RENDER", div().id("render-scroll").size_full().px(16).py(10).text_size(renderSize()).overflow_y_scrollbar()
        .child(TextView.markdown("render", this.text).selectable(true)));
      body = h_flex().size_full().min_h(0)
        .when(this.mode !== "render", (el) => el.child(src))
        .when(this.mode === "split", (el) => el.child(div().w(1).h_full().flex_none().bg(t.input)))
        .when(this.mode !== "source", (el) => el.child(rendered));
      }
    }
    const { w, h } = this.size;
    const d = this.drag;
    const card = v_flex().id("scriptorium").w(w).h(h).bg(t.popover).border(1).border_color(t.accent).shadow_lg()
      .track_focus(this.handle)
      .on_mouse_down("left", () => this.handle.focus())
      .on_key_down((e, cx) => { if (e.key === "escape") { cx.stop_propagation(); closeOverlay(props().overlay); } })
      .child(h_flex().h(36).flex_none().px(14).gap(8).items_center().border_b(1).border_color(t.input)
        .text_size(12).text_color(t.accent)
        .child(svg("mods/chrome-mechanicus/gear.svg").size(13).flex_none().when(motion(), (g) => g.spin(9000)))
        .child(div().flex_none().child("SCRIPTORIUM"))
        .child(div().min_w(0).truncate().text_color(t.foreground).child(name))
        .child(div().flex_1().min_w(0).truncate().text_size(10.5).text_color(t.dim).child(where))
        .when(tabs, (el) => el.child(tabs))
        .child(div().id("close-scriptorium").px(6).cursor_pointer().text_color(t.dim)
          .hover((el) => el.text_color(t.foreground)).tooltip("Close this window (Esc)")
          .on_mouse_down("left", stop).on_click(() => closeOverlay(props().overlay))
          .child(svg("mods/chrome-mechanicus/x.svg").size(13))))
      // The body, with the auspex scanner over it (a faint grey line sweeping down and up, as in the
      // other mods): clear of the title bar and the grips, and it takes no presses.
      .child(div().id("scriptorium-body").relative().flex_1().min_h(0)
        .on_size_change((size, cx) => { if (Math.abs((this.bodyH ?? 0) - size.height) > 1) { this.bodyH = size.height; cx.notify(); } })
        .child(v_flex().size_full().min_h(0).child(body))
        .when(motion() && (this.bodyH ?? 0) > 20, (el) => el.child(div().absolute().left(0).right(0).top(0).h(2).bg(t.muted).opacity(0.22)
          .loop("top", { from: 0, to: this.bodyH - 2, period: 9000, easing: "linear" }))));
    // The grips: a strip just outside the right and bottom edges (over the 1px border, clear of
    // the render's scrollbar) and the corner, marked with a brass bracket.
    const grip = (id, edge, el) => el.id(id).absolute().on_mouse_down("left", (e, cx) => this.grab(edge, e, cx));
    const cursor = (el, edge) => (edge === "e" ? el.cursor_ew_resize() : edge === "s" ? el.cursor_ns_resize() : el.cursor_nwse_resize());
    return div().id("scriptorium-frame").relative().pr(GRIP).pb(GRIP)
      .when(d, (el) => el.pr(CATCH).pb(CATCH))
      .child(card)
      .child(grip("grip-e", "e", div().left(w - 2).top(0).w(GRIP + 2).h(h - 12).cursor_ew_resize()))
      .child(grip("grip-s", "s", div().left(0).top(h - 2).w(w - 12).h(GRIP + 2).cursor_ns_resize()))
      .child(grip("grip-se", "se", div().left(w - 12).top(h - 12).size(12 + GRIP).cursor_nwse_resize())
        .child(div().absolute().left(1).top(1).size(9).border_r(2).border_b(2)
          .border_color(d ? t.accent : t.dim)))
      // While resizing: one layer over the window and its margin takes every move and the release.
      .when(d, (el) => el.child(cursor(div().id("resize-catch").absolute().left(0).top(0).size_full(), d.edge)
        .on_mouse_down("left", stopOnly)
        .on_mouse_move((e, cx) => this.stretch(e, cx))
        .on_mouse_up("left", (_e, cx) => this.release(cx))
        .on_hover((over, cx) => { if (!over) this.release(cx); })));
  }
}
