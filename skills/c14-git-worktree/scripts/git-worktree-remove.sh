#!/bin/bash
#
# 删除 git worktree 及其关联分支。
#
# 命名约定 (来自 ~/.claude/hooks/worktree.sh):
#   目录: ../<project>-<name>
#   分支: worktree-<name>
#
# 用法:
#   git-worktree-remove.sh <worktree-path>
#   git-worktree-remove.sh ../myproject-feat-x

set -euo pipefail

if [ $# -ne 1 ]; then
  echo "用法: $0 <worktree-path>" >&2
  exit 1
fi

WORKTREE_PATH="$1"

# 获取主仓库项目名
MAIN_REPO=$(git worktree list --porcelain | head -1 | sed 's/^worktree //')
PROJECT_NAME=$(basename "$MAIN_REPO")

# 从 worktree 目录名推导 <name>，再得到分支名
WORKTREE_BASENAME=$(basename "$WORKTREE_PATH")
NAME="${WORKTREE_BASENAME#"$PROJECT_NAME"-}"

if [ "$NAME" = "$WORKTREE_BASENAME" ]; then
  echo "警告: worktree 目录名 '$WORKTREE_BASENAME' 不符合 '<project>-<name>' 命名规则，无法推导分支名" >&2
  echo "将只删除 worktree，不删除分支" >&2
  git worktree remove "$WORKTREE_PATH"
  exit 0
fi

BRANCH_NAME="worktree-$NAME"

echo "Worktree: $WORKTREE_PATH"
echo "Branch:   $BRANCH_NAME"
echo ""

git worktree remove "$WORKTREE_PATH"
echo "✓ worktree 已删除"

git branch -D "$BRANCH_NAME" 2>/dev/null && echo "✓ 分支 $BRANCH_NAME 已删除" \
  || echo "⚠ 分支 $BRANCH_NAME 不存在或删除失败"
