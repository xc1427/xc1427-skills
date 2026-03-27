#!/bin/bash
#
# Claude Code passes a JSON payload via stdin:
#
# WorktreeCreate:
#   { "hook_event_name": "WorktreeCreate", "cwd": "/Users/.../project", "name": "my-feature" }

# ref: https://www.sabatino.dev/creating-worktrees-with-claude-code-in-a-custom-directory/

INPUT=$(cat)

if ! command -v jq &>/dev/null; then
  echo "jq is required but not installed" >&2
  exit 1
fi

HOOK_EVENT=$(echo "$INPUT" | jq -r '.hook_event_name')
CWD=$(echo "$INPUT" | jq -r '.cwd')

# Logging
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$SCRIPT_DIR/../logs"
LOG_FILE="$LOG_DIR/worktree.log"
mkdir -p "$LOG_DIR"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$HOOK_EVENT] $*" >> "$LOG_FILE"
}
# Create a git worktree at ../{project}-{name} branching off the current branch.
# Outputs the worktree path to stdout (Claude Code reads this to set the working directory).
worktree_create() {
  local NAME
  NAME=$(echo "$INPUT" | jq -r '.name')

  local PROJECT_NAME PARENT_DIR WORKTREE_DIR BRANCH_NAME
  PROJECT_NAME=$(basename "$CWD")
  PARENT_DIR=$(cd "$CWD/.." && pwd)
  WORKTREE_DIR="$PARENT_DIR/$PROJECT_NAME-$NAME"
  BRANCH_NAME="worktree-$NAME"

  log "Creating worktree: name=$NAME project=$PROJECT_NAME"
  log "  path=$WORKTREE_DIR branch=$BRANCH_NAME"

  # Use current branch as base
  local BASE_BRANCH
  BASE_BRANCH=$(cd "$CWD" && git rev-parse --abbrev-ref HEAD 2>/dev/null)
  : "${BASE_BRANCH:=master}"
  log "  base=$BASE_BRANCH"

  # Reuse existing worktree if it already exists (e.g. second subtask in same session)
  if [ -d "$WORKTREE_DIR" ]; then
    log "Worktree already exists at $WORKTREE_DIR, reusing"
    echo "$WORKTREE_DIR"
    exit 0
  fi

  # Create git worktree in sibling directory
  cd "$CWD" || exit 1

  # If the branch already exists (leftover from a previous run), reuse it
  # instead of creating with -b (which fails on existing branches)
  if git show-ref --verify --quiet "refs/heads/$BRANCH_NAME" 2>/dev/null; then
    log "Branch $BRANCH_NAME already exists, reusing"
    git worktree add "$WORKTREE_DIR" "$BRANCH_NAME" >&2 || {
      log "FAILED to create worktree: $NAME"
      echo "Failed to create worktree: $NAME" >&2
      exit 1
    }
  else
    git worktree add -b "$BRANCH_NAME" "$WORKTREE_DIR" "$BASE_BRANCH" >&2 || {
      log "FAILED to create worktree: $NAME"
      echo "Failed to create worktree: $NAME" >&2
      exit 1
    }
  fi

  # Copy .env to the new worktree (hard copy, no symlink)
  if [ -f "$CWD/.env" ]; then
    cp "$CWD/.env" "$WORKTREE_DIR/.env"
    log "Copied .env to worktree"
  else
    log "No .env found in $CWD, skipping copy"
  fi

  log "Created worktree successfully at $WORKTREE_DIR"

  # Output the worktree path (the ONLY stdout Claude Code reads)
  echo "$WORKTREE_DIR"
}

noop() {
  log "No action for event: $HOOK_EVENT"
}

# Parse hook events
case "$HOOK_EVENT" in
  WorktreeCreate) worktree_create ;;
  # WorktreeRemove) noop ;;
esac