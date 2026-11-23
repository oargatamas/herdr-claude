import { View, div, image, svg } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { theme, run, props, window, shared, setShared, updates, layout } from "herdr";

// Sidebar animations on unless stilled with a click on the emblem.
const motion = () => shared("mechanicus.motion") !== false;

function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = find(child, id);
    if (found) return found;
  }
  return null;
}

// The sidebar's rail goes by its width, not a flag: dragging its edge narrows it too.
const narrow = () => (find(layout(), "sidebar")?.size?.px ?? Infinity) < 160;

// To the rail (on macOS wide enough for the traffic lights), or back to the width it had.
function toggleSidebar() {
  const width = find(layout(), "sidebar")?.size?.px;
  if (!narrow()) setShared("sidebar.width", width);
  // Mods edited before the rail went by width still read the flag.
  setShared("sidebar.collapsed", !narrow());
  run("layout.resize", { id: "sidebar", px: narrow() ? (shared("sidebar.width") ?? 268) : window()?.platform === "macos" ? 76 : 44 });
}

export default class WorkspaceChrome extends View {
  button(id, label, action) {
    const t = theme();
    return div().id(id).size(26).flex_none().flex().items_center().justify_center().rounded(6).text_color(t.muted).hover(s => s.bg(t.hover).text_color(t.foreground))
      .on_mouse_down("left", (_e, cx) => cx.stop_propagation()).on_click(action).child(label);
  }
  // Mechanicus emblem: a brass cog turning around the skull, the bionic eye pulsing.
  // Click toggles all sidebar motion (shared "mechanicus.motion", default on).
  emblem(t) {
    const on = motion();
    return div().id("emblem").relative().size(30).flex_none().cursor_pointer()
      .tooltip(on ? "Machine-spirit motion: on (click to still)" : "Machine-spirit motion: off (click to awaken)")
      .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
      .on_click((_e, cx) => { cx.stop_propagation(); setShared("mechanicus.motion", !on); })
      .child(svg("mods/chrome-mechanicus/gear.svg").absolute().left(0).top(0).size(30).text_color(t.accent).when(on, el => el.spin(16000)))
      .child(image("mods/chrome-mechanicus/skull.svg").absolute().left(7).top(6).w(16).h(18))
      .child(div().absolute().left(16.4).top(12.9).size(2.5).rounded_full().bg("#ff4a3a")
        .when(on, el => el.loop("opacity", { from: 0.25, to: 1, period: 1600 })));
  }

  render() {
    const t = theme();
    const collapsed = narrow();
    if (props()?.footer) {
      const row = (id, icon, label, dim, action) => h_flex().id(id).h(28).px(8).gap(9).items_center().rounded(8)
        .when(collapsed, el => el.relative().w(32).px(0).justify_center().tooltip(label))
        .text_color(dim ? t.dim : t.muted).hover(s => s.bg(t.hover).text_color(t.foreground)).cursor_pointer()
        .on_click(action).child(svg(`mods/chrome-mechanicus/${icon}.svg`).size(14))
        .when(!collapsed, el => el.child(label));
      const ready = div().size(6).rounded_full().bg(t.accent);
      return v_flex().size_full().bg(t.chrome).border_t(1).border_color(t.border).px(8).pt(4).pb(8).text_size(13)
        .when(collapsed, el => el.px(0).items_center())
        .child(row("settings", "settings", "Settings", false, () => run("app.settings"))
          .when(Boolean(updates().app.ready), el => el.child(collapsed ? ready.absolute().top(5).right(6) : ready)))
        .child(row("machine", "plus", "Add machine", true, () => run("mod.open", { name: "machine-add" })));
    }
    return h_flex().size_full().bg(t.chrome).pl(collapsed ? 6 : 14).pr(10).gap(4).items_center().text_size(13.5)
      .when(window()?.platform === "macos" && !window()?.fullscreen && !collapsed, el => el.pl(76))
      .when(!collapsed, el => el.child(h_flex().flex_1().gap(8).items_center().child(this.emblem(t)).child(h_flex().font_semibold().text_color(t.accent).child("HERDR ⚙ MECHANICUS").child(div().w(8).ml(2).text_color(t.accent).when(motion(), el => el.frames(["▮", " "], 530)).when(!motion(), el => el.child("▮"))))))
      .when(!collapsed, el => el.child(this.button("search", svg("mods/chrome-mechanicus/search.svg").size(15), () => run("mod.open", { name: "picker" }))))
      // On the macOS rail the traffic lights fill the row; the agents list's » unfolds it.
      .when(!(collapsed && window()?.platform === "macos"), el => el.child(this.button("sidebar-toggle", svg("mods/chrome-mechanicus/sidebar.svg").size(15), toggleSidebar)));
  }
}
