# Git Worktree Create Script Design

## Goal

Extract the worktree creation workflow from `skills/c14-git-worktree/scripts/worktree.sh` into a standalone shell script that can be called directly by users and indirectly by the Claude hook.

## Current State

- `worktree.sh` contains the full creation logic.
- The skill documentation describes the creation workflow inline instead of pointing to a reusable CLI.
- Remove and sync flows already have standalone scripts in `skills/c14-git-worktree/scripts/`.

## Design

### New standalone script

Add `skills/c14-git-worktree/scripts/git-worktree-create.sh`.

Responsibilities:
- Accept a single required argument: `<name>`
- Derive the sibling worktree path as `../<project>-<name>`
- Derive the branch name as `worktree-<name>`
- Use the current branch as the base branch
- Reuse an existing worktree directory if it already exists
- Reuse an existing `worktree-<name>` branch if it already exists
- Copy `.env` into the new worktree if present
- Print only the resolved worktree path on stdout on success

### Hook adapter

Keep `skills/c14-git-worktree/scripts/worktree.sh` as the Claude hook entrypoint.

Responsibilities:
- Read the JSON payload from stdin
- Validate the hook event and extract `cwd` and `name`
- Preserve file logging
- Call `git-worktree-create.sh` from the provided `cwd`
- Forward the created worktree path to stdout

The hook remains the only Claude-facing entrypoint. The new create script is the shared implementation.

### Skill documentation changes

Update `skills/c14-git-worktree/SKILL.md` to:
- describe `worktree.sh` as the hook entrypoint
- document `git-worktree-create.sh` for direct CLI use
- reduce inline creation details that duplicate the script behavior
- keep the `c14-` prefix limited to the symlink-install section

## Testing

Add a shell regression test that:
- creates a temporary git repo
- verifies direct invocation of `git-worktree-create.sh`
- verifies hook invocation through `worktree.sh`
- checks branch naming, sibling path creation, `.env` copying, and idempotent reuse

## Scope Boundaries

- No change to remove or sync behavior
- No change to the existing hook contract in Claude
- No automatic installation of `c14-*` commands
