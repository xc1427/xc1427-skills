#!/bin/bash
#
# git-worktree-sync.sh
#
# Syncs commits between the "father" branch and worktree-* branches using merge.
# Direction is auto-detected from the current branch:
#   - On a worktree-* branch → sync UP to father
#   - On any other branch   → sync DOWN to all worktree-* branches
#
# A dry-run is performed first via `git merge-tree --write-tree`. Targets that
# would produce conflicts are skipped and reported; clean targets are merged.
#
# Usage:
#   bash git-worktree-sync.sh [--father <branch>]
#
# Options:
#   --father <branch>   Override auto-detected father branch (useful when
#                       reflog is unavailable or was pruned)

set -euo pipefail

# ─── Argument parsing ────────────────────────────────────────────────────────

FATHER_OVERRIDE=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --father)
      if [[ $# -lt 2 ]]; then
        echo "Error: --father requires a branch name argument." >&2
        exit 1
      fi
      FATHER_OVERRIDE="$2"
      shift 2
      ;;
    -h|--help)
      sed -n '3,15p' "$0" | sed 's/^# \?//'
      exit 0
      ;;
    *)
      echo "Error: unknown argument '$1'. Use --father <branch> or --help." >&2
      exit 1
      ;;
  esac
done

# ─── Prerequisites ────────────────────────────────────────────────────────────

if ! git rev-parse --git-dir > /dev/null 2>&1; then
  echo "Error: not a git repository. Run from inside a repo." >&2
  exit 1
fi

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
if [ "$CURRENT_BRANCH" = "HEAD" ]; then
  echo "Error: HEAD is detached. Check out a branch first." >&2
  exit 1
fi

# Require git >= 2.38 for `git merge-tree --write-tree`
GIT_VERSION=$(git --version | sed 's/git version //')
GIT_MAJOR=$(echo "$GIT_VERSION" | cut -d. -f1)
GIT_MINOR=$(echo "$GIT_VERSION" | cut -d. -f2)
if [ "$GIT_MAJOR" -lt 2 ] || { [ "$GIT_MAJOR" -eq 2 ] && [ "$GIT_MINOR" -lt 38 ]; }; then
  echo "Error: git >= 2.38 required for dry-run conflict detection." >&2
  echo "  Current version: $GIT_VERSION" >&2
  echo "  Upgrade: brew upgrade git  (macOS) | apt-get install git  (Debian/Ubuntu)" >&2
  exit 1
fi

# ─── Worktree parsing ─────────────────────────────────────────────────────────

# Parse `git worktree list --porcelain` into parallel arrays.
# Entries with detached HEAD (no `branch` line) are skipped.

WORKTREE_RAW=$(git worktree list --porcelain)

declare -a ALL_PATHS=()
declare -a ALL_BRANCHES=()

_cur_path=""
_cur_branch=""

