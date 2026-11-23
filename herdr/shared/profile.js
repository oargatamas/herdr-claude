// Claude profile badges. A Claude hook (~/.claude/herdr-profile-label.sh) labels its
// terminal herdr.profile=company|personal on session start and clears it on exit.
import { div } from "gpui-kit";
import { terminals } from "herdr";

export const PROFILES = [
  { id: "company", label: "Company", color: "ansi6" },   // cyan, as in Claude's status line
  { id: "personal", label: "Personal", color: "ansi5" }, // magenta
];

// Labels hold ids local to the terminal's machine; the app prefixes remote ones with "<machine>/".
const same = (id, local) => Boolean(local) && (id === local || id.endsWith(`/${local}`));

// The profiles running in a space or tab ("space" | "tab", its id), in PROFILES order.
export function profilesIn(kind, id) {
  const found = new Set();
  for (const term of terminals()) {
    const labels = term.labels ?? {};
    const profile = labels["herdr.profile"];
    if (profile && term.state !== "exited" && same(id, labels[`herdr.${kind}`])) found.add(profile);
  }
  return PROFILES.filter((p) => found.has(p.id));
}

export function badge(t, profile, size = 10) {
  const c = t[profile.color];
  // Mechanicus look: square data-plate with bracketed sigil.
  return div().flex_none().px(4).h(size + 6).flex().items_center().rounded(0)
    .border(1).border_color(c).text_color(c).text_size(size).font_semibold()
    .child(`⟦${profile.label.toUpperCase()}⟧`);
}
