---
name: scriptorium
description: Open a markdown file in the SCRIPTORIUM, a floating Herdr window showing its source (read-only, line numbers, markdown colouring) beside its render, with SOURCE / SPLIT / RENDER modes; it follows edits to the file live. Use when the user says "scriptorium" or "data-slate", or asks to open, show, view, preview or render a markdown (.md) file in Herdr / in a floating window, or to see a markdown file's source and render side by side. Only works inside Herdr ($HC_TERMINAL_ID set).
---

# Scriptorium

The `scriptorium` Herdr mod is a floating window (drag it anywhere; it reopens where it was
dropped) that shows one markdown file: its source on the left, the render on the right. It
re-reads the file every second, so edits show while it is open.

## Open a file

```bash
<base>/open-md.sh <path/to/file.md>
```

`<base>` is the "Base directory for this skill" shown when it loads. The script resolves the
path, hands it to the mod (Herdr's `mod.open` takes no arguments, so the path goes through
`~/.local/share/herdr-claude/scriptorium`) and opens the window, or, if it is already open,
just switches it to the new file. Resolve which file the person means first (search the working
folder if they only give a name); one file at a time.

Tell the person in one line which file is shown. If the script fails, report its message: not
in Herdr, or the mod isn't installed (herdr-claude's `install.sh` installs it).

## What it can't do

It stays within Herdr's own rendering (gpui's markdown view): no HTML/CSS styling, and images
or links relative to the file may not resolve. It only shows the file; editing is done
elsewhere (Claude, or an editor), and the window follows the change. Say so if the person asks
for more than that.

Close it with its × (or `herdr-app do overlay.close`).
