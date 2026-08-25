#!/bin/bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SYNC_SCRIPT="$REPO_ROOT/skills/cx1-git-worktree/scripts/git-worktree-sync.sh"

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

create_sync_repo() {
  local mode="${1:-clean}" root repo worktree
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

  if [ "$mode" = "conflict" ]; then
    printf 'father change\n' > shared.txt
    git commit -qam "father change"

    printf 'worktree change\n' > "$worktree/shared.txt"
    git -C "$worktree" commit -qam "worktree change"
  fi

  printf '%s\n%s\n' "$repo" "$worktree"
}

assert_heads_unchanged() {
  local repo="$1" worktree="$2" before_primary_sha="$3" before_worktree_sha="$4"
  [ "$before_primary_sha" = "$(git -C "$repo" rev-parse HEAD)" ] || fail "primary worktree changed"
  [ "$before_worktree_sha" = "$(git -C "$worktree" rev-parse HEAD)" ] || fail "linked worktree changed"
}

assert_failed_sync_preserves_heads() {
  local repo="$1" worktree="$2" run_path="$3" expected_error="$4"
  shift 4

  local output before_primary_sha before_worktree_sha
  before_primary_sha="$(git -C "$repo" rev-parse HEAD)"
  before_worktree_sha="$(git -C "$worktree" rev-parse HEAD)"

  if output="$(cd "$run_path" && "$SYNC_SCRIPT" "$@" 2>&1)"; then
    fail "sync should fail: $expected_error"
  fi

  assert_contains "$output" "$expected_error" "sync failure"
  assert_heads_unchanged "$repo" "$worktree" "$before_primary_sha" "$before_worktree_sha"
}

test_conflict_output_includes_agent_prompt() {
  [ -x "$SYNC_SCRIPT" ] || fail "sync script is not executable: $SYNC_SCRIPT"

  local repo worktree output prompt_block paths
  paths="$(create_sync_repo conflict)"
  repo="${paths%%$'\n'*}"
  worktree="${paths#*$'\n'}"

  output="$(cd "$worktree" && "$SYNC_SCRIPT" --father cxi.feat.1)"
  prompt_block="$(printf '%s\n' "$output" | sed -n '/BEGIN CODING AGENT PROMPT/,/END CODING AGENT PROMPT/p')"

  assert_contains "$output" "DEPRECATED: cx1-git-worktree-sync.sh" "deprecation warning"
  assert_contains "$output" "只检查 linked worktree → --father 的合并" "dry-run-only notice"
  assert_contains "$output" "❌ cxi.feat.1: dry-run detected conflicts" "conflict summary"
  assert_contains "$output" "🤖 Copy this to your coding agent:" "agent prompt header"
  assert_contains "$output" "----- BEGIN CODING AGENT PROMPT -----" "prompt start marker"
  assert_contains "$output" "Resolve this git worktree sync conflict for me." "prompt intro"
  assert_contains "$output" "Worktree: $worktree" "worktree path context"
  assert_contains "$output" "Current branch: worktree-adhoc-features" "current branch context"
  assert_contains "$output" "Father branch: cxi.feat.1" "father branch context"
  assert_contains "$output" "This command was a dry-run and did not merge anything." "dry-run context"
  assert_contains "$output" "Start with: cd \"$worktree\" && git merge cxi.feat.1" "merge command context"
  assert_contains "$output" "Resolve the conflict, rerun the dry-run, then manually merge only after review." "self-contained closing"
  assert_contains "$output" "----- END CODING AGENT PROMPT -----" "prompt end marker"
  assert_line_count_lte "$prompt_block" 9 "prompt block should stay compact"
}

test_clean_dry_run_does_not_merge() {
  local repo worktree output before_primary_sha before_worktree_sha paths
  paths="$(create_sync_repo)"
  repo="${paths%%$'\n'*}"
  worktree="${paths#*$'\n'}"
  before_primary_sha="$(git -C "$repo" rev-parse HEAD)"
  before_worktree_sha="$(git -C "$worktree" rev-parse HEAD)"

  output="$(cd "$worktree" && "$SYNC_SCRIPT" --father cxi.feat.1)"
  assert_contains "$output" "✓ Dry-run clean. No merge was performed." "clean dry-run result"
  assert_heads_unchanged "$repo" "$worktree" "$before_primary_sha" "$before_worktree_sha"
}

test_up_sync_defaults_to_primary_current_branch() {
  local repo worktree output before_primary_sha before_worktree_sha paths
  paths="$(create_sync_repo)"
  repo="${paths%%$'\n'*}"
  worktree="${paths#*$'\n'}"
  before_primary_sha="$(git -C "$repo" rev-parse HEAD)"
  before_worktree_sha="$(git -C "$worktree" rev-parse HEAD)"

  output="$(cd "$worktree" && "$SYNC_SCRIPT")"
  assert_contains "$output" "Target branch: cxi.feat.1 (primary worktree current branch)" "default target"
  assert_contains "$output" "✓ Dry-run clean. No merge was performed." "default dry-run result"
  assert_heads_unchanged "$repo" "$worktree" "$before_primary_sha" "$before_worktree_sha"
}

test_up_sync_refuses_when_primary_branch_differs_from_dry_run_target() {
  local repo worktree paths
  paths="$(create_sync_repo)"
  repo="${paths%%$'\n'*}"
  worktree="${paths#*$'\n'}"

  git -C "$repo" checkout -qb unrelated
  assert_failed_sync_preserves_heads "$repo" "$worktree" "$worktree" \
    "primary worktree is on 'unrelated', but dry-run target is 'cxi.feat.1'" \
    --father cxi.feat.1
}

test_primary_worktree_rejects_down_sync() {
  local repo worktree paths
  paths="$(create_sync_repo)"
  repo="${paths%%$'\n'*}"
  worktree="${paths#*$'\n'}"

  assert_failed_sync_preserves_heads "$repo" "$worktree" "$repo" \
    "this command only supports a linked worktree; DOWN sync was removed" \
    --father cxi.feat.1
}

test_conflict_output_includes_agent_prompt
test_clean_dry_run_does_not_merge
test_up_sync_defaults_to_primary_current_branch
test_up_sync_refuses_when_primary_branch_differs_from_dry_run_target
test_primary_worktree_rejects_down_sync

echo "PASS: git-worktree-sync"
