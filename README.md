# xc1427-skills

Personal agent skills for Codex and Claude Code, installable with [`npx skills`](https://github.com/vercel-labs/skills).

## Skills

Each skill lives in `skills/<skill-name>/`. Its `SKILL.md` is the entry point and lists any tools or setup it needs. Some skill folders also include scripts and references.

| Skill | What it does | Invocation |
|---|---|---|
| [cx1-afk](skills/cx1-afk/SKILL.md) | Keep working during an AFK window and notify the user via DingTalk when their intervention is needed. | Explicit only |
| [cx1-asd-ste100](skills/cx1-asd-ste100/SKILL.md) | Write or revise technical prose using selected ASD-STE100 principles for the current turn. | Explicit only |
| [cx1-ask-claude](skills/cx1-ask-claude/SKILL.md) | Ask the local Claude Code CLI to perform a task or give a second opinion. | Explicit only |
| [cx1-bear-notes](skills/cx1-bear-notes/SKILL.md) | Search, read, and manage Bear notes using Bear Notes MCP. | Automatic |
| [cx1-brainstorm](skills/cx1-brainstorm/SKILL.md) | Clarify goals, compare options, and settle design decisions before implementation. | On request |
| [cx1-chatgpt-guarded](skills/cx1-chatgpt-guarded/SKILL.md) | Build, install, verify, and maintain the ChatGPT Guarded launcher for macOS. | Automatic |
| [cx1-community-regression-research](skills/cx1-community-regression-research/SKILL.md) | Search issue trackers and online communities for reports of a bug or regression. | Automatic |
| [cx1-git-worktree](skills/cx1-git-worktree/SKILL.md) | Create and remove worktrees managed by this skill, sync commits across them, and install standalone scripts. | Explicit only |
| [cx1-man-tongue](skills/cx1-man-tongue/SKILL.md) | Draft or revise concise, natural Chinese prose for the current turn. | Explicit only |
| [cx1-scripts](skills/cx1-scripts/SKILL.md) | Discover, run, and author personal `cx1-*` scripts in `~/.local/bin`. | Automatic |
| [cx1-sub-sol62](skills/cx1-sub-sol62/SKILL.md) | Delegate the assigned task to a GPT-6.2 Sol subagent. | Explicit only |
| [cx1-sub-terra61](skills/cx1-sub-terra61/SKILL.md) | Delegate the assigned task to a GPT-6.1 Terra subagent. | Explicit only |
| [cx1-tibo-post](skills/cx1-tibo-post/SKILL.md) | Summarize substantive X posts by Tibo Sottiaux from today and the two preceding days. | Automatic |
| [cx1-to-recipe](skills/cx1-to-recipe/SKILL.md) | Group cooking diary photos by dish and preview or write recipe records to a Yuque data table. | Automatic |
| [cx1-yuque](skills/cx1-yuque/SKILL.md) | Work with Yuque documents, attachments, spreadsheets, and data tables through a standalone CLI with session checks and write verification. | Automatic |

## Install

List available skills with the [Skills CLI](https://github.com/vercel-labs/skills/blob/main/docs/commands.md):

```bash
npx --yes skills add xc1427/xc1427-skills --list
```

Install selected skills globally for Codex and Claude Code. For example, install the recipe workflow and its Yuque integration:

```bash
npx --yes skills add xc1427/xc1427-skills -g --agent codex claude-code --skill cx1-to-recipe cx1-yuque --yes
```

If you maintain a local checkout, run the link scripts from the repository root to use that checkout as the source:

```bash
./scripts/link-agent-skills.sh
./scripts/link-claude-skills.sh
```

The first script links `~/.agents/skills/cx1` to the checkout’s `skills/` directory. The second creates one link per skill under `~/.claude/skills/`.
