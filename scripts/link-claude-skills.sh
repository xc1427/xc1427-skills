#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd -- "$script_dir/.." && pwd)"

source_root="${1:-"$repo_root/skills"}"
target_root="${CLAUDE_SKILLS_DIR:-"$HOME/.claude/skills"}"
backup_root="${CLAUDE_SKILLS_BACKUP_DIR:-"$HOME/.claude/skills-disabled/link-claude-skills-$(date +%Y%m%d-%H%M%S)"}"

if [[ ! -d "$source_root" ]]; then
  echo "source root not found: $source_root" >&2
  exit 1
fi

mkdir -p "$target_root"

created=0
updated=0
kept=0
backed_up=0

for skill_dir in "$source_root"/*; do
  [[ -d "$skill_dir" ]] || continue
  [[ -f "$skill_dir/SKILL.md" ]] || continue

  skill_name="$(basename -- "$skill_dir")"
  link_path="$target_root/$skill_name"

  if [[ -L "$link_path" ]]; then
    existing_target="$(readlink "$link_path")"
    resolved_existing="$(cd -- "$(dirname -- "$link_path")" && realpath "$existing_target" 2>/dev/null || true)"
    resolved_desired="$(realpath "$skill_dir")"

    if [[ "$resolved_existing" == "$resolved_desired" ]]; then
      echo "keep: $link_path -> $existing_target"
      kept=$((kept + 1))
      continue
    fi

    rm "$link_path"
    updated=$((updated + 1))
  elif [[ -e "$link_path" ]]; then
    mkdir -p "$backup_root"
    mv "$link_path" "$backup_root/"
    echo "backup: $link_path -> $backup_root/"
    backed_up=$((backed_up + 1))
  else
    created=$((created + 1))
  fi

  ln -s "$skill_dir" "$link_path"
  echo "link: $link_path -> $skill_dir"
done

echo "done: created=$created updated=$updated kept=$kept backed_up=$backed_up"