while IFS= read -r _line; do
  if [[ "$_line" == worktree\ * ]]; then
    # Flush previous entry
    if [ -n "$_cur_path" ] && [ -n "$_cur_branch" ]; then
      ALL_PATHS+=("$_cur_path")
      ALL_BRANCHES+=("$_cur_branch")
    fi
    _cur_path="${_line#worktree }"
    _cur_branch=""
  elif [[ "$_line" == branch\ refs/heads/* ]]; then
    _cur_branch="${_line#branch refs/heads/}"
  fi
done <<< "$WORKTREE_RAW"
# Flush last entry
if [ -n "$_cur_path" ] && [ -n "$_cur_branch" ]; then
  ALL_PATHS+=("$_cur_path")
  ALL_BRANCHES+=("$_cur_branch")
fi

PRIMARY_PATH="${ALL_PATHS[0]:-}"
PRIMARY_BRANCH="${ALL_BRANCHES[0]:-}"

# Collect non-primary worktrees whose branches match worktree-*
declare -a DERIVED_PATHS=()
declare -a DERIVED_BRANCHES=()

for _i in "${!ALL_BRANCHES[@]}"; do
  [ "$_i" -eq 0 ] && continue
  _b="${ALL_BRANCHES[$_i]}"
  if [[ "$_b" == worktree-* ]]; then
    DERIVED_PATHS+=("${ALL_PATHS[$_i]}")
    DERIVED_BRANCHES+=("$_b")
  fi
done

# ─── Direction + father detection ─────────────────────────────────────────────

if [[ "$CURRENT_BRANCH" == worktree-* ]]; then
  DIRECTION="UP"
else
  DIRECTION="DOWN"
fi

if [ -n "$FATHER_OVERRIDE" ]; then
  FATHER_BRANCH="$FATHER_OVERRIDE"
elif [ "$DIRECTION" = "UP" ]; then
  # Read from reflog: "branch: Created from <father>"
  FATHER_BRANCH=$(git log -g --pretty="%gs" "refs/heads/$CURRENT_BRANCH" 2>/dev/null \
    | grep "^branch: Created from " \
    | head -1 \
    | sed 's/^branch: Created from //' || true)

  if [ -z "$FATHER_BRANCH" ]; then
    FATHER_BRANCH="$PRIMARY_BRANCH"
    echo "⚠  Reflog entry not found — falling back to primary worktree branch: $FATHER_BRANCH"
    echo "   (Override with: --father <branch>)"
    echo ""
  fi
else
  FATHER_BRANCH="$CURRENT_BRANCH"
fi

# ─── Status summary ───────────────────────────────────────────────────────────

echo ""
if [ "$DIRECTION" = "DOWN" ]; then
  echo "📍 Current branch: $CURRENT_BRANCH  (father branch)"
else
  echo "📍 Current branch: $CURRENT_BRANCH"
  echo "   Father branch:  $FATHER_BRANCH"
fi

echo "🌿 Worktrees:"
if [ "${#DERIVED_BRANCHES[@]}" -eq 0 ]; then
  echo "   (none with worktree-* branches)"
else
  for _i in "${!DERIVED_BRANCHES[@]}"; do
    echo "   • ${DERIVED_BRANCHES[$_i]}  →  ${DERIVED_PATHS[$_i]}"
  done
fi

if [ "$DIRECTION" = "DOWN" ]; then
  echo "🔄 Direction: DOWN (father → all worktrees)"
else
  echo "🔄 Direction: UP   (worktree → father)"
fi
echo ""

# ─── Sync ────────────────────────────────────────────────────────────────────

SYNCED=0
SKIPPED=0

_dry_run_ok() {
  # Returns 0 if merge of <source> into <dest> would be conflict-free.
  # Uses git merge-tree --write-tree; output is discarded.
  local dest="$1" src="$2"
  git merge-tree --write-tree "$dest" "$src" > /dev/null 2>&1
}

_do_merge() {
  # Runs actual merge inside <worktree_path>: merges <source_branch> into HEAD.
  local wt_path="$1" source_branch="$2"
  (cd "$wt_path" && git merge "$source_branch" --no-edit -q)
}

_failure_hint() {
  local target_branch="$1" target_path="$2" source_branch="$3"
  echo "  ❌ $target_branch: dry-run detected conflicts — skipped"
  echo "     To resolve manually:"
  echo "       cd $target_path"
  echo "       git merge $source_branch"
  echo "       git mergetool   # or open conflicted files in your editor"
  echo "       git merge --continue"
  echo ""
}

if [ "$DIRECTION" = "DOWN" ]; then
  if [ "${#DERIVED_BRANCHES[@]}" -eq 0 ]; then
    echo "Warning: no worktree-* branches found. Nothing to sync."
    exit 0
  fi

  for _i in "${!DERIVED_BRANCHES[@]}"; do
    _branch="${DERIVED_BRANCHES[$_i]}"
    _path="${DERIVED_PATHS[$_i]}"

    echo -n "  Checking $_branch ... "
    if _dry_run_ok "$_branch" "$FATHER_BRANCH"; then
      echo "clean"
      if _do_merge "$_path" "$FATHER_BRANCH"; then
        echo "  ✅ $_branch: merged successfully"
        SYNCED=$((SYNCED + 1))
      else
        echo "  ❌ $_branch: merge failed unexpectedly after clean dry-run"
        echo "     Run: cd $_path && git merge --abort"
        SKIPPED=$((SKIPPED + 1))
      fi
    else
      echo "conflicts"
      _failure_hint "$_branch" "$_path" "$FATHER_BRANCH"
      SKIPPED=$((SKIPPED + 1))
    fi
  done

elif [ "$DIRECTION" = "UP" ]; then
  if ! git show-ref --verify --quiet "refs/heads/$FATHER_BRANCH"; then
    echo "Error: father branch '$FATHER_BRANCH' does not exist." >&2
    echo "  Use --father <branch> to specify it manually." >&2
    exit 1
  fi

  echo -n "  Checking $FATHER_BRANCH ... "
  if _dry_run_ok "$FATHER_BRANCH" "$CURRENT_BRANCH"; then
    echo "clean"
    if _do_merge "$PRIMARY_PATH" "$CURRENT_BRANCH"; then
      echo "  ✅ $FATHER_BRANCH: merged successfully"
      SYNCED=$((SYNCED + 1))
    else
      echo "  ❌ $FATHER_BRANCH: merge failed unexpectedly after clean dry-run"
      echo "     Run: cd $PRIMARY_PATH && git merge --abort"
      SKIPPED=$((SKIPPED + 1))
    fi
  else
    echo "conflicts"
    _failure_hint "$FATHER_BRANCH" "$PRIMARY_PATH" "$CURRENT_BRANCH"
    SKIPPED=$((SKIPPED + 1))
  fi
fi

# ─── Summary ─────────────────────────────────────────────────────────────────

echo ""
if [ "$SYNCED" -gt 0 ] && [ "$SKIPPED" -eq 0 ]; then
  echo "✅ Synced $SYNCED branch(es) successfully"
elif [ "$SYNCED" -gt 0 ] && [ "$SKIPPED" -gt 0 ]; then
  echo "✅ Synced $SYNCED branch(es) successfully"
  echo "❌ Skipped $SKIPPED branch(es) due to conflicts (see above)"
elif [ "$SYNCED" -eq 0 ] && [ "$SKIPPED" -gt 0 ]; then
  echo "❌ All $SKIPPED branch(es) skipped due to conflicts (see above)"
else
  echo "Nothing was synced."
fi
