---
name: c14-git-worktree
description: Git worktree 管理参考手册。当用户明确要求操作 worktree（创建、删除、查看）时触发。
---


## 工作原理（Claude Code 集成）

用户运行 `c -w`（即 `claude -w`）时的完整流程：

1. Claude Code 调用内置的 `EnterWorktree` 工具，传入一个 `name`
2. 触发 `WorktreeCreate` hook
3. Hook 固定执行 `~/.claude/hooks/worktree.sh`
4. `worktree.sh` 调用本技能目录下的 `scripts/git-worktree-create.sh`
5. 创建 worktree 到**当前 checkout 同级目录**：`../<current-checkout>-<name>/`，分支：`cxi/worktree/<name>`，base 为当前分支
6. 自动复制 `.env`（如存在）到新 worktree
7. Claude 的工作目录切换到新 worktree

**幂等性**：若目标目录或分支已存在，创建脚本会自动复用，不报错。

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
且 `~/.claude/hooks/worktree.sh` 存在且具有可执行权限。该 hook 负责解析 Claude 的 JSON payload，并调用本技能下的 `scripts/git-worktree-create.sh`。如果不存在，可以拷贝该目录下的 `scripts/worktree.sh` 到该位置。

更推荐创建 symlink 而不是拷贝，这样本技能更新后 hook 会自动跟随更新：
```bash
mkdir -p "$HOME/.claude/hooks"
ln -sf "<skill-base-dir>/scripts/worktree.sh" "$HOME/.claude/hooks/worktree.sh"
chmod +x "<skill-base-dir>/scripts/worktree.sh"
```

---

## 操作指引

### 创建 worktree

**通过 Claude Code（推荐，自动切换工作目录）：**

用户直接在终端运行：
```bash
c -w
```

若需要你（Claude）在当前会话中创建 worktree 并切换过去，使用 `EnterWorktree` 工具，传入一个简短的 `name`（如 `feat-login`）。选择 `name` 时用连字符分隔的短语，不含 `cxi/worktree/` 前缀（创建脚本会自动加）。

