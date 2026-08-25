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
| [cx1-scripts](skills/cx1-scripts/SKILL.md) | Personal cx1-* script launcher — discover, run, and author scripts in `~/.local/bin` |
| [cx1-afk](skills/cx1-afk/SKILL.md) | Keep the current session working safely while the user is temporarily AFK |
| [cx1-chatgpt-guarded](skills/cx1-chatgpt-guarded/SKILL.md) | Install and maintain the scoped ChatGPT Guarded macOS launcher |
| [cx1-git-worktree](skills/cx1-git-worktree/SKILL.md) | Git worktree management — create, delete, sync commits across worktrees, and install standalone scripts to `~/.local/bin` |
| [cx1-man-tongue](skills/cx1-man-tongue/SKILL.md) | Rewrite or draft concise, sharp, human prose with controlled rough edges |
| [cx1-brainstorm](skills/cx1-brainstorm/SKILL.md) | Explicit design discussion, option comparison, and decision convergence |
| [cx1-community-regression-research](skills/cx1-community-regression-research/SKILL.md) | Find public reports of bugs or regressions |
| [cx1-tibo-post](skills/cx1-tibo-post/SKILL.md) | Summarize Tibo Sottiaux's substantive X posts from the past three days |

## Install

```bash
npm skills install xc1427/xc1427-skills
```

To deploy this repository's skills into user-scope discovery directories through symlinks:

```bash
./scripts/link-agent-skills.sh
./scripts/link-claude-skills.sh
```

The first command creates the `~/.agents/skills/cx1` namespace umbrella for this repository. The second creates the top-level per-skill links required by Claude Code.
