// Prompt composer: a large text box for writing a long prompt to one agent session,
// opened from the LITANY button in a pane header (props: { terminal, pane, name, overlay }) or with
// cmd-l (mod.open: no props, so it takes the focused pane's agent session; if that is not an agent, it says so).
//   Send   (cmd-enter): hc send — pastes the text into the session and presses Enter.
//   Insert (cmd-i):     puts the text into the session's prompt without sending it
//                       (via the clipboard, which is restored afterwards).
//   Copy:               copies the text to the clipboard.
// The draft is kept per terminal (shared "composer.draft.<terminal>") until it is sent.
import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex, TextareaState, Textarea } from "gpui-base";
import { props, closeOverlay, run, hc, exec, theme, shared, setShared, window, checking, focused } from "herdr";

const draftKey = (t) => `composer.draft.${t}`;

export default class Composer extends View {
  init(_p, cx) {
    const p = props() ?? {};
    // Opened by the key: no props, so find the focused agent session ourselves.
    const f = p.terminal ? null : focused();
    this.refused = !p.terminal && !(f?.terminal && f.agent);
    if (!p.terminal && !this.refused) this.target = { terminal: f.terminal, pane: f.pane, name: f.agent };
    this.terminal = p.terminal ?? this.target?.terminal;
    this.state = TextareaState.new({ placeholder: "Write the prompt… (cmd-enter sends, cmd-i inserts without sending)" });
    this.state.set_soft_wrap(true);
    this.state.set_value((this.terminal && shared(draftKey(this.terminal))) || "");
    this.state.on("change", (_e, cx) => { if (this.terminal) setShared(draftKey(this.terminal), this.state.value()); cx.notify(); });
    this.note = null;
    this.busy = false;
    if (checking()) return;
    this.state.focus();
    cx.timer.after(300, () => this.state.focus());
  }

  get info() { return this.target ?? props() ?? {}; }

  close(text) {
    if (text !== undefined && this.terminal) setShared(draftKey(this.terminal), text);
    closeOverlay(props()?.overlay);
  }

  text() { return this.state.value().replace(/\s+$/, ""); }

  send(cx) {
    const text = this.text();
    if (!text || !this.terminal || this.busy) return;
    this.busy = true; this.note = "sending…"; cx.notify();
    cx.spawn(async (cx) => {
      const r = await hc(["send", this.terminal, text]).catch((e) => ({ code: -1, stderr: String(e) }));
      this.busy = false;
      if (r.code === 0) { setShared(draftKey(this.terminal), ""); this.close(); return; }
      this.note = `not sent: ${(r.stderr || r.stdout || "hc send failed").trim().split("\n")[0]}`;
      cx.notify();
    });
  }

  // Into the session's prompt without Enter: clipboard → focus the pane → paste → old clipboard back.
  insert(cx) {
    const text = this.text();
    if (!text || this.busy) return;
    if (window()?.platform !== "macos") { this.note = "insert needs macOS (pbcopy); use Copy, then paste"; cx.notify(); return; }
    this.busy = true;
    cx.spawn(async (cx) => {
      const before = await exec("pbpaste", []).catch(() => null);
      await exec("sh", ["-c", 'printf "%s" "$1" | pbcopy', "sh", text]);
      const p = this.info;
      this.close(text);
      run("pane.focus", p.pane ? { pane: p.pane } : { terminal: p.terminal });
      run("terminal.paste");
      if (before && before.code === 0)
        cx.timer.after(1500, () => exec("sh", ["-c", 'printf "%s" "$1" | pbcopy', "sh", before.stdout]));
    });
  }

  copy(cx) {
    const text = this.text();
    if (!text) return;
    cx.spawn(async (cx) => {
      const p = window()?.platform;
      const cmd = p === "macos" ? 'printf "%s" "$1" | pbcopy' : 'printf "%s" "$1" | (wl-copy 2>/dev/null || xclip -selection clipboard)';
      await exec("sh", ["-c", cmd, "sh", text]);
      this.note = "copied to the clipboard"; cx.notify();
    });
  }

  render(cx) {
    const t = theme(), p = this.info;
    if (this.refused) return v_flex().size_full().bg(t.popover).border(1).border_color(t.accent)
      .on_key_down((e) => { if (e.key === "escape") this.close(); })
      .child(h_flex().h(36).flex_none().px(14).gap(8).items_center().border_b(1).border_color(t.input).text_size(12).text_color(t.accent)
        .child(svg("mods/chrome-mechanicus/square-pen.svg").size(13)).child("LITANY")
        .child(div().flex_1())
        .child(div().id("composer-close").px(6).cursor_pointer().text_color(t.dim).hover((el) => el.text_color(t.foreground))
          .on_click(() => this.close()).child(svg("mods/chrome-mechanicus/x.svg").size(13))))
      .child(div().flex_1().p(16).text_size(13).text_color(t.blocked)
        .child("The focused pane is not a Claude (agent) session: focus one, then press cmd-l again. Esc closes."));
    const text = this.state.value();
    const lines = text ? text.split("\n").length : 0;
    const button = (id, label, hint, primary, action) => h_flex().id(id).h(28).px(12).gap(6).items_center().cursor_pointer()
      .border(1).border_color(primary ? t.accent : t.input).bg(primary ? t.accent : t.chrome)
      .text_color(primary ? t.accent_foreground : t.foreground).text_size(12)
      .hover((el) => el.opacity(0.85)).on_click((_e, cx) => action(cx))
      .child(label).when(Boolean(hint), (el) => el.child(div().text_size(10).opacity(0.7).child(hint)));
    return v_flex().size_full().bg(t.popover).border(1).border_color(t.accent)
      .on_key_down((e, cx) => {
        if (e.keystroke === "cmd-enter" || e.keystroke === "ctrl-enter") { cx.stop_propagation(); this.send(cx); }
        else if (e.keystroke === "cmd-i") { cx.stop_propagation(); this.insert(cx); }
      })
      .child(h_flex().h(36).flex_none().px(14).gap(8).items_center().border_b(1).border_color(t.input).text_size(12).text_color(t.accent)
        .child(svg("mods/chrome-mechanicus/square-pen.svg").size(13))
        .child(`LITANY · ${p.name ?? p.terminal ?? ""}`)
        .child(div().flex_1())
        .child(div().text_size(10.5).text_color(t.dim).child(`${lines} lines · ${text.length} chars`))
        .child(div().id("composer-close").px(6).cursor_pointer().text_color(t.dim).hover((el) => el.text_color(t.foreground))
          .on_click(() => this.close()).child(svg("mods/chrome-mechanicus/x.svg").size(13))))
      .child(div().id("composer-box").flex_1().min_h(0).m(12).p(8).border(1).border_color(t.input).bg(t.background)
        .text_size(13).text_color(t.foreground)
        .on_mouse_down("left", (_e, cx) => { cx.stop_propagation(); this.state.focus(); })
        .child(Textarea.new(this.state).size_full()))
      .child(h_flex().h(48).flex_none().px(12).gap(8).items_center().border_t(1).border_color(t.input)
        .child(div().flex_1().min_w(0).truncate().text_size(11).text_color(this.note?.startsWith("not") ? t.blocked : t.dim)
          .child(this.note ?? "Esc closes; the draft is kept until it is sent"))
        .child(button("composer-copy", "Copy", "", false, (cx) => this.copy(cx)))
        .child(button("composer-insert", "Insert", "⌘I", false, (cx) => this.insert(cx)))
        .child(button("composer-send", this.busy ? "Sending…" : "Send", "⌘↵", true, (cx) => this.send(cx))));
  }
}
