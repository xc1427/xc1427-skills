---
name: cx1-community-regression-research
description: Use when the user asks to search GitHub, issue trackers, discussions, Reddit, Stack Overflow, Hacker News, forums, or other online communities to find whether a specific bug, regression, behavior, error, product issue, or rumor is reported elsewhere.
---

# cx1: Community Regression Research

Use this skill to answer prompts like:

```text
search the github or any potential useful or related online community to find out <argument>
```

The goal is to determine whether `<argument>` is already reported, discussed, acknowledged, worked around, or contradicted by public evidence.

## Scope

Prefer this skill for current, public-signal research about:

- bugs, regressions, crashes, compatibility breaks, flaky behavior, or error messages
- product changes that may have affected other users
- known issues, workarounds, maintainer replies, linked PRs, releases, and community sentiment
- exact diagnostic strings, binary names, stack traces, issue titles, or version numbers

Do not use it for private internal systems unless the user explicitly asks for internal sources too.

## Search Order

1. Start with exact strings from the user's argument:
   - error text
   - function or symbol names
   - binary/process names
   - package/plugin/version names
   - platform/version pairs
2. Search likely primary sources:
   - GitHub issues and discussions for the relevant org or repo
   - official forums, changelogs, release notes, status pages, or docs
   - package registry release notes when package versions matter
3. Widen to useful communities:
   - Reddit
   - Stack Overflow
   - Hacker News
   - vendor/community forums
   - blog posts or troubleshooting pages
4. Use local CLI sources when helpful:
   - `gh search issues`
   - `gh issue view`
   - `gh search prs`
   - `gh repo view`

When using `gh`, include the repo or org if it is known. Otherwise start broad, then narrow once likely repos appear.

## Evidence Standard

Classify findings explicitly:

- **Direct match**: same core symptom, same error string, same component, or same version/platform condition.
- **Close match**: same component and failure class, but different version, platform, or error.
- **Related background**: explains likely cause or workaround, but is not the same report.
- **No strong public report found**: searches did not surface a convincing match.

Prefer exact issue status over vague wording:

- open or closed
- created/updated dates
- labels
- maintainer acknowledgement, assignment, milestone, linked PR, or release
- user comments about workarounds

Do not claim a regression is acknowledged unless a maintainer, official label, linked PR, or official statement supports that.

## Reporting

Answer with the conclusion first:

```text
Yes, this appears reported upstream.
```

or:

```text
I found related reports, but not an exact public match.
```

Then give the evidence:

- link each source
- name the repo/community
- include exact dates when relevant
- quote only short snippets when needed
- distinguish direct evidence from inference
- state what you searched if no strong match was found

If the user is diagnosing their local machine, map the public evidence back to their local facts: component version, OS version, error text, plugin version, command output, or affected path.

## Useful Query Patterns

Use combinations like:

```text
"<exact error>" "<component>"
"<binary/process>" "Symbol not found"
site:github.com/<org>/<repo>/issues "<component>" "<platform>"
site:github.com/<org>/<repo>/discussions "<error>"
"<product>" "<version>" "<platform>" regression
"<component>" workaround downgrade autoupdate
```

For GitHub CLI:

```sh
gh search issues --repo OWNER/REPO '"exact string"' --limit 20 --json number,title,state,url,createdAt,updatedAt,labels
gh issue view NUMBER --repo OWNER/REPO --json number,title,state,createdAt,updatedAt,author,labels,comments,assignees,milestone,url
```
