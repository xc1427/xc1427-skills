#!/bin/bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CREATE_SCRIPT="$REPO_ROOT/skills/cx1-git-worktree/scripts/git-worktree-create.sh"
REMOVE_SCRIPT="$REPO_ROOT/skills/cx1-git-worktree/scripts/git-worktree-remove.sh"

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

assert_contains() {
  local haystack="$1" needle="$2" message="$3"
  [[ "$haystack" == *"$needle"* ]] || fail "$message: expected to find '$needle'"
}

assert_ref_missing() {
  local repo="$1" branch="$2" message="$3"
  if git -C "$repo" show-ref --verify --quiet "refs/heads/$branch"; then
    fail "$message: $branch still exists"
  fi
}

create_temp_repo() {
  local root repo
  root="$(mktemp -d)"
  repo="$root/demo"
  mkdir -p "$repo"
  git -C "$repo" init -q
  git -C "$repo" config user.name "Test User"
  git -C "$repo" config user.email "test@example.com"
  printf 'base\n' > "$repo/README.md"
  git -C "$repo" add README.md
  git -C "$repo" commit -qm init
  printf '%s\n' "$repo"
}

test_remove_uses_recorded_branch_after_switch() {
  local repo worktree output
  repo="$(create_temp_repo)"
  worktree="$(cd "$repo" && "$CREATE_SCRIPT" feature-a)"

  git -C "$repo" branch feature/payment-refactor
  git -C "$worktree" switch -q feature/payment-refactor

  output="$(cd "$repo" && "$REMOVE_SCRIPT" "$worktree")"

  assert_contains "$output" "CX1 created branch: cxi/worktree/feature-a" "reported recorded branch"
  assert_ref_missing "$repo" "cxi/worktree/feature-a" "recorded temporary branch should be deleted"
  git -C "$repo" show-ref --verify --quiet refs/heads/feature/payment-refactor \
    || fail "current business branch should be retained"
}

test_remove_deletes_unmerged_recorded_branch() {
  local repo worktree output
  repo="$(create_temp_repo)"
  worktree="$(cd "$repo" && "$CREATE_SCRIPT" feature-b)"
  printf 'temporary work\n' > "$worktree/work.txt"
  git -C "$worktree" add work.txt
  git -C "$worktree" commit -qm "temporary work"

  output="$(cd "$repo" && "$REMOVE_SCRIPT" "$worktree")"

  assert_contains "$output" "CX1 创建分支 cxi/worktree/feature-b 已删除" "unmerged temporary branch deletion"
  assert_ref_missing "$repo" "cxi/worktree/feature-b" "unmerged temporary branch should be deleted"
}

test_remove_accepts_non_cxi_metadata() {
  local repo worktree metadata_file output
  repo="$(create_temp_repo)"
  worktree="$(cd "$repo" && "$CREATE_SCRIPT" feature-c)"
  metadata_file="$(git -C "$worktree" rev-parse --git-path cx1-created-branch)"
  git -C "$repo" branch worktree-legacy
  printf '%s\n' 'worktree-legacy' > "$metadata_file"

  output="$(cd "$repo" && "$REMOVE_SCRIPT" "$worktree")"

  assert_contains "$output" "CX1 创建分支 worktree-legacy 已删除" "non-cxi metadata deletion"
  assert_ref_missing "$repo" "worktree-legacy" "recorded non-cxi branch should be deleted"
}

test_remove_uses_recorded_branch_after_switch
test_remove_deletes_unmerged_recorded_branch
test_remove_accepts_non_cxi_metadata

echo "PASS: git-worktree-remove"
