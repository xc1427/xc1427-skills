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
| [c14-scripts](skills/c14-scripts/SKILL.md) | Personal c14-* script launcher — discover, run, and author scripts in `~/.local/bin` |
| [c14-chatgpt-guarded](skills/c14-chatgpt-guarded/SKILL.md) | Install and maintain the scoped ChatGPT Guarded macOS launcher |
| [c14-git-worktree](skills/c14-git-worktree/SKILL.md) | Git worktree management — create, delete, sync commits across worktrees, and install standalone scripts to `~/.local/bin` |
| [c14-man-tongue](skills/c14-man-tongue/SKILL.md) | Rewrite or draft concise, sharp, human prose with controlled rough edges |

## Install

```bash
npm skills install xc1427/xc1427-skills
```

For local development from a checkout, keep the repository as the source of truth:

```bash
./scripts/link-agent-skills.sh
./scripts/link-claude-skills.sh
```

The first command creates the `~/.agents/skills/c14` namespace umbrella for this repository. The second creates the top-level per-skill links required by Claude Code.
