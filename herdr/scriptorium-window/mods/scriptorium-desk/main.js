// SCRIPTORIUM desk: the blank Herdr window the scriptorium's data-slates float in. It is a
// second Herdr window with a home of its own (~/.local/share/herdr-claude/scriptorium-window),
// started by the wh:scriptorium skill's open-md.sh; its layout (layouts/scriptorium.json) shows
// no spaces, tabs or terminals, only this desk under the Mechanicus emblem. Two copies: the band
// on top (the title, dragging the window, how many data-slates are open) and the desk below
// (empty but for a line of lore while no data-slate is open).
// It also stands in for the toast mod there (the layout's "toast"): the person's own Herdr window
// already shows every notification, so here each one closes at once, unseen.

import { View, div, svg } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { theme, props, shared, closeOverlay, setWindowTitle, window, checking } from "herdr";

const motion = () => shared("mechanicus.motion") !== false;
// The scriptorium's open windows, as its windows announce them (see mods/scriptorium/main.js).
const open = () => Object.values(shared("scriptorium.windows") ?? {})
  .filter((w) => w && Date.now() - (w.at ?? 0) < 5000).length;

export default class ScriptoriumDesk extends View {
  init() {
    this.toast = Boolean(props()?.overlay);
    if (checking()) return;
    if (this.toast) closeOverlay(props().overlay);
    else if (props()?.band) setWindowTitle("Scriptorium");
  }

  render() {
    const t = theme();
    if (this.toast) return div();
    const n = open();
    if (props()?.band) {
      // macOS keeps its window buttons over the band's left end (traffic_lights in the layout).
      const left = window()?.platform === "macos" ? 84 : 14;
      return h_flex().id("scriptorium-band").size_full().pl(left).pr(14).gap(8).items_center()
        .border_b(1).border_color(t.input).text_size(12).text_color(t.accent)
        .child(svg("mods/chrome-mechanicus/gear.svg").size(13).flex_none().when(motion(), (g) => g.spin(9000)))
        .child(div().flex_none().child("SCRIPTORIUM"))
        .child(div().flex_none().text_color(t.dim).child(n === 1 ? "· 1 data-slate" : `· ${n} data-slates`))
        .child(div().flex_1())
        .child(div().flex_none().min_w(0).truncate().text_size(10.5).text_color(t.dim)
          .child("drag a data-slate by its title · stretch it by its right or bottom edge · Esc closes"));
    }
    return v_flex().id("scriptorium-desk").size_full().justify_end().items_center().pb(28)
      .when(n === 0, (el) => el.child(div().text_size(12).text_color(t.dim)
        .child("The scriptorium awaits. Servo-skulls send their data-slates here (wh:scriptorium).")));
  }
}
