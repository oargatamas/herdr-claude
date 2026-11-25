---
name: scriptorium
description: Open a markdown file in the SCRIPTORIUM, a floating Herdr window showing its source (read-only, line numbers, markdown colouring) beside its render, with SOURCE / SPLIT / RENDER modes; it follows edits to the file live. Use when the user says "scriptorium" or "data-slate", or asks to open, show, view, preview or render a markdown (.md) file in Herdr / in a floating window, or to see a markdown file's source and render side by side. Only works inside Herdr ($HC_TERMINAL_ID set).
---

# Scriptorium

The `scriptorium` Herdr mod shows markdown files in floating windows, one window per file (drag
each anywhere; it reopens where it was dropped). A window opens on the render; SOURCE and SPLIT
(source beside render) are a click away. It re-reads its file every second, so edits show while
it is open.

## Open a file

```bash
<base>/open-md.sh <path/to/file.md>
```

`<base>` is the "Base directory for this skill" shown when it loads. The script resolves the
path, hands it to the mod (Herdr's `mod.open` takes no arguments, so the path goes through
`~/.local/share/herdr-claude/scriptorium`) and opens the window; while a scriptorium is open,
each further file gets a window of its own (a file that already has one keeps it). Resolve
which file the person means first (search the working folder if they only give a name). For
several files, run the script once per file, a second apart (each run is one request, and the
open windows take requests once a second).

Tell the person in one line which files are shown. If the script fails, report its message: not
in Herdr, or the mod isn't installed (herdr-claude's `install.sh` installs it).

## What it can't do

It stays within Herdr's own rendering (gpui's markdown view), inside the Herdr window: it can't be dragged out onto
another display (mods get no OS window of their own). No HTML/CSS styling, and images
or links relative to the file may not resolve. It only shows the file; editing is done
elsewhere (Claude, or an editor), and the window follows the change. Say so if the person asks
for more than that.

Close each window with its ×, or Esc in the window that has the keyboard (the one last
pressed, or the newest).
