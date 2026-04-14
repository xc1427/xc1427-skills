#!/bin/bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CREATE_SCRIPT="$REPO_ROOT/skills/c14-git-worktree/scripts/git-worktree-create.sh"
HOOK_SCRIPT="$REPO_ROOT/skills/c14-git-worktree/scripts/worktree.sh"

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

assert_eq() {
  local actual="$1"
  local expected="$2"
  local message="$3"
  if [ "$actual" != "$expected" ]; then
    fail "$message: expected '$expected', got '$actual'"
  fi
}

assert_file_exists() {
  local path="$1"
  local message="$2"
  [ -e "$path" ] || fail "$message: missing '$path'"
}

assert_file_contains() {
  local path="$1"
  local expected="$2"
  local message="$3"
  grep -Fqx "$expected" "$path" || fail "$message: '$expected' not found in '$path'"
}

create_temp_repo() {
  local root
  root="$(mktemp -d)"
  local repo="$root/demo"

  mkdir -p "$repo"
  cd "$repo"

  git init -q
  git config user.name "Test User"
  git config user.email "test@example.com"

  echo "hello" > README.md
  echo "TOKEN=demo" > .env
  git add README.md .env
  git commit -qm "init"

  echo "$repo"
}

test_direct_create() {
  [ -x "$CREATE_SCRIPT" ] || fail "create script is not executable: $CREATE_SCRIPT"

  local repo
  repo="$(create_temp_repo)"
  local expected_path
  expected_path="$(cd "$repo/.." && pwd)/demo-feature-a"

  local output
  output="$(cd "$repo" && "$CREATE_SCRIPT" feature-a)"

  assert_eq "$output" "$expected_path" "direct create returned path"
  assert_file_exists "$expected_path/.git" "direct create made worktree"
  assert_file_exists "$expected_path/.env" "direct create copied .env"
  assert_file_contains "$expected_path/.env" "TOKEN=demo" "direct create preserved .env content"

  local branch
  branch="$(cd "$expected_path" && git rev-parse --abbrev-ref HEAD)"
  assert_eq "$branch" "worktree-feature-a" "direct create checked out derived branch"
}

test_hook_create_and_reuse() {
  local repo
  repo="$(create_temp_repo)"
  local expected_path
  expected_path="$(cd "$repo/.." && pwd)/demo-feature-b"
  local hook_root
  hook_root="$(mktemp -d)"
  ln -s "$HOOK_SCRIPT" "$hook_root/worktree.sh"

  local payload
  payload="$(printf '{"hook_event_name":"WorktreeCreate","cwd":"%s","name":"feature-b"}' "$repo")"

  local first_output
  first_output="$(printf '%s' "$payload" | "$hook_root/worktree.sh")"
  assert_eq "$first_output" "$expected_path" "hook create returned path"
  assert_file_exists "$expected_path/.git" "hook create made worktree"

  local second_output
  second_output="$(printf '%s' "$payload" | "$hook_root/worktree.sh")"
  assert_eq "$second_output" "$expected_path" "hook reuse returned same path"
}

test_direct_create
test_hook_create_and_reuse

echo "PASS: git-worktree-create"
