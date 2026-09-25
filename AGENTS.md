## Repository-Wide Requirements

### Privacy and Portability

- Never hardcode absolute home directory paths such as `/Users/<username>/` in files committed to the repository. Use `$HOME`, `~`, or another portable alternative.
- Before committing, check that tracked files do not contain personal usernames, home paths, email addresses, or hostnames.

## Skill Authoring Guidelines

### Keep invocation policy aligned across Codex and Claude Code

When a skill is available in both Codex and Claude Code, keep implicit invocation behavior aligned in both clients. Codex reads `policy.allow_implicit_invocation` from `agents/openai.yaml`. Claude Code's equivalent is `skillOverrides.<skill-name>` in settings, with the opposite polarity:

| Intended behavior | Codex `allow_implicit_invocation` | Claude Code setting |
| --- | --- | --- |
| Allow automatic invocation | `true` or omitted | No `skillOverrides` entry |
| Require explicit invocation | `false` | `skillOverrides.<skill-name>: "user-invocable-only"` |

Claude Code's equivalent frontmatter field is `disable-model-invocation` with the opposite polarity, but do not put it in shared `SKILL.md` frontmatter: Codex's skill validator rejects that non-standard key. Use the settings override instead. Do not use `user-invocable: false`; it controls slash-menu visibility, not automatic invocation.

### Prefer independent scripts over agent-dependent ones

When writing functionality for a skill, favor **standalone shell scripts** that can be invoked directly without requiring an agentic session. A script is standalone if:

- It has no imports or dependencies on agent tools, model APIs, or MCP context
- It can be run with `bash script.sh [args]` from any terminal
- Its inputs come from CLI arguments, environment variables, or git state rather than agent memory

Only create scripts that depend on an agentic context when the task cannot be cleanly expressed as a standalone script and a clean architecture without agent coupling is genuinely not achievable.

## User-Scope Skill Deployment

Use the scripts below to deploy this repository's skills into user-scope discovery directories through symlinks. The repository remains the source of truth; deployment targets contain links, not copied skill contents.

For agents that discover nested skills below `~/.agents/skills`, create one umbrella symlink from the repository root:

```zsh
./scripts/link-agent-skills.sh
```

This creates the namespace umbrella `~/.agents/skills/cx1`, pointing it to this repository's `skills/` directory, and removes redundant top-level links that already point to individual skills in the same checkout.

Claude Code does not discover nested skills through an umbrella directory. After adding or renaming a skill under `skills/`, also run:

```zsh
./scripts/link-claude-skills.sh
```

That script scans `skills/*/SKILL.md` and creates or updates one top-level `~/.claude/skills/<skill-name>` symlink for every skill. The Agents-only namespace umbrella `~/.agents/skills/cx1` has no Claude Code counterpart.
