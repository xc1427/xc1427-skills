#!/bin/bash

set -euo pipefail

log() {
  if [ -n "${WORKTREE_CREATE_LOG_FILE:-}" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [git-worktree-create] $*" >> "$WORKTREE_CREATE_LOG_FILE"
  fi
}

if [ $# -ne 1 ]; then
  echo "Usage: $0 <name>" >&2
  exit 1
fi

NAME="$1"

if ! git rev-parse --git-dir > /dev/null 2>&1; then
  echo "Error: not a git repository. Run from inside the main repo." >&2
  exit 1
fi

PROJECT_ROOT="$(pwd)"
PROJECT_NAME="$(basename "$PROJECT_ROOT")"
PARENT_DIR="$(cd "$PROJECT_ROOT/.." && pwd)"
WORKTREE_DIR="$PARENT_DIR/$PROJECT_NAME-$NAME"
BRANCH_NAME="worktree-$NAME"
BASE_BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null)"
: "${BASE_BRANCH:=master}"

log "name=$NAME"
log "path=$WORKTREE_DIR"
log "branch=$BRANCH_NAME"
log "base=$BASE_BRANCH"

if [ -d "$WORKTREE_DIR" ]; then
  log "reusing existing worktree at $WORKTREE_DIR"
  echo "$WORKTREE_DIR"
  exit 0
fi

if git show-ref --verify --quiet "refs/heads/$BRANCH_NAME" 2>/dev/null; then
  log "reusing existing branch $BRANCH_NAME"
  git worktree add "$WORKTREE_DIR" "$BRANCH_NAME" >&2
else
  git worktree add -b "$BRANCH_NAME" "$WORKTREE_DIR" "$BASE_BRANCH" >&2
fi

if [ -f "$PROJECT_ROOT/.env" ]; then
  cp "$PROJECT_ROOT/.env" "$WORKTREE_DIR/.env"
  log "copied .env"
else
  log "no .env to copy"
fi

echo "$WORKTREE_DIR"
