#!/bin/bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SYNC_SCRIPT="$REPO_ROOT/skills/c14-git-worktree/scripts/git-worktree-sync.sh"

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

assert_contains() {
  local haystack="$1"
  local needle="$2"
  local message="$3"
  if [[ "$haystack" != *"$needle"* ]]; then
    fail "$message: expected to find '$needle'"
  fi
}

assert_line_count_lte() {
  local text="$1"
  local max_lines="$2"
  local message="$3"
  local actual_lines
  actual_lines=$(printf '%s\n' "$text" | wc -l | tr -d ' ')
  if [ "$actual_lines" -gt "$max_lines" ]; then
    fail "$message: expected <= $max_lines lines, got $actual_lines"
  fi
}

create_sync_conflict_repo() {
  local root repo worktree common_dir reflog_path
  root="$(mktemp -d)"
  root="$(cd "$root" && pwd -P)"
  repo="$root/demo"
  worktree="$root/demo-adhoc-features"

  mkdir -p "$repo"
  cd "$repo"

  git init -q
  git config user.name "Test User"
  git config user.email "test@example.com"
  git checkout -qb cxi.feat.1

  printf 'base\n' > shared.txt
  git add shared.txt
  git commit -qm "init"

  git worktree add -q -b worktree-adhoc-features "$worktree"

  printf 'father change\n' > shared.txt
  git commit -qam "father change"

  printf 'worktree change\n' > "$worktree/shared.txt"
  git -C "$worktree" commit -qam "worktree change"

  common_dir="$(git -C "$worktree" rev-parse --path-format=absolute --git-common-dir)"
  reflog_path="$common_dir/logs/refs/heads/worktree-adhoc-features"
  rm -f "$reflog_path"

  printf '%s\n%s\n' "$repo" "$worktree"
}

test_conflict_output_includes_agent_prompt() {
  [ -x "$SYNC_SCRIPT" ] || fail "sync script is not executable: $SYNC_SCRIPT"

  local repo worktree output prompt_block
  mapfile -t _paths < <(create_sync_conflict_repo)
  repo="${_paths[0]}"
  worktree="${_paths[1]}"

  output="$(cd "$worktree" && "$SYNC_SCRIPT")"
  prompt_block="$(printf '%s\n' "$output" | sed -n '/BEGIN CODING AGENT PROMPT/,/END CODING AGENT PROMPT/p')"

  assert_contains "$output" "❌ cxi.feat.1: dry-run detected conflicts — skipped" "conflict summary"
  assert_contains "$output" "🤖 Copy this to your coding agent:" "agent prompt header"
  assert_contains "$output" "----- BEGIN CODING AGENT PROMPT -----" "prompt start marker"
  assert_contains "$output" "Resolve this git worktree sync conflict for me." "prompt intro"
  assert_contains "$output" "Worktree: $worktree" "worktree path context"
  assert_contains "$output" "Current branch: worktree-adhoc-features" "current branch context"
  assert_contains "$output" "Father branch: cxi.feat.1" "father branch context"
  assert_contains "$output" "Direction: UP (worktree -> father)" "direction context"
  assert_contains "$output" "Start with: cd \"$worktree\" && git merge cxi.feat.1" "merge command context"
  assert_contains "$output" "After that, resolve the conflict on the current branch, verify the result, rerun the sync, and report which files conflicted plus any manual follow-up." "self-contained closing"
  assert_contains "$output" "----- END CODING AGENT PROMPT -----" "prompt end marker"
  assert_line_count_lte "$prompt_block" 9 "prompt block should stay compact"
}

test_conflict_output_includes_agent_prompt

echo "PASS: git-worktree-sync"
