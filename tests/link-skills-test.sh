#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
tmp_root="$(mktemp -d)"
trap 'rm -rf "$tmp_root"' EXIT

source_root="$tmp_root/repo/skills"
agent_root="$tmp_root/agents/skills"
agent_backup="$tmp_root/agents/skills-disabled"
claude_root="$tmp_root/claude/skills"
claude_backup="$tmp_root/claude/skills-disabled"

for skill_name in c14-scripts c14-chatgpt-guarded c14-git-worktree; do
  mkdir -p "$source_root/$skill_name"
  printf '%s\n' "---" "name: $skill_name" "description: test fixture" "---" > "$source_root/$skill_name/SKILL.md"
done

mkdir -p "$agent_root/c14-scripts"
printf 'managed copy\n' > "$agent_root/c14-scripts/marker"
ln -s "$source_root/c14-git-worktree" "$agent_root/c14-git-worktree"

AGENT_SKILLS_DIR="$agent_root" \
AGENT_SKILLS_BACKUP_DIR="$agent_backup" \
  "$repo_root/scripts/link-agent-skills.sh" "$source_root"

[[ -L "$agent_root/c14-scripts" ]]
[[ "$(realpath "$agent_root/c14-scripts")" == "$(realpath "$source_root")" ]]
[[ -f "$agent_backup/c14-scripts/marker" ]]
[[ ! -e "$agent_root/c14-git-worktree" ]]

AGENT_SKILLS_DIR="$agent_root" \
AGENT_SKILLS_BACKUP_DIR="$agent_backup" \
  "$repo_root/scripts/link-agent-skills.sh" "$source_root" | grep -F "keep:"

mkdir -p "$claude_root/c14-git-worktree"
printf 'conflict\n' > "$claude_root/c14-git-worktree/marker"

CLAUDE_SKILLS_DIR="$claude_root" \
CLAUDE_SKILLS_BACKUP_DIR="$claude_backup" \
  "$repo_root/scripts/link-claude-skills.sh" "$source_root"

for skill_name in c14-scripts c14-chatgpt-guarded c14-git-worktree; do
  [[ -L "$claude_root/$skill_name" ]]
  [[ "$(realpath "$claude_root/$skill_name")" == "$(realpath "$source_root/$skill_name")" ]]
done
[[ -f "$claude_backup/c14-git-worktree/marker" ]]

second_run="$({
  CLAUDE_SKILLS_DIR="$claude_root" \
  CLAUDE_SKILLS_BACKUP_DIR="$claude_backup" \
    "$repo_root/scripts/link-claude-skills.sh" "$source_root"
} 2>&1)"
grep -F "done: created=0 updated=0 kept=3 backed_up=0" <<< "$second_run"

echo "link skill tests passed"
