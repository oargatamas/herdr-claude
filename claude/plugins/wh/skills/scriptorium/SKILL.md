---
name: scriptorium
description: Open a file in the SCRIPTORIUM, a floating Herdr window: a markdown (.md) file shows its source (read-only, line numbers, markdown colouring) beside its render, with SOURCE / SPLIT / RENDER modes; a .env file is a read-only text window with dotenv colouring; any other file is a simple read-only text window; it follows edits to the file live. Use when the user says "scriptorium" or "data-slate", or asks to open, show, view, preview or render a markdown (.md) or other text file in Herdr / in a floating window, or to see a markdown file's source and render side by side. Only works inside Herdr ($HC_TERMINAL_ID set).
---

# Scriptorium

The `scriptorium` Herdr mod shows files in floating windows (data-slates), one per file. A markdown file (`.md`,
`.markdown`) gets the render; a dotenv file (`.env`, or a name ending in `.env` such as `prod.env`; not `.env.local`) is a text window
with dotenv colouring (comments, keys, `=`, quoted values, `export`, `${VAR}`); any other file is a simple text
window: its read-only text, with line numbers, and no SOURCE / SPLIT / RENDER switch. Dotenv files hold secrets:
the window only shows them, so don't copy their values elsewhere.
Drag one by its title to move it; drag its right edge, bottom edge or bottom-right corner to
resize it. It reopens where it was dropped, at the size it was given. A markdown window opens on the
render, with SOURCE and SPLIT (source beside render) a click away. It re-reads its file every
second, so edits show while it is open.

By default the files go to the **SCRIPTORIUM window**: a second, separate Herdr window (its own
home, `~/.local/share/herdr-claude/scriptorium-window`) that shows no spaces or terminals, only
a Mechanicus desk with the data-slates floating on it. It is a normal OS window, so the person
can keep it on another display. The script starts it if it isn't running.

## Open a file

```bash
<base>/open-md.sh <path/to/file>             # in the SCRIPTORIUM window
<base>/open-md.sh --here <path/to/file>      # in the person's own Herdr window instead
```

`<base>` is the "Base directory for this skill" shown when it loads. Use `--here` only when the
person asks for the file in their own window (beside their terminals). The script resolves the
path, hands it to the mod (Herdr's `mod.open` takes no arguments, so the path goes through the
window's `<home>/scriptorium-request` file) and opens the window. While a scriptorium is open,
each further file gets a window of its own (a file that already has one keeps it). Resolve
which file the person means first (search the working folder if they only give a name). For
several files, run the script once per file, a second apart (each run is one request, and the
open windows take requests once a second).

Tell the person in one line which files are shown, and where (the script says). If the script
fails, report its message: not in Herdr, or the mods aren't installed (herdr-claude's
`install.sh` installs them and sets up the SCRIPTORIUM window). If the SCRIPTORIUM window isn't
set up, the script uses the person's window and says so.

## Close a data-slate

```bash
<base>/close-md.sh <path/to/file>...         # close those files' data-slates in the SCRIPTORIUM window
<base>/close-md.sh --here <path/to/file>...  # in the person's own Herdr window
<base>/close-md.sh --all                     # every data-slate there (--here --all: in their window)
```

Use it when the person asks to close a data-slate, or when you are done showing one you opened for
them. Close only the files you opened or they named; `--all` only when they ask for all. Herdr can't
close a mod's window by key, so the script writes a request file (`<home>/scriptorium-close`) that
each open data-slate reads within a second, closing itself when its file is named. A file with no
open window is ignored; the file itself is never touched.

## What it can't do

It stays within Herdr's own rendering (gpui's markdown view, only for markdown files). A data-slate can't leave the Herdr
window it is in (mods get no OS window of their own); the SCRIPTORIUM window itself can go
anywhere. A data-slate stretches by its right and bottom edges only (Herdr anchors a window at
its top left). No HTML/CSS styling, and images or links relative to the file may not resolve. It
only shows the file; editing is done elsewhere (Claude, or an editor), and the window follows the
change. Say so if the person asks for more than that.

The person closes each data-slate with its ×, or Esc in the one that has the keyboard (the one last pressed,
or the newest). The SCRIPTORIUM window closes like any app window (⌘Q there quits only it); the
person's terminals are not in it and keep running.
