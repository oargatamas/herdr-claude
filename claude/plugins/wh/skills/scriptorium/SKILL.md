---
name: scriptorium
description: Open a file in a JetBrains IDE's LightEdit mode (`<ide> -e <file>`, the lightweight single-file editor window with no project; PyCharm first, else IntelliJ IDEA, WebStorm or any other installed JetBrains IDE), or in VS Code when no JetBrains IDE is installed. Use when the user says "scriptorium" or "data-slate", or asks to open, show, view or edit a file (markdown, text, config, code) "in PyCharm", "in an editor", "in LightEdit" or in a window of its own. Several files open together. Does not need Herdr.
---

# Scriptorium

Opens files as data-slates in an editor window of their own:

1. a **JetBrains IDE in LightEdit** (a small editor window, no project opened, the person's normal
   install), the first one found of PyCharm, IntelliJ IDEA, WebStorm, RubyMine, GoLand, PhpStorm,
   CLion, Rider, RustRover, DataSpell, DataGrip, Aqua: its launcher on PATH, else its `.app` in
   `/Applications` or `~/Applications` (JetBrains Toolbox's included);
2. else **VS Code** (`code` on PATH, or the one inside `Visual Studio Code.app`).

```bash
<base>/open-file.sh <path/to/file> [<more files>...]
```

`<base>` is this skill's folder (the "Base directory" shown when the skill loads). Relative paths are made
absolute. The script starts the editor detached and returns at once; if the IDE is already running, the
files open in it. It prints which app took them.

Tell the person which files were opened, and in which app. If it exits with 3, no app is registered for
the scriptorium: say so, and ask the person to install one of those IDEs (a JetBrains IDE such as PyCharm
for LightEdit, or VS Code); don't fall back to anything else. A dotenv file holds secrets: it is only
opened, so don't copy its values elsewhere.
