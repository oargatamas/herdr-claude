// New space with Claude running under the company or personal profile.
// Enter creates, Esc cancels, Tab switches the profile.
import { View, div } from "gpui-kit";
import { v_flex, h_flex, InputState, Input } from "gpui-base";
import { run, props, closeOverlay, theme, focused, home, pickFolder } from "herdr";

const PROFILES = [
  { id: "company", label: "Company", argv: () => ["claude"] },
  { id: "personal", label: "Personal", argv: () => ["env", `CLAUDE_CONFIG_DIR=${home()}/.claude-personal`, "claude"] },
];

export default class ClaudeSpace extends View {
  init(_props, cx) {
    let last = null;
    try { last = localStorage.getItem("profile"); } catch {}
    this.profile = props()?.profile ?? (PROFILES.some((p) => p.id === last) ? last : "company");
    this.folder = focused()?.cwd ?? home();
    this.name = "";
    this.input = InputState.new({ value: "", placeholder: "Workspace name" });
    this.input.on("change", (_e, cx) => { this.name = this.input.value(); cx.notify(); });
    this.input.on("submit", () => this.submit());
    this.input.focus();
    cx.timer.after(600, () => this.input.focus());
    this.handle = cx.focus_handle();
  }

  close_() { closeOverlay(props().overlay); }

  submit() {
    const profile = PROFILES.find((p) => p.id === this.profile);
    try { localStorage.setItem("profile", this.profile); } catch {}
    this.close_();
    // The sidebar and tab bar show the profile as a badge (spaces-profile, tabs-profile).
    // The space keeps the plain name; its first tab (the Claude one) is "Cogitator <name>".
    const name = this.name.trim();
    const args = { argv: profile.argv(), folder: this.folder, tab: name ? `Cogitator ${name}` : "Cogitator" };
    if (name) args.name = name;
    run("space.new", args);
  }

  key(e, cx) {
    if (e.key === "escape") { this.close_(); cx.stop_propagation(); }
    else if (e.key === "tab") {
      const i = PROFILES.findIndex((p) => p.id === this.profile);
      this.profile = PROFILES[(i + 1) % PROFILES.length].id;
      cx.stop_propagation(); cx.notify();
    }
  }

  render() {
    const t = theme();
    const label = (text) => div().pt(16).pb(7).text_size(11.5).text_color(t.dim).child(text);
    const button = (id, text, primary, action) => h_flex().id(id).h(32).px(14).items_center().rounded(8)
      .border_1().border_color(primary ? t.solid : t.input).bg(primary ? t.solid : t.raised)
      .text_color(primary ? t.solid_foreground : t.foreground).text_size(12.5).font_medium().cursor_pointer()
      .hover((s) => s.opacity(0.88)).on_click(action).child(text);
    const choice = (p) => {
      const on = p.id === this.profile;
      return h_flex().id(`cs-${p.id}`).flex_1().h(34).items_center().justify_center().rounded(8).cursor_pointer()
        .border_1().border_color(on ? t.accent : t.input).bg(on ? t.selected : t.background)
        .text_size(12.5).text_color(on ? t.foreground : t.muted).when(on, (el) => el.font_semibold())
        .hover((s) => s.bg(t.hover))
        .on_click((_e, cx) => { this.profile = p.id; cx.notify(); })
        .child(p.label);
    };
    const shortFolder = this.folder.startsWith(home()) ? "~" + this.folder.slice(home().length) : this.folder;
    return v_flex().id("claude-space").track_focus(this.handle).on_key_down((e, cx) => this.key(e, cx))
      .w_full().min_h(0).p(18).bg(t.popover).text_color(t.foreground)
      .child(h_flex().items_center()
        .child(div().flex_1().text_size(15).font_semibold().child("New Claude space"))
        .child(div().text_size(11).text_color(t.dim).child("Esc")))
      .child(label("Name"))
      .child(Input.new(this.input).h(36).px(10).rounded(9).border_1().border_color(t.accent)
        .bg(t.background).text_size(12.8).text_color(t.foreground))
      .child(label("Profile  ·  Tab to switch"))
      .child(h_flex().gap(8).children(PROFILES.map(choice)))
      .child(label("Folder"))
      .child(h_flex().gap(8).items_center()
        .child(div().flex_1().truncate().text_size(12.5).text_color(t.muted).child(shortFolder))
        .child(button("cs-browse", "Choose…", false, (_e, cx) => {
          cx.spawn(async (cx) => {
            const f = await pickFolder({ prompt: "Folder for the new space" });
            if (f) { this.folder = f; cx.notify(); }
            this.input.focus();
          });
        })))
      .child(h_flex().pt(20).gap(8).justify_end()
        .child(button("cs-cancel", "Cancel", false, () => this.close_()))
        .child(button("cs-create", "Create", true, () => this.submit())));
  }
}
