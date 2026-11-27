---
name: scriptorium
description: Open a file in PyCharm's LightEdit mode (`pycharm -e <file>`), the lightweight single-file editor window with no project. Use when the user says "scriptorium" or "data-slate", or asks to open, show, view or edit a file (markdown, text, config, code) "in PyCharm", "in an editor" or in a window of its own. Several files open together. Needs PyCharm installed; does not need Herdr.
---

# Scriptorium

Opens files as data-slates in **PyCharm LightEdit**: a small editor window per launch, no project opened, using
the person's normal PyCharm.

```bash
<base>/open-file.sh <path/to/file> [<more files>...]
```

`<base>` is this skill's folder (the "Base directory" shown when the skill loads). Relative paths are made
absolute. The script finds the launcher (`pycharm` on PATH, else `/Applications/PyCharm*.app` or
`~/Applications/PyCharm*.app`, JetBrains Toolbox's included), starts it detached with `-e`, and returns at once.
If PyCharm is already running, the files open in it. It fails with a message when no PyCharm is found.

Tell the person which files were opened. A dotenv file holds secrets: it is only opened, so don't copy its values
elsewhere.
