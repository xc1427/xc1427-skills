# xc1427-skills

Personal agent skills repository, compatible with the `npm skills` skill manager.

## Structure

```
skills/<skill-name>/SKILL.md
```

Each skill is a Markdown file with YAML front matter (`name`, `description`) followed by the skill prompt body.

## Skills

| Skill | Description |
|-------|-------------|
| [c14](skills/c14/SKILL.md) | Personal c14-* script launcher — discover and run scripts in `~/.local/bin` |
| [c14-chatgpt-guarded](skills/c14-chatgpt-guarded/SKILL.md) | Install and maintain the scoped ChatGPT Guarded macOS launcher |
| [c14-git-worktree](skills/c14-git-worktree/SKILL.md) | Git worktree management — create, delete, sync commits across worktrees, and install standalone scripts to `~/.local/bin` |

## Install

```bash
npm skills install xc1427/xc1427-skills
```

For local development from a checkout, keep the repository as the source of truth:

```bash
./scripts/link-agent-skills.sh
./scripts/link-claude-skills.sh
```

The first command creates one `~/.agents/skills/c14` umbrella link. The second creates the top-level per-skill links required by Claude Code.
