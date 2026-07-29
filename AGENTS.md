# Repository Instructions

## Skill Authoring Guidelines

### Prefer independent scripts over agent-dependent ones

When writing functionality for a skill, favor **standalone shell scripts** that can be invoked directly without requiring an agentic session. A script is standalone if:

- It has no imports or dependencies on agent tools, model APIs, or MCP context
- It can be run with `bash script.sh [args]` from any terminal
- Its inputs come from CLI arguments, environment variables, or git state rather than agent memory

Only create scripts that depend on an agentic context when the task cannot be cleanly expressed as a standalone script and a clean architecture without agent coupling is genuinely not achievable.

## Personal Information

- Never hardcode absolute home directory paths such as `/Users/<username>/` in files committed to the repository. Use `$HOME`, `~`, or another portable alternative.
- Before committing, check that tracked files do not contain personal usernames, home paths, email addresses, or hostnames.

## Local Skill Links

Use the repository as the source of truth for local development instead of copying its skills into user-scope directories.

For agents that discover nested skills below `~/.agents/skills`, create one umbrella symlink from the repository root:

```zsh
./scripts/link-agent-skills.sh
```

This creates the namespace umbrella `~/.agents/skills/c14`, pointing it to this repository's `skills/` directory, and removes redundant top-level links that already point to individual skills in the same checkout.

Claude Code does not discover nested skills through an umbrella directory. After adding or renaming a skill under `skills/`, also run:

```zsh
./scripts/link-claude-skills.sh
```

That script scans `skills/*/SKILL.md` and creates or updates one top-level `~/.claude/skills/<skill-name>` symlink for every skill. The Agents-only namespace umbrella `~/.agents/skills/c14` has no Claude Code counterpart.
