// Forks the focused pane's Claude conversation, with the same profile and folder:
// into a new tab (cmd-shift-t, this folder's mod) or a split beside it (cmd-ctrl-<arrow>,
// the claude-fork-<dir> mods). Each opens as an invisible popup only to read the focus,
// then closes itself. The Claude hook (~/.claude/herdr-profile-label.sh) labels each
// Claude terminal with herdr.profile and herdr.claude-session.
import { View, div } from "gpui-kit";
import { props, closeOverlay, run, focused, terminals, notify, home, checking } from "herdr";

const launcher = () => `${home()}/.local/bin/claude-ws`; // does the left/up swap after a split

export function forkView(where) {
  return class ClaudeFork extends View {
    init() {
      if (checking()) return;
      try { this.fork(); } finally { closeOverlay(props().overlay); }
    }

    fork() {
      const f = focused();
      const term = f?.terminal && terminals().find((t) => t.address === f.terminal);
      const labels = term?.labels ?? {};
      const session = labels["herdr.claude-session"];
      if (!session) {
        notify({ title: "Nothing to fork", body: "The focused pane isn't running a Claude session (or it started before the fork hook).", level: "warning" });
        return;
      }
      const profile = labels["herdr.profile"] === "personal" ? "personal" : "company";
      const resume = ["--resume", session, "--fork-session"];

      if (where === "tab") {
        const argv = profile === "personal"
          ? ["env", `CLAUDE_CONFIG_DIR=${home()}/.claude-personal`, "claude", ...resume]
          : ["claude", ...resume];
        run("tab.new", { argv, folder: f.cwd ?? undefined, space: f.space });
        return;
      }
      if (!f.pane) {
        notify({ title: "Can't split here", body: "Focus a pane in a tab to fork beside it.", level: "warning" });
        return;
      }
      // pane.split goes right or down; the launcher moves the new pane for left/up.
      const direction = where === "left" || where === "right" ? "right" : "down";
      const move = where === "left" || where === "up" ? [where] : [];
      run("pane.split", { direction, pane: f.pane, argv: [launcher(), ...move, "--profile", profile, "--", ...resume] });
    }

    render() { return div(); }
  };
}
