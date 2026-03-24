# xc1427-skills

Personal Claude Code agent skills repository.

## Structure

```
.claude/skills/<skill-name>/SKILL.md
```

Each skill is a Markdown file with a YAML front matter (`name`, `description`) followed by the skill prompt body.

## Skills

| Skill | Description |
|-------|-------------|
| [c14](.claude/skills/c14/SKILL.md) | Personal c14-* script launcher — discover and run scripts in `~/.local/bin` |
| [gh-cli](.claude/skills/gh-cli/SKILL.md) | GitHub CLI (gh) comprehensive reference |

## Usage

Install skills with the Claude Code skill manager, or copy `.claude/skills/` into your project or home `.claude/` directory.
