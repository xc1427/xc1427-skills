Run the pull-request workflow for this repo. Follow these steps exactly.

## Step 1 — Gather context

Run in parallel:

```bash
git branch --show-current
git remote -v
git config user.name
git config user.email
git status --short
git log main..HEAD --oneline
```

Store as: CURRENT_BRANCH, REMOTE_URL, GIT_USER, GIT_EMAIL, DIRTY, COMMITS_AHEAD.

## Step 2 — Identity check

If REMOTE_URL contains `github.com`:
- If GIT_USER is **not** `xc1427`, STOP and say:
  > "Git identity is `<GIT_USER>` / `<GIT_EMAIL>`. Please fix before pushing to public GitHub."

## Step 3 — Ensure we are on a feature branch

If CURRENT_BRANCH is `main` or `master`, ask the user which feature branch to switch to, then run `git checkout <branch>` and refresh state.

## Step 4 — Stage and commit uncommitted changes (if any)

If DIRTY is non-empty:
- Run `git diff --stat HEAD` to understand what changed.
- Infer a concise commit message (imperative mood, ≤72 chars).
- `git add -A && git commit -m "<inferred message>"`
- If the commit fails, report the error and stop.

## Step 5 — Push

```bash
git push -u origin HEAD
```

If push fails, report the error and stop.

## Step 6 — Create or locate the PR via gh

First check if a PR already exists for this branch:

```bash
gh pr view --json url,state -q '"\(.state) \(.url)"'
```

- If state is `MERGED`: the work is already done. Skip to Step 7 with the existing PR URL.
- If state is `OPEN`: a PR is already open. Skip to Step 7 with the existing PR URL.
- If the command errors (no PR found): create one:

```bash
gh pr create \
  --base main \
  --head <CURRENT_BRANCH> \
  --title "<inferred from last commit subject or branch name>" \
  --body "<bullet list built from COMMITS_AHEAD>"
```

Capture the PR URL from stdout.

If `gh` is unavailable, print the compare URL instead:
`https://github.com/<owner>/<repo>/compare/main...<CURRENT_BRANCH>?expand=1`

## Step 7 — Open the PR and report

On success, open the PR URL in the default browser:
```bash
open "<PR_URL>"
```

Then summarise in ≤3 bullets:
- Branch used
- Commit made (message), if any
- PR URL (clickable)
