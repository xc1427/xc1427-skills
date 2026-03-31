---
name: pr
description: >
  Use this skill when the user types "/pr", wants to create a pull request,
  or says something like "open a PR", "submit a PR", "push and create PR".
  Handles switching to the feature branch, staging and committing any
  uncommitted changes, pushing, and opening the PR against main — all with
  minimal user input.
---

You are running the `/pr` pull-request workflow. Follow these steps exactly.

## Step 1 — Gather context

Run the following commands in parallel to snapshot the repo state:

```bash
git branch --show-current          # current branch
git remote -v                      # remote URL (to detect GitHub vs internal)
git config user.name
git config user.email
git status --short                 # any uncommitted changes?
git log main..HEAD --oneline       # commits ahead of main
```

Store results as:
- CURRENT_BRANCH
- REMOTE_URL
- GIT_USER / GIT_EMAIL
- DIRTY (non-empty if `git status --short` has output)
- COMMITS_AHEAD (list of commits)

## Step 2 — Identity check (public GitHub only)

If REMOTE_URL contains `github.com` (not `code.alipay.com` or `gitlab.alibaba-inc.com`):
- If GIT_USER is **not** `xc1427`, STOP immediately. Tell the user:
  > "Git identity is set to `<GIT_USER>` / `<GIT_EMAIL>`. Please fix your git user profile before pushing to public GitHub, then retry /pr."
- Otherwise, proceed.

## Step 3 — Ensure we are on the feature branch

If CURRENT_BRANCH is `main` or `master`:
- Use AskUserQuestion to ask: "You are on `main`/`master`. Which feature branch should I switch to before creating the PR?"
- Switch to that branch: `git checkout <branch>`
- Re-run Step 1 to refresh CURRENT_BRANCH, DIRTY, COMMITS_AHEAD.

If CURRENT_BRANCH is already a feature branch, continue.

## Step 4 — Stage and commit uncommitted changes (if any)

If DIRTY is non-empty:
- Run `git diff --stat HEAD` to understand what changed.
- Infer a short commit message from the changed files and diff (keep it under 72 chars, imperative mood).
- Stage everything: `git add -A`
- Commit with the inferred message:
  ```bash
  git commit -m "<inferred message>"
  ```
- If the commit fails (e.g. pre-commit hook), report the error and stop.

## Step 5 — Push the branch

```bash
git push -u origin HEAD
```

If the push fails, report the error and stop.

## Step 6 — Create the pull request

Check whether `gh` is available:
```bash
gh --version 2>/dev/null && echo "GH_AVAILABLE"
```

**If `gh` is available:**

1. Gather the PR title from the last commit subject or the branch name (clean up dashes/underscores).
2. Build a brief body from COMMITS_AHEAD.
3. Run:
   ```bash
   gh pr create \
     --base main \
     --head <CURRENT_BRANCH> \
     --title "<inferred title>" \
     --body "<inferred body>"
   ```
4. Capture the PR URL from stdout.

**If `gh` is NOT available:**

Construct and print the GitHub "compare" URL for the user to open manually:

```
https://github.com/<owner>/<repo>/compare/main...<CURRENT_BRANCH>?expand=1
```

Derive `<owner>/<repo>` from REMOTE_URL.

## Step 7 — Report to the user

Summarise what was done:

1. Branch used
2. Whether any files were staged and committed (and the commit message if so)
3. PR URL (clickable link if possible)

Keep the summary concise — one short paragraph or a 3-bullet list.
