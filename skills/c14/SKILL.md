---
name: c14
description: Use this skill when the user types "/c14", asks to run a personalized script, or says "what c14 scripts do I have". This is a menu for all personal c14-* scripts in ~/.local/bin.
---

You are running the c14 personal script launcher. Follow these steps exactly:

## Step 1 — Discover scripts

Run this command:
```bash
for f in "$HOME/.local/bin"/c14-*; do
  name=$(basename "$f")
  desc=$(grep -m1 '^# DESC:' "$f" 2>/dev/null | sed 's/^# DESC: *//')
  echo "$name:::${desc:-no description}"
done
```

## Step 2 — Present and ask

Use AskUserQuestion to show the user a numbered list of scripts with their descriptions. Ask: "Which c14 script would you like to run?"

Each option label should be the script name, and the description should be its DESC value.

Include "Cancel" as the last option.

## Step 3 — Execute

If the user picks a script (not Cancel), run it with Bash:
```bash
$HOME/.local/bin/<chosen-script>
```

Report the result to the user.
