# Git Worktree Create Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a standalone `git-worktree-create.sh`, make `worktree.sh` delegate to it, and simplify the skill documentation around creation.

**Architecture:** The standalone create script becomes the source of truth for worktree creation behavior. The Claude hook remains `worktree.sh`, which only parses hook input, logs, and delegates into the shared script. The skill documentation points to the scripts instead of embedding the workflow inline.

**Tech Stack:** Bash, git, jq, markdown

---

### Task 1: Add failing regression test

**Files:**
- Create: `tests/c14-git-worktree/git-worktree-create-test.sh`

- [ ] **Step 1: Write the failing test**

```bash
#!/bin/bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CREATE_SCRIPT="$REPO_ROOT/skills/c14-git-worktree/scripts/git-worktree-create.sh"
HOOK_SCRIPT="$REPO_ROOT/skills/c14-git-worktree/scripts/worktree.sh"

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

assert_eq() {
  local actual="$1"
  local expected="$2"
  local message="$3"
  if [ "$actual" != "$expected" ]; then
    fail "$message: expected '$expected', got '$actual'"
  fi
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bash tests/c14-git-worktree/git-worktree-create-test.sh`
Expected: FAIL because `skills/c14-git-worktree/scripts/git-worktree-create.sh` does not exist yet

### Task 2: Implement standalone create flow and hook delegation

**Files:**
- Create: `skills/c14-git-worktree/scripts/git-worktree-create.sh`
- Modify: `skills/c14-git-worktree/scripts/worktree.sh`

- [ ] **Step 1: Write minimal implementation**

Create `git-worktree-create.sh` to:
- accept `<name>`
- derive `../<project>-<name>` and `worktree-<name>`
- use the current branch as base
- reuse existing worktrees and branches
- copy `.env`
- print only the resulting path

Update `worktree.sh` to:
- parse hook JSON
- preserve logging
- invoke the new script from the hook `cwd`
- print only the delegated result

- [ ] **Step 2: Run test to verify it passes**

Run: `bash tests/c14-git-worktree/git-worktree-create-test.sh`
Expected: PASS

### Task 3: Simplify skill documentation

**Files:**
- Modify: `skills/c14-git-worktree/SKILL.md`
- Modify: `README.md`

- [ ] **Step 1: Update docs**

Document:
- `worktree.sh` stays the Claude hook entrypoint
- `git-worktree-create.sh` is the direct CLI for manual creation
- symlink-installed commands keep the `c14-` prefix only at install time

- [ ] **Step 2: Re-run verification**

Run: `bash tests/c14-git-worktree/git-worktree-create-test.sh`
Expected: PASS
