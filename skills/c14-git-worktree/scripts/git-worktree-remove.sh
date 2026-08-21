#!/bin/bash
#
# 删除 git worktree 及其关联分支。
#
# 创建脚本会在 linked worktree 的 Git 管理目录中记录它创建的临时分支。
# 删除时读取该元数据；分支名不是 ownership 条件，元数据才是。
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
CREATED_BRANCH=""
METADATA_FILE=""
if [ -d "$MATCH_PATH" ]; then
  METADATA_FILE=$(git -C "$MATCH_PATH" rev-parse --git-path c14-created-branch 2>/dev/null || true)
  if [ -n "$METADATA_FILE" ] && [ -f "$METADATA_FILE" ]; then
    CREATED_BRANCH=$(head -n 1 "$METADATA_FILE")
    if ! git check-ref-format --branch "$CREATED_BRANCH" > /dev/null 2>&1; then
      echo "错误: C14 创建分支元数据无效，已停止删除:" >&2
      echo "  $METADATA_FILE" >&2
      exit 1
    fi
  fi
fi

echo "Worktree: $MATCH_PATH"
if [ -n "$BRANCH_NAME" ]; then
  echo "Branch:   $BRANCH_NAME"
else
  echo "Branch:   (detached HEAD)"
fi
if [ -n "$CREATED_BRANCH" ]; then
  echo "C14 created branch: $CREATED_BRANCH"
fi
echo ""

git worktree remove "$MATCH_PATH"
echo "✓ worktree 已删除"

if [ -z "$CREATED_BRANCH" ]; then
  echo "⏭  未找到 C14 创建分支元数据，保留所有分支"
elif git worktree list --porcelain | grep -F -q "branch refs/heads/$CREATED_BRANCH"; then
  echo "⏭  C14 创建分支 $CREATED_BRANCH 仍被其他 worktree 使用，已保留"
elif ! git show-ref --verify --quiet "refs/heads/$CREATED_BRANCH"; then
  echo "⏭  C14 创建分支 $CREATED_BRANCH 已不存在"
else
  # 元数据明确归属为创建时的 disposable 分支，删除 worktree 时一并强制清理。
  if git branch -D "$CREATED_BRANCH"; then
    echo "✓ C14 创建分支 $CREATED_BRANCH 已删除"
  else
    echo "⚠ C14 创建分支 $CREATED_BRANCH 不存在或删除失败"
  fi
fi
