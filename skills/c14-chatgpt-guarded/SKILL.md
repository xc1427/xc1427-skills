---
name: c14-chatgpt-guarded
description: Build, install, verify, update, or remove the ChatGPT Guarded macOS launcher. Use whenever the user mentions ChatGPT Guarded, wants a safe Alfred-searchable launcher for ChatGPT/Codex, needs the in-app Browser proxy workaround installed after an app update, or asks whether the guarded launcher is still necessary.
---

# ChatGPT Guarded

Use the bundled installer to maintain a short-lived macOS launcher at
`$HOME/Applications/ChatGPT Guarded.app`.

The launcher applies a process-scoped proxy to the original `/Applications/ChatGPT.app`.
It protects both Chromium's desktop-app network layer and the native Browser helper,
without changing the macOS system proxy. Chromium receives:

```text
--proxy-server=http://127.0.0.1:7890
```

The ChatGPT process and its non-Chromium children receive:

```text
CODEX_NODE_REPL_PATH=$HOME/.local/bin/codex-node-repl-proxy
HTTP_PROXY=http://127.0.0.1:7890
HTTPS_PROXY=http://127.0.0.1:7890
ALL_PROXY=http://127.0.0.1:7890
NO_PROXY=localhost,127.0.0.1,::1
NODE_USE_ENV_PROXY=1
```

The installed native-helper wrapper independently applies the same environment:

```text
HTTP_PROXY=http://127.0.0.1:7890
HTTPS_PROXY=http://127.0.0.1:7890
NO_PROXY=localhost,127.0.0.1,::1
NODE_USE_ENV_PROXY=1
```

The HTTP(S) proxy variables are the workaround for the observed Browser privileged-fetch
timeout. `NODE_USE_ENV_PROXY=1` is a separate defense-in-depth setting: it makes Node's
standard network clients, including global `fetch()`, honor the same proxy for current
and future Node REPL workflows. Do not describe it as part of the original Browser fix.

The wrapper applies to every Node REPL consumer, including Browser, Chrome control,
Computer Use, and generic JavaScript helpers. Local traffic remains bypassed through
`NO_PROXY`. Do not restore the withdrawn Node-child wrapper,
`BROWSER_USE_DISABLE_AMBIENT_NETWORK`, `BROWSER_USE_SECURITY_MODE`, or
`NODE_USE_SYSTEM_CA` experiments.

## Install or update

Run:

```bash
bash <skill-base-dir>/scripts/install-chatgpt-guarded.sh
```

Replace `<skill-base-dir>` with this skill directory. Use `--no-reveal` only for
automated verification.

The installer:

- validates the original ChatGPT bundle and bundled native Browser helper;
- installs the proxy wrapper at `$HOME/.local/bin/codex-node-repl-proxy`;
- compiles and ad-hoc signs `ChatGPT Guarded.app`;
- installs it under `$HOME/Applications` and registers it with LaunchServices.

## Runtime behavior

When ChatGPT Guarded opens:

1. If a correctly configured ChatGPT process is already running, activate it and exit.
2. If ChatGPT is running without the expected helper path, offer to quit and relaunch it.
3. Before a cold launch or relaunch, perform a bounded proxy check against
   `https://ab.chatgpt.com/v1` through `127.0.0.1:7890`. Retry transient failures up
   to three times with short backoff delays before reporting that the proxy is unavailable.
4. Launch the original ChatGPT bundle with the Chromium proxy flag and new-instance creation disabled.
5. Verify the launched process received the expected app and helper proxy configuration, then exit.

The launcher is an `LSUIElement`, so it does not remain in the Dock or application
switcher. It keeps the display name `ChatGPT Guarded` and registers `Codex Guarded` as
an alternate application name, so Alfred's free default app search can find it using
either name without a workflow. Once the original ChatGPT process is running correctly,
opening either app activates the same ChatGPT process; opening the original app from a
stopped state bypasses the workaround.

## Diagnostics

Every launcher invocation appends a local, line-oriented trace to:

```text
$HOME/Library/Logs/ChatGPT Guarded/launcher.log
```

The trace records launcher decisions, proxy attempt exit/HTTP status and timing,
restart choices, process identifiers, final launch verification, and each scoped Node
REPL wrapper startup. It does not dump the environment, command arguments, request or
response bodies, credentials, or user content. Nothing is uploaded. Launcher events
are capped at 2 KiB; the log rotates at 512 KiB and keeps one
`launcher.previous.log` file.

When diagnosing a launch problem, inspect the latest events with:

```bash
tail -n 100 "$HOME/Library/Logs/ChatGPT Guarded/launcher.log"
```

## Verification

After installation:

1. Check the app bundle identifier is `local.c14.chatgpt-guarded`.
2. Check the app is ad-hoc signed and registered with LaunchServices.
3. Check `mdls` reports `Codex Guarded` under `kMDItemAlternateNames`, refresh Alfred's
   app cache with `reload`, and confirm `codex guarded` resolves to `ChatGPT Guarded`.
4. With a correctly configured ChatGPT process already running, open ChatGPT Guarded
   and confirm the original ChatGPT PID does not change and no second ChatGPT process
   appears.
5. On the next safe cold start, verify ChatGPT's launch command includes `--proxy-server`,
   the generated `node_repl` command points to the installed wrapper, and time an in-app
   Browser navigation.
6. Verify a standalone bundled-Node `fetch()` reaches a proxy-required HTTPS endpoint
   with the wrapper's environment, while localhost remains covered by `NO_PROXY`.
7. Open ChatGPT Guarded and confirm `launcher.log` contains one session from
   `launcher_start` through the final activation or failure decision.

## Retirement

Reassess after major ChatGPT updates. Remove the launcher when the native helper honors
the macOS system proxy directly or Browser navigation remains fast without this override.
Do not treat historical timings as current evidence.
