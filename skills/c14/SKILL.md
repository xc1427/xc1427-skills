---
name: c14
description: >
  Use this skill when the user types "/c14", wants to run a personal automation script,
  asks "what scripts do I have", or expresses intent that might match a personal task
  (e.g. "run my backup", "clean up node_modules", "sync my dotfiles"). Also use this
  skill when the user asks how to write a c14 script, wants to create a new c14 script,
  or asks about the c14 script conventions. This is a personal script hub — all
  c14-* scripts in ~/.local/bin are candidates.
---

You are running the c14 personal script launcher. Follow these steps exactly:

## Step 1 — Capture intent

Note whether the user's message contains a hint about what they want to do (e.g. "backup", "sync", "clean"). Store it as INTENT. If the message is just "/c14" with nothing else, INTENT is empty.

## Step 2 — Discover scripts

Run this command to collect each script's metadata:
```bash
for f in "$HOME/.local/bin"/c14-*; do
  [ -x "$f" ] || continue
  name=$(basename "$f")
  desc=$(grep -m1 '^# DESC:' "$f" 2>/dev/null | sed 's/^# DESC: *//')
  echo "$name|||${desc:-no description}"
done
```

## Step 3 — Present and ask

If INTENT is non-empty, fuzzy-match it against script names and DESC values and **show only matching scripts first**, followed by the rest. Otherwise show all scripts.

Use AskUserQuestion to present a numbered list. For each entry show:
- **Name**: the script name
- **Description**: its DESC value

Ask: "Which c14 script would you like to run?"

Include "Cancel" as the last option.

## Step 4 — Collect arguments (if needed)

Read the first 30 lines of the chosen script:
```bash
head -30 "$HOME/.local/bin/<chosen-script>"
```

Inspect the script's argument handling (positional `$1`/`$2`, `getopts`, `${1:?...}` guards, usage strings, etc.) and determine what inputs are required or optional. If the script takes arguments, ask the user to supply them before running. Skip this step if the script clearly takes no arguments.

## Step 5 — Execute

Run the chosen script, passing any collected arguments:
```bash
$HOME/.local/bin/<chosen-script> [args]
```

Report stdout/stderr and exit code to the user. If the script fails, summarize what went wrong.

---

## Authoring a new c14 script

If the user asks how to write a c14 script, or asks you to create one, follow this template and conventions:

### File naming & placement

```
~/.local/bin/c14-<verb>[-<noun>]
```

Examples: `c14-backup-dotfiles`, `c14-clean-nodemodules`, `c14-sync-notes`

### Required header block

Every c14 script must start with this header (adapt values, keep the keys exact):

```bash
#!/usr/bin/env bash
# DESC: One-line human-readable description of what this script does
set -euo pipefail
```

- `DESC` is displayed in the launcher menu — keep it under ~70 characters.
- `set -euo pipefail` is mandatory — it makes the script fail fast on errors, unset variables, and broken pipes.
- Argument requirements are inferred by the AI from the script body itself — use clear patterns like `${1:?Usage: c14-foo <arg>}` or a usage block so the AI can read them correctly.

### Body conventions

- Use `"$HOME"` not `~` inside scripts (tilde is not expanded in all contexts).
- Print progress with `echo` or `printf`; send errors to stderr: `echo "Error: ..." >&2`.
- Exit with a non-zero code on failure: `exit 1`.
- Keep scripts single-purpose — one script, one job.

### Make it executable

After creating the file, run:
```bash
chmod +x "$HOME/.local/bin/c14-<name>"
```

### Minimal example

```bash
#!/usr/bin/env bash
# DESC: Say hello to a person
# ARGS: <name>
set -euo pipefail

name="${1:?Usage: c14-hello <name>}"
echo "Hello, $name!"
```
