Always use Context7 when I need library/API documentation, code generation, setup or configuration steps without me having to explicitly ask.

## Skill Authoring Guidelines

### Prefer independent scripts over agent-dependent ones

When writing functionality for a skill, favor **standalone shell scripts** that can be invoked directly without requiring an agentic (Claude Code) session. A script is standalone if:
- It has no imports or dependencies on agent tools, Claude APIs, or MCP context
- It can be run with `bash script.sh [args]` from any terminal
- Its inputs come from CLI arguments, env vars, or git state — not from agent memory

Only create scripts that depend on an agentic context (e.g., needing Claude tools, reading agent state, calling MCP servers) when:
1. The task cannot be cleanly expressed as a standalone script, **and**
2. A clean architecture without agent coupling is genuinely not achievable

When a standalone script is feasible, it should be the default. Agent-facing skill instructions can then call or reference these scripts rather than re-implementing logic inline.

## Personal Information

- NEVER hardcode absolute home directory paths (e.g. `/Users/<username>/`) in any file committed to the repo. Always use `$HOME`, `~`, or other portable alternatives instead.
- Before committing, double-check that no personal identifiers (usernames, home paths, email addresses, hostnames) have leaked into tracked files.
