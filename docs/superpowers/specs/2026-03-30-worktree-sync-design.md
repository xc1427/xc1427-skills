# Design: Worktree Sync Capability for c14-git-worktree skill

**Date:** 2026-03-30
**Status:** Approved

## Overview

Add a `git-worktree-sync.sh` script to the `c14-git-worktree` skill that syncs commits between a "father" branch and its derived `worktree-*` branches using merge. Direction is auto-detected from the current branch. A dry-run check prevents any file changes when conflicts would occur.

## Background

The existing skill handles create/delete/list operations. The missing workflow is keeping worktree branches in sync with their origin (and vice versa). Without tooling, users must manually `cd` to each worktree and run git commands, which is error-prone and tedious.

## Scope

Two sync directions, one script:
- **DOWN**: father branch → all derived worktree branches (cascade a new commit to all open worktrees)
- **UP**: current worktree branch → father branch (promote a fix or utility from a worktree back to main)

## Technical Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Merge strategy | `git merge` | Preserves full history; safest for parallel long-lived branches |
| Dry-run mechanism | `git merge-tree --write-tree` | Simulates merge in memory, zero working-tree impact |
| Conflict handling | Skip and report | Don't abort others; report all failures at end with resolution steps |
| Father branch detection | Git reflog | `git log -g --pretty="%gs" refs/heads/<branch>` contains "Created from <father>" at branch creation; fallback to primary worktree's branch |
| Direction detection | Branch name pattern | `worktree-*` branch → UP; anything else → DOWN |

## Script: `scripts/git-worktree-sync.sh`

### Prerequisites check (startup)

- Must be inside a git repo; exit with clear message if not
- Must not be in detached HEAD state
- Verify `git merge-tree --write-tree` is available (git ≥ 2.38); print version guidance if not
- `jq` not required (pure bash + git)

### Status detection (always printed first)

```
📍 Current branch: main  (father branch)
🌿 Worktrees:
   • worktree-feat-auth  →  ../myproject-feat-auth
   • worktree-feat-ui    →  ../myproject-feat-ui
🔄 Direction: DOWN (father → all worktrees)
```

Detection logic:
1. `git worktree list --porcelain` → list all worktrees with paths and branches
2. Current branch = `git rev-parse --abbrev-ref HEAD`
3. If current branch matches `worktree-*` → direction UP; otherwise → direction DOWN
4. Father branch (for UP): `git log -g --pretty="%gs" refs/heads/<current-branch> | grep "^branch: Created from" | head -1 | sed 's/branch: Created from //'`; fallback = primary worktree's branch from `git worktree list --porcelain`

Edge cases:
- Not a git repo → `Error: not a git repository. Run from inside a repo.`
- Detached HEAD → `Error: HEAD is detached. Check out a branch first.`
- No worktrees found (DOWN) → `Warning: no worktree-* branches found. Nothing to sync.`
- Father branch not found (UP) → `Error: could not determine father branch from reflog. Set it manually with --father <branch>.`

The script accepts one optional flag: `--father <branch>` to explicitly override auto-detected father branch (useful when reflog is unavailable).

### Sync logic (two-phase per target)

**Phase 1 — dry-run (no file changes):**
```bash
git merge-tree --write-tree <destination> <source>
```
Captures conflicting file paths from output if exit code is non-zero.

**Phase 2 — actual merge (only if phase 1 succeeded):**
- DOWN: for each clean worktree, `cd` to its directory and run `git merge <father> --no-edit`
- UP: obtain primary worktree path from `git worktree list --porcelain` (first entry), `cd` there, and run `git merge <worktree-branch> --no-edit`

### Failure report format

```
❌ worktree-feat-auth: dry-run detected conflicts
   Conflicting files: src/auth.ts, src/config.ts
   To resolve manually:
     cd ../myproject-feat-auth
     git merge main
     git mergetool        # or resolve conflicts in editor
     git merge --continue
```

### Final summary

```
✅ Synced 2 worktrees successfully
❌ Skipped 1 worktree due to conflicts (see above)
```

## SKILL.md changes

Add new section `### 同步提交 (Sync Commits)` after `### 查看 worktree`:

- Explain auto-direction behavior
- Invoke: `bash <skill-base-dir>/scripts/git-worktree-sync.sh`
- Clarify Claude can run this directly on behalf of the user
- What to do when a worktree is skipped (follow the printed resolution steps)

## Test Setup

Location: `/Users/xichen.xc/Documents/.adhoc/test-worktree-sync/`

Structure (repo as subfolder, worktrees as siblings within parent):
```
test-worktree-sync/
├── repo/               ← git init here, branch: main
├── repo-feat-auth/     ← worktree, branch: worktree-feat-auth
└── repo-feat-ui/       ← worktree, branch: worktree-feat-ui
```

Test scenarios:
1. **Clean DOWN**: commit on `main` after worktrees created → sync-down → both worktrees receive commit
2. **Clean UP**: commit on `worktree-feat-auth` → sync-up → father receives commit
3. **Conflict DOWN**: introduce conflicting change on `worktree-feat-ui` → sync-down → feat-ui skipped with report, feat-auth succeeds
4. **No worktrees**: run sync-down on repo with no `worktree-*` branches → warning and exit

## Deliverables

- `skills/c14-git-worktree/scripts/git-worktree-sync.sh` (new)
- `skills/c14-git-worktree/SKILL.md` (updated)
- Test verified against `/Users/xichen.xc/Documents/.adhoc/test-worktree-sync/`