**直接调用脚本（不需要切换 Claude 工作目录时）：**
```bash
# 遵循命名约定：目录 ../<project>-<name>，分支 cxi/worktree/<name>
bash <skill-base-dir>/scripts/git-worktree-create.sh <name>

# 例：
bash <skill-base-dir>/scripts/git-worktree-create.sh feat-login
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

脚本逻辑：创建时会在 linked worktree 的 Git 管理目录记录 C14 创建的临时分支。删除时按传入路径在 `git worktree list --porcelain` 中反查真实登记项，再读取该元数据并调用 `git worktree remove`。即使用户后来切到业务分支，也只会强制清理原先登记的临时分支，绝不删除当前业务分支；分支名是否为 `cxi/worktree/*` 不影响删除。没有该元数据的旧 worktree（包括旧 `worktree-*` 分支）一律保留所有分支；不做兼容回退。

这个删除逻辑不从目录名推导分支名，也不关心 worktree 是从 primary checkout 还是某个 linked worktree 创建出来的。Git 视角下所有 linked worktree 都按同一个 repository 的平级登记项处理，所以类似 `figo-browser-parallel-work-debug-device-simulation` 这样的路径会依据创建元数据清理真实分支 `cxi/worktree/debug-device-simulation`，不会误推导成 `cxi/worktree/parallel-work-debug-device-simulation`。

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

### 同步提交 (Sync Commits，已弃用)

> **已弃用。** 自动推断 primary worktree、父分支与全部子分支不适合当前推荐工作流。请显式执行 `git merge <source-branch>` 或 `git rebase <base-branch>`。脚本仅为兼容已有流程保留，运行时会输出 `DEPRECATED` 提示。

在并行开发时，父分支和各 worktree 分支之间的提交往往需要同步。以下内容描述历史脚本的行为；新建的 `cxi/worktree/*` 分支不应依赖它自动同步。

**方向自动判断：**
- 当前 checkout 是 primary worktree → **DOWN**：将当前分支的新提交合并到所有已登记的 `worktree-*` linked worktree 分支
- 当前 checkout 是 linked worktree → **UP**：将当前 linked worktree 的提交合并到父分支

**特性：**
- 执行前先用 `git merge-tree --write-tree` 进行 dry-run 检测
- 有冲突的目标分支自动跳过，输出详细的手动解决步骤
- 发生冲突时，额外输出一段更短的英文 prompt，用户可整段复制给 coding agent；prompt 会优先建议在待处理的 worktree 分支里先 merge father
- 无冲突的目标分支正常执行 merge
- 方向判断基于 Git 的 worktree 元信息（`--git-dir` 与 `--git-common-dir`），不依赖当前分支是否以 `worktree-` 开头；因此 primary worktree 上的主分支即使误用 `worktree-*` 命名，也仍会走 DOWN。

**调用方式：**
```bash
bash <skill-base-dir>/scripts/git-worktree-sync.sh

# 如果父分支无法从 reflog 自动检测，可手动指定：
bash <skill-base-dir>/scripts/git-worktree-sync.sh --father main
```

**你（Claude）可以直接代为执行**，无需用户确认——除非有合并冲突（此时脚本只会跳过冲突项并打印解决步骤，不会修改任何文件）。

**冲突处理输出示例：**
```
❌ worktree-feat-auth: dry-run detected conflicts — skipped
   To resolve manually:
     cd ../yourproject-feat-auth
     git merge main
     git mergetool   # or open conflicted files in your editor
     git merge --continue
```

随后脚本还会追加一个带明确起止标记的英文文本块（`BEGIN/END CODING AGENT PROMPT`）。这段 prompt 会尽量短，同时保留 worktree 路径、当前待处理分支、father 分支、方向，以及建议先执行的 `git merge <father>` 命令。

**需求 git ≥ 2.38**（`merge-tree --write-tree` 支持）。脚本会在启动时检查版本，不满足时提示升级命令。

---

### 安装脚本为系统命令（创建 symlink）

以下是独立脚本，无需 agentic 上下文即可直接运行。可将它们 symlink 到 `~/.local/bin`，使其成为随时可用的系统命令。
- `git-worktree-create.sh`
- `git-worktree-sync.sh`
- `git-worktree-remove.sh`

**当用户要求安装或创建 symlink 时，直接执行并汇报结果：**

```bash
SKILL_SCRIPTS="<skill-base-dir>/scripts"
BIN_DIR="$HOME/.local/bin"
mkdir -p "$BIN_DIR"

for script in git-worktree-create.sh git-worktree-sync.sh git-worktree-remove.sh; do
  target="$BIN_DIR/c14-$script"
  if ln -sf "$SKILL_SCRIPTS/$script" "$target"; then
    echo "✅ symlink created: $target -> $SKILL_SCRIPTS/$script"
  else
    echo "❌ failed to create symlink for $script"
  fi
done
```

将 `<skill-base-dir>` 替换为技能加载时注入的实际路径（格式：`Base directory for this skill: <path>`）。

**安装后**，用户可直接运行（前提是 `~/.local/bin` 在 `$PATH` 中）：
```bash
c14-git-worktree-sync.sh
c14-git-worktree-remove.sh <worktree-path>
c14-git-worktree-create.sh <name>
```

**你（Claude）应代为执行**，并在完成后汇报：
- 每个 symlink 的创建结果（成功/失败）
- symlink 位置（完整路径）及其指向的源文件

---

## 最佳实践

- 用 `git worktree remove` 而非 `rm -rf`，前者会同步清理 git 内部跟踪。
- 目录已手动删除时，用 `git worktree prune` 清理悬空条目。
- 不要在 hook 里自动删除 worktree（会话中断会导致工作丢失）。
- 关联分支不会自动删除，使用脚本同时清理。
