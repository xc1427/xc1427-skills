#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd -- "$script_dir/.." && pwd)"

source_root="${1:-"$repo_root/skills"}"
target_root="${AGENT_SKILLS_DIR:-"$HOME/.agents/skills"}"
backup_root="${AGENT_SKILLS_BACKUP_DIR:-"$HOME/.agents/skills-disabled/link-agent-skills-$(date +%Y%m%d-%H%M%S)"}"
umbrella_name="${C14_SKILLS_UMBRELLA_NAME:-c14}"
link_path="$target_root/$umbrella_name"

if [[ ! -d "$source_root" ]]; then
  echo "source root not found: $source_root" >&2
  exit 1
fi

mkdir -p "$target_root"

if [[ -L "$link_path" ]]; then
  existing_target="$(readlink "$link_path")"
  resolved_existing="$(cd -- "$(dirname -- "$link_path")" && realpath "$existing_target" 2>/dev/null || true)"
  resolved_desired="$(realpath "$source_root")"

  if [[ "$resolved_existing" == "$resolved_desired" ]]; then
    echo "keep: $link_path -> $existing_target"
  else
    rm "$link_path"
    echo "remove stale link: $link_path -> $existing_target"
    ln -s "$source_root" "$link_path"
    echo "link: $link_path -> $source_root"
  fi
elif [[ -e "$link_path" ]]; then
  mkdir -p "$backup_root"
  mv "$link_path" "$backup_root/"
  echo "backup: $link_path -> $backup_root/"
  ln -s "$source_root" "$link_path"
  echo "link: $link_path -> $source_root"
else
  ln -s "$source_root" "$link_path"
  echo "link: $link_path -> $source_root"
fi

for skill_dir in "$source_root"/*; do
  [[ -d "$skill_dir" ]] || continue
  [[ -f "$skill_dir/SKILL.md" ]] || continue

  skill_name="$(basename -- "$skill_dir")"
  [[ "$skill_name" == "$umbrella_name" ]] && continue

  legacy_link="$target_root/$skill_name"
  [[ -L "$legacy_link" ]] || continue

  existing_target="$(readlink "$legacy_link")"
  resolved_existing="$(cd -- "$(dirname -- "$legacy_link")" && realpath "$existing_target" 2>/dev/null || true)"
  resolved_desired="$(realpath "$skill_dir")"

  if [[ "$resolved_existing" == "$resolved_desired" ]]; then
    rm "$legacy_link"
    echo "remove duplicate skill link: $legacy_link -> $existing_target"
  fi
done
