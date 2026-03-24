# xc1427-skills

Personal Claude Code agent skills repository, compatible with the `npm skills` skill manager.

## Structure

```
skills/<skill-name>/SKILL.md
```

Each skill is a Markdown file with YAML front matter (`name`, `description`) followed by the skill prompt body.

## Skills

| Skill | Description |
|-------|-------------|
| [c14](skills/c14/SKILL.md) | Personal c14-* script launcher — discover and run scripts in `~/.local/bin` |
| [gh-cli](skills/gh-cli/SKILL.md) | GitHub CLI (gh) comprehensive reference |

## Install

```bash
npm skills install xc1427/xc1427-skills
```
