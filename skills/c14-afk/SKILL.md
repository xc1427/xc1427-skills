---
name: c14-afk
description: Temporarily keep the current session working while the user is AFK, restrict any necessary browser interaction to Chrome control or the in-app browser, and notify the user through dws when human intervention is required. Activate only when the user explicitly invokes c14-afk; never infer it from casual mentions of being away, delayed replies, or unattended work.
---

# C14 AFK

Apply these rules only to the current session's active AFK window.

## Start and end the window

1. Acknowledge activation in one short sentence and continue any in-progress work. Do not pause merely because the user is away.
2. Start the AFK window immediately after invocation.
3. End the window at the start of the user's next message, before handling that message. Do not carry these overrides forward unless the user explicitly invokes `c14-afk` again.

## Route browser work

- Continue to prefer an applicable connector, API, or CLI when the task does not require browser interaction.
- When browser interaction is necessary, use only one of these skills and follow its full instructions:
  - `chrome:control-chrome` for the user's regular Chrome and its existing signed-in state.
  - `browser:control-in-app-browser` for the built-in in-app browser.
- Never use Chrome Beta during the AFK window. This prohibition includes `chrome-devtools`, `chrome-devtools-cli`, or any other route that launches or attaches to Chrome Beta.
- Do not substitute standalone Playwright, Computer Use, or another browser surface when both allowed browser surfaces are unavailable. Continue non-browser work and treat a required browser action as an intervention blocker.

## Notify the user when intervention is required

Invocation explicitly authorizes one concise personal DingTalk notification for each distinct blocker that genuinely requires the user's input, approval, authentication, or physical action. Do not notify for routine progress or successful completion.

1. Exhaust safe, in-scope work that does not require the user.
2. Load and follow the `dws` skill. Use only `dws` commands, always with `--format json`.
3. Resolve the authenticated current profile and the current user's own `userId` with read-only commands such as `dws profile list` and `dws contact user get-self`; never guess an identifier.
4. Verify the current leaf schema and help for `dws chat message send`, then send one personal text message to that `userId` as the current user.
5. Use this compact message shape: `[Codex 等待干预] <任务>；<阻塞原因>；请 <需要用户执行的动作>`.
6. After sending, keep doing any remaining safe work. Do not repeatedly notify for the same unchanged blocker.

If the current profile or self identity is ambiguous, or the notification fails after following `dws` recovery guidance, record the exact failure in the task and do not try another communication channel.

## Keep the scope narrow

- Do not change persistent browser preferences, Codex settings, or repository instructions.
- Do not create a reminder, todo, calendar event, or group message as a substitute for the personal notification.
- Do not interpret AFK activation as permission for unrelated external side effects.
