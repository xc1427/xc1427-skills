#!/bin/bash
#
# git-worktree-sync.sh
#
# Checks whether the current linked-worktree branch can merge into an explicit
# target branch. It only runs `git merge-tree --write-tree`; it never merges.
#
# Usage:
#   bash git-worktree-sync.sh [--father <branch>]
#
# Options:
#   --father <branch>   Optional explicit target branch; defaults to primary's current branch.

set -euo pipefail

echo "⚠ DEPRECATED: c14-git-worktree-sync.sh 只保留兼容性的合并检查。"
echo "  请改用显式 git merge <source-branch> 或 git rebase <base-branch>。"
echo "  此脚本只检查 linked worktree → --father 的合并，仅运行 dry-run，不会执行 git merge。"
echo ""

# ─── Argument parsing ────────────────────────────────────────────────────────

FATHER_BRANCH=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --father)
      if [[ $# -lt 2 ]]; then
        echo "Error: --father requires a branch name argument." >&2
        exit 1
      fi
      FATHER_BRANCH="$2"
      shift 2
      ;;
    -h|--help)
      sed -n '3,/^$/p' "$0" | sed 's/^# *//'
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
CURRENT_WORKTREE_PATH=$(git rev-parse --show-toplevel)

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

GIT_DIR_ABS=$(git rev-parse --path-format=absolute --git-dir)
COMMON_DIR_ABS=$(git rev-parse --path-format=absolute --git-common-dir)
if [ "$GIT_DIR_ABS" = "$COMMON_DIR_ABS" ]; then
  CURRENT_WORKTREE_KIND="primary"
else
  CURRENT_WORKTREE_KIND="linked"
fi

# ─── UP dry-run target ────────────────────────────────────────────────────────

if [ "$CURRENT_WORKTREE_KIND" = "primary" ]; then
  echo "Error: this command only supports a linked worktree; DOWN sync was removed." >&2
  exit 1
fi

PRIMARY_PATH=""
while IFS= read -r _line; do
  if [[ "$_line" == worktree\ * ]]; then
    PRIMARY_PATH="${_line#worktree }"
    break
  fi
done < <(git worktree list --porcelain)

if [ -z "$PRIMARY_PATH" ]; then
  echo "Error: could not locate the primary worktree." >&2
  exit 1
fi

PRIMARY_CURRENT_BRANCH=$(git -C "$PRIMARY_PATH" symbolic-ref --quiet --short HEAD) || {
  echo "Error: primary worktree has a detached HEAD; sync cannot verify a merge target." >&2
  exit 1
}

TARGET_SOURCE="--father"
if [ -z "$FATHER_BRANCH" ]; then
  FATHER_BRANCH="$PRIMARY_CURRENT_BRANCH"
  TARGET_SOURCE="primary worktree current branch"
fi

_dry_run_ok() {
  # Returns 0 if merge of <source> into <dest> would be conflict-free.
  # Uses git merge-tree --write-tree; output is discarded.
  local dest="$1" src="$2"
  git merge-tree --write-tree "$dest" "$src" > /dev/null 2>&1
}

_failure_hint() {
  echo "  ❌ $FATHER_BRANCH: dry-run detected conflicts"
  echo "     To resolve manually:"
  echo "       cd \"$CURRENT_WORKTREE_PATH\""
  echo "       git merge $FATHER_BRANCH"
  echo "       git mergetool   # or open conflicted files in your editor"
  echo "       git merge --continue"
  echo "       # Rerun this dry-run, then merge manually after review."
  echo ""
  _agent_prompt
}

_agent_prompt() {
  echo "🤖 Copy this to your coding agent:"
  echo "----- BEGIN CODING AGENT PROMPT -----"
  echo "Resolve this git worktree sync conflict for me."
  echo "Worktree: ${CURRENT_WORKTREE_PATH}"
  echo "Current branch: ${CURRENT_BRANCH}"
  echo "Father branch: ${FATHER_BRANCH}"
  echo "This command was a dry-run and did not merge anything."
  echo "Start with: cd \"${CURRENT_WORKTREE_PATH}\" && git merge ${FATHER_BRANCH}"
  echo "Resolve the conflict, rerun the dry-run, then manually merge only after review."
  echo "----- END CODING AGENT PROMPT -----"
  echo ""
}

if ! git show-ref --verify --quiet "refs/heads/$FATHER_BRANCH"; then
  echo "Error: father branch '$FATHER_BRANCH' does not exist." >&2
  exit 1
fi

if [ "$PRIMARY_CURRENT_BRANCH" != "$FATHER_BRANCH" ]; then
  echo "Error: primary worktree is on '$PRIMARY_CURRENT_BRANCH', but dry-run target is '$FATHER_BRANCH'." >&2
  echo "  Check out $FATHER_BRANCH in the primary worktree, or rerun with --father $PRIMARY_CURRENT_BRANCH." >&2
  exit 1
fi

echo ""
echo "📍 Source branch: $CURRENT_BRANCH"
echo "   Target branch: $FATHER_BRANCH ($TARGET_SOURCE)"
echo -n "🔍 Dry-run $CURRENT_BRANCH → $FATHER_BRANCH ... "
if _dry_run_ok "$FATHER_BRANCH" "$CURRENT_BRANCH"; then
  echo "clean"
  echo "✓ Dry-run clean. No merge was performed."
else
  echo "conflicts"
  _failure_hint
fi
