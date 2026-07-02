#!/bin/bash
#
# 删除 git worktree 及其关联分支。
#
# 分支名直接从 `git worktree list --porcelain` 的登记项读取，不从目录名推导。
# 这样从 linked worktree 继续创建出来的 sibling worktree 也能删到真实分支。
#
# 用法:
#   git-worktree-remove.sh <worktree-path>
#   git-worktree-remove.sh ../myproject-feat-x

set -euo pipefail

if [ $# -ne 1 ]; then
  echo "用法: $0 <worktree-path>" >&2
  exit 1
fi

if ! git rev-parse --git-dir > /dev/null 2>&1; then
  echo "错误: 当前目录不是 git 仓库。请在同一个 repository 的任意 worktree 内运行。" >&2
  exit 1
fi

expand_user_path() {
  case "$1" in
    "~")
      printf '%s\n' "$HOME"
      ;;
    "~/"*)
      printf '%s/%s\n' "$HOME" "${1#"~/"}"
      ;;
    *)
      printf '%s\n' "$1"
      ;;
  esac
}

canonicalize_path() {
  local path="$1"
  local dir base

  if [ -d "$path" ]; then
    (cd "$path" && pwd -P)
    return
  fi

  dir=$(dirname "$path")
  base=$(basename "$path")

  if [ -d "$dir" ]; then
    printf '%s/%s\n' "$(cd "$dir" && pwd -P)" "$base"
  elif [[ "$path" = /* ]]; then
    printf '%s\n' "$path"
  else
    printf '%s/%s\n' "$(pwd -P)" "$path"
  fi
}

INPUT_PATH=$(expand_user_path "$1")
TARGET_ABS=$(canonicalize_path "$INPUT_PATH")

WORKTREE_RAW=$(git worktree list --porcelain)

MATCH_PATH=""
MATCH_BRANCH=""
MATCH_INDEX=""
ENTRY_INDEX=-1
_cur_path=""
_cur_branch=""

flush_entry() {
  [ -n "$_cur_path" ] || return 0

  local cur_abs
  cur_abs=$(canonicalize_path "$_cur_path")

  if [ "$_cur_path" = "$INPUT_PATH" ] || [ "$_cur_path" = "$TARGET_ABS" ] || [ "$cur_abs" = "$TARGET_ABS" ]; then
    MATCH_PATH="$_cur_path"
    MATCH_BRANCH="$_cur_branch"
    MATCH_INDEX="$ENTRY_INDEX"
  fi
}

while IFS= read -r _line; do
  if [[ "$_line" == worktree\ * ]]; then
    flush_entry
    ENTRY_INDEX=$((ENTRY_INDEX + 1))
    _cur_path="${_line#worktree }"
    _cur_branch=""
  elif [[ "$_line" == branch\ refs/heads/* ]]; then
    _cur_branch="${_line#branch refs/heads/}"
  fi
done <<< "$WORKTREE_RAW"
flush_entry

if [ -z "$MATCH_PATH" ]; then
  echo "错误: 未在 git worktree 登记表中找到目标路径:" >&2
  echo "  $INPUT_PATH" >&2
  echo "" >&2
  echo "当前登记的 worktree:" >&2
  git worktree list >&2
  exit 1
fi

if [ "$MATCH_INDEX" = "0" ]; then
  echo "错误: 目标路径是 primary worktree，不能用此脚本删除:" >&2
  echo "  $MATCH_PATH" >&2
  exit 1
fi

if [ -d "$MATCH_PATH" ]; then
  STATUS=$(git -C "$MATCH_PATH" status --porcelain)
  if [ -n "$STATUS" ]; then
    echo "错误: 目标 worktree 有未提交改动，已停止删除:" >&2
    echo "  $MATCH_PATH" >&2
    echo "" >&2
    echo "$STATUS" >&2
    exit 1
  fi
fi

BRANCH_NAME="$MATCH_BRANCH"

echo "Worktree: $MATCH_PATH"
if [ -n "$BRANCH_NAME" ]; then
  echo "Branch:   $BRANCH_NAME"
else
  echo "Branch:   (detached HEAD)"
fi
echo ""

git worktree remove "$MATCH_PATH"
echo "✓ worktree 已删除"

if [ -z "$BRANCH_NAME" ]; then
  echo "⏭  detached worktree 无关联本地分支需要删除"
elif [[ "$BRANCH_NAME" != worktree-* ]]; then
  echo "⏭  保留非 c14 worktree 分支 $BRANCH_NAME"
elif git worktree list --porcelain | grep -F -q "branch refs/heads/$BRANCH_NAME"; then
  echo "⏭  分支 $BRANCH_NAME 仍被其他 worktree 使用，已保留"
else
  git branch -D "$BRANCH_NAME" 2>/dev/null && echo "✓ 分支 $BRANCH_NAME 已删除" \
    || echo "⚠ 分支 $BRANCH_NAME 不存在或删除失败"
fi
