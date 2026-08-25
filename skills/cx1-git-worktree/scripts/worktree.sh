#!/bin/bash
#
# Claude Code passes a JSON payload via stdin:
#
# WorktreeCreate:
#   { "hook_event_name": "WorktreeCreate", "cwd": "/Users/.../project", "name": "my-feature" }

# ref: https://www.sabatino.dev/creating-worktrees-with-claude-code-in-a-custom-directory/

set -euo pipefail

INPUT="$(cat)"

if ! command -v jq &>/dev/null; then
  echo "jq is required but not installed" >&2
  exit 1
fi

HOOK_EVENT="$(echo "$INPUT" | jq -r '.hook_event_name')"
CWD="$(echo "$INPUT" | jq -r '.cwd')"
NAME="$(echo "$INPUT" | jq -r '.name')"

SCRIPT_SOURCE="${BASH_SOURCE[0]}"
while [ -L "$SCRIPT_SOURCE" ]; do
  SCRIPT_SOURCE_DIR="$(cd -P "$(dirname "$SCRIPT_SOURCE")" && pwd)"
  SCRIPT_TARGET="$(readlink "$SCRIPT_SOURCE")"
  if [[ "$SCRIPT_TARGET" = /* ]]; then
    SCRIPT_SOURCE="$SCRIPT_TARGET"
  else
    SCRIPT_SOURCE="$SCRIPT_SOURCE_DIR/$SCRIPT_TARGET"
  fi
done

SCRIPT_DIR="$(cd -P "$(dirname "$SCRIPT_SOURCE")" && pwd)"
CREATE_SCRIPT="$SCRIPT_DIR/git-worktree-create.sh"
LOG_DIR="$SCRIPT_DIR/../logs"
LOG_FILE="$LOG_DIR/worktree.log"
mkdir -p "$LOG_DIR"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$HOOK_EVENT] $*" >> "$LOG_FILE"
}

worktree_create() {
  log "delegating create: cwd=$CWD name=$NAME"

  local worktree_path
  if ! worktree_path="$(
    cd "$CWD" &&
      WORKTREE_CREATE_LOG_FILE="$LOG_FILE" "$CREATE_SCRIPT" "$NAME"
  )"; then
    log "create failed for name=$NAME"
    echo "Failed to create worktree: $NAME" >&2
    exit 1
  fi

  log "created worktree at $worktree_path"
  echo "$worktree_path"
}

case "$HOOK_EVENT" in
  WorktreeCreate) worktree_create ;;
  *)
    log "no action for event=$HOOK_EVENT"
    ;;
esac
