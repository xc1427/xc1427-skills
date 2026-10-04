---
name: cx1-ask-claude
description: Ask the local Claude Code CLI to perform a task or provide a second opinion when the user explicitly invokes cx1-ask-claude.
disable-model-invocation: true
---

Run `claude -p` with the relevant project directory as the process working
directory (use the shell tool's `workdir` or the subprocess's `cwd`). Pass the
task through stdin.

Give Claude a self-contained brief: the requested outcome, relevant file paths,
and any context it needs from this conversation. It cannot see this conversation.
For a review, ask it to report findings without editing files. For other tasks,
follow the user's requested scope. Keep normal Claude permissions.

Wait for completion, read the response, and use it to answer the user or continue
the task. If the call fails, report the failure.

Example:

```sh
claude -p <<'PROMPT'
Review the current uncommitted changes for actionable bugs.
Read related code as needed. Report findings with file locations and reasons.
Do not edit files.
PROMPT
```
