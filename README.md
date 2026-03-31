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
| [c14-git-worktree](skills/c14-git-worktree/SKILL.md) | Git worktree management — create, delete, sync commits across worktrees, and install standalone scripts to `~/.local/bin` |
## Install

```bash
npm skills install xc1427/xc1427-skills
```
