---
name: c14-git-worktree
description: Git worktree 管理参考手册。当用户明确要求操作 worktree（创建、删除、查看）时触发。
---


## 工作原理（Claude Code 集成）

用户运行 `c -w`（即 `claude -w`）时的完整流程：

1. Claude Code 调用内置的 `EnterWorktree` 工具，传入一个 `name`
2. 触发 `WorktreeCreate` hook
3. Hook 在**主仓库同级目录**创建 worktree：`../<project>-<name>/`，分支：`worktree-<name>`，base 为当前分支
4. Hook 自动复制 `.env`（如存在）到新 worktree
5. Claude 的工作目录切换到新 worktree

**幂等性**：若目标目录或分支已存在，hook 会自动复用，不报错。

`WorktreeRemove` hook 按照预期应该**不配置** — 会话退出时不会自动删除 worktree，需手动清理。

使用本技能依赖于用户已经在 ~/.claude/settings.json 中正确配置了如下 hooks。
```
"WorktreeCreate": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bash ~/.claude/hooks/worktree.sh",
            "timeout": 30
          }
        ]
      }
    ],
```
且 `~/.claude/hooks/worktree.sh` 存在且具有可执行权限。该 hook 负责创建 git worktree，并确保幂等性。如果不存在，可以拷贝该目录下的 `scripts/worktree.sh` 到该位置。

---

## 操作指引

### 创建 worktree

**通过 Claude Code（推荐，自动切换工作目录）：**

用户直接在终端运行：
```bash
c -w
```

若需要你（Claude）在当前会话中创建 worktree 并切换过去，使用 `EnterWorktree` 工具，传入一个简短的 `name`（如 `feat-login`）。选择 `name` 时用连字符分隔的短语，不含 `worktree-` 前缀（hook 会自动加）。

**手动 git 命令（不需要切换 Claude 工作目录时）：**
```bash
# 遵循命名约定：目录 ../<project>-<name>，分支 worktree-<name>
git worktree add -b worktree-<name> ../<project>-<name>

# 若分支已存在（复用）：
git worktree add ../<project>-<name> worktree-<name>
```

除非用户明确要求，否则只提示命令，不代替执行。

---

### 删除 worktree

**推荐：使用 skill 自带脚本**（同时删除 worktree 和关联分支）

脚本位置：技能加载时系统会注入 `Base directory for this skill: <path>`，脚本在该目录下的 `scripts/git-worktree-remove.sh`。

```bash
bash <skill-base-dir>/scripts/git-worktree-remove.sh <worktree-path>

# 例：
bash <skill-base-dir>/scripts/git-worktree-remove.sh ../myproject-feat-x
```

脚本逻辑：从目录名 `<project>-<name>` 推导出分支名 `worktree-<name>`，调用 `git worktree remove` 后再 `git branch -D`。

**你可以直接代为执行**删除操作，无需用户确认（除非 worktree 有未提交的改动）。

**手动（只删 worktree，不删分支）：**
```bash
git worktree remove <path>
git worktree prune   # 手动 rm -rf 后清理残留条目
```

---

### 查看 worktree

```bash
git worktree list
```

---

## 最佳实践

- 用 `git worktree remove` 而非 `rm -rf`，前者会同步清理 git 内部跟踪。
- 目录已手动删除时，用 `git worktree prune` 清理悬空条目。
- 不要在 hook 里自动删除 worktree（会话中断会导致工作丢失）。
- 关联分支不会自动删除，使用脚本同时清理。
