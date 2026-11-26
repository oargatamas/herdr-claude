// A pane's header, for layouts that frame their panes:
//   { "tab": "active", "pane": { "header": { "content": { "mod": "pane-mechanicus" } } } }
// Shows the program's icon (the app's program table), a servo-skull's title (its label
// servo-skull.title, its purpose as the tooltip), the agent's name or the terminal's title, the folder, and the agent's status; buttons split, zoom and close
// this pane. Props from the app: { pane, terminal }. Click: focus the pane.

import { View, div, svg, image } from "gpui-kit";
import { h_flex } from "gpui-base";
import { panes, terminals, props, run, theme, home, layout, shared, openOverlay } from "herdr";

// Sidebar animations on unless stilled with a click on the brand emblem.
const motion = () => shared("mechanicus.motion") !== false;

// Match the first visible tab frame, including the active child of a stack.
function paneFrame(node) {
  if (!node || node.hidden) return null;
  if (node.content?.tab && node.content.pane) return node.content.pane;
  let children = node.children ?? [];
  if (node.type === "stack") {
    const visible = children.filter(child => !child.hidden);
    children = [visible.find(child => child.id === node.active) ?? visible[0]];
  }
  for (const child of children) {
    const frame = paneFrame(child);
    if (frame) return frame;
  }
  return null;
}

function icon(p, size, color) {
  if (!p?.icon) return null;
  return p.tint ? svg(p.icon).size(size).flex_none().text_color(color) : image(p.icon).w(size).h(size).flex_none();
}

function folder(cwd) {
  if (!cwd) return "";
  const h = home();
  return cwd === h ? "~" : cwd.startsWith(h + "/") ? "~" + cwd.slice(h.length) : cwd;
}

export default class Pane extends View {
  init() { this.hovered = false; }

  me() {
    return panes().find((p) => p.pane === props()?.pane);
  }

  button(t, id, icon, command, args) {
    return div()
      .id(id)
      .p(3)
      .rounded(0)
      .text_color(t.dim)
      .hover((s) => s.bg(t.hover).text_color(t.foreground))
      .on_click((_e, cx) => {
        cx.stop_propagation();
        run(command, args);
      })
      .child(svg(`mods/pane-mechanicus/${icon}.svg`).size(14));
  }

  render(cx) {
    const t = theme();
    const p = this.me();
    if (!p) return div();
    // A servo-skull's title is a label, so Claude setting its own terminal title can't overwrite it.
    const labels = p.terminal ? terminals().find((k) => k.address === p.terminal)?.labels : null;
    const skull = labels?.["servo-skull.title"];
    const purpose = labels?.["servo-skull.purpose"];
    const name = skull || ((p.program?.agent || p.program?.shell) && p.program.name) || p.title || p.program?.name || "shell";
    const pic = icon(p.program, 14, t.dim);
    const st = p.status;
    const pane = p.pane;
    const bottom = paneFrame(layout())?.header?.position === "bottom";
    return h_flex()
      .id(`pane-head-${pane}`)
      .size_full()
      .px(10)
      .gap(8)
      .items_center()
      .bg(p.focused ? t.raised : t.chrome)
      .when(bottom, el => el.border_t(1))
      .when(!bottom, el => el.border_b(1))
      .border_color(p.focused ? t.accent : t.input)
      .text_size(12)
      .on_hover((hovered, cx) => { this.hovered = hovered; cx.notify(); })
      .on_click(() => run("pane.focus", { pane }))
      .when(Boolean(pic), (el) => el.child(pic))
      .child(svg("mods/chrome-mechanicus/gear.svg").size(12).flex_none().text_color(p.focused ? t.accent : t.dim).when(p.focused && motion(), g => g.spin(8000)))
      .child(div().id(`ph-n-${pane}`).flex_none().truncate().max_w(260).font_medium().text_color(t.foreground)
        .when(Boolean(purpose), (el) => el.tooltip(purpose)).child(name))
      .child(div().flex_1().truncate().text_color(t.dim).child(p.cwd ? `⟨ ${folder(p.cwd)} ⟩` : ""))
      .when(st === "working", el => el.child(svg("mods/workspace-chrome/spinner.svg").size(12).flex_none().text_color(t.working).spin(900)))
      .when(st === "blocked", el => el.child(div().flex_none().px(6).h(18).flex().items_center().rounded(0).border(1).border_color(t.blocked).bg(t.blocked + "26").text_size(10.5).font_semibold().text_color(t.blocked).child("⚠ NEEDS YOU")))
      .when(st === "done", el => el.child(div().size(7).flex_none().rounded(0).bg(t.done)))
      // Prompt composer for agent sessions (always shown): a big text box that sends to this pane.
      .when(Boolean(p.program?.agent && p.terminal), el => el.child(div().id(`ph-c-${pane}`).flex_none().h(20).px(6).gap(4).flex().items_center()
        .border(1).border_color(t.input).text_size(10.5).text_color(t.muted).cursor_pointer()
        .hover((s) => s.text_color(t.accent).border_color(t.accent))
        .tooltip("Write a long prompt in a big text box")
        .on_click((_e, cx) => { cx.stop_propagation(); openOverlay({ mod: "composer", kind: "dialog", width: 1100, height: 0.75, props: { terminal: p.terminal, pane, name } }); })
        .child(svg("mods/chrome-mechanicus/square-pen.svg").size(12)).child("LITANY")))
      .when(this.hovered, el => el
        .child(this.button(t, `ph-r-${pane}`, "split-right", "pane.split", { direction: "right", pane }))
        .child(this.button(t, `ph-d-${pane}`, "split-down", "pane.split", { direction: "down", pane }))
        .child(this.button(t, `ph-z-${pane}`, p.zoomed ? "unzoom" : "zoom", "pane.zoom", { pane }))
        .child(this.button(t, `ph-x-${pane}`, "close", "pane.close", { pane })));
  }
}
