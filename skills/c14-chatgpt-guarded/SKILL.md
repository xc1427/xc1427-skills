---
name: c14-chatgpt-guarded
description: Build, install, explain, reassess, retire, or troubleshoot the macOS ChatGPT Guarded launcher, which starts ChatGPT with scoped Node HTTP proxy variables to avoid the in-app browser timeout path. Use whenever the user asks to create, install, reinstall, use, pin, remove, or diagnose ChatGPT Guarded; mentions launching ChatGPT or Codex through NODE_USE_ENV_PROXY; asks whether this workaround is still needed; or asks how to avoid bypassing it. Do not use for ordinary ChatGPT usage or unrelated proxy configuration.
---

# ChatGPT Guarded

Use this skill for two related jobs:

1. Build and install `ChatGPT Guarded.app` into the current user's `$HOME/Applications` directory.
2. Explain how the launcher works and how to avoid accidentally bypassing it.

The launcher is intentionally scoped to ChatGPT. It does not install a LaunchAgent and does not set session-wide variables with `launchctl setenv`.

## Background And Expiration Policy

This is a workaround for a dated observation, not a permanent product requirement.

On 2026-07-10, the affected macOS setup had these characteristics:

- OpenAI Codex issue `#29385` described roughly 30-second in-app browser and Chrome-extension delays associated with `ab.chatgpt.com` timeouts on restricted or proxied networks.
- macOS had a working HTTP/HTTPS proxy at `127.0.0.1:7890`. `curl` reached `https://ab.chatgpt.com/v1` through it in roughly half a second and received HTTP `403`, proving transport reachability.
- ChatGPT `26.707.31428` bundled Node `v24.14.0`. Its plain `fetch()` failed after about `10.5s`, while the same request with `NODE_USE_ENV_PROXY=1` and the proxy variables reached HTTP `403` in about `0.66s`.
- The earlier `respect_system_proxy` feature did not fix this helper Node fetch lane on the tested build.
- Session-wide `launchctl setenv` values reached GUI applications, but they affected unrelated future GUI processes and could be overridden by stale terminal variables. That motivated a per-app launcher using `NSWorkspace.OpenConfiguration.environment`.

Treat every item above as historical evidence. The durable goal is simply: avoid the browser timeout with the smallest supported mechanism. Do not preserve the launcher after a native or simpler solution satisfies that goal.

## Reassess Before Installing Or Recommending

Before a new install, reinstall, or recommendation that the launcher should remain, perform a lightweight current-state check unless the user explicitly asks to skip retesting:

1. Record the installed ChatGPT version and bundled Node version.
2. Check current official Codex guidance, release notes, available proxy settings, and the status of issue `#29385` when network access is available.
3. Compare a bounded direct bundled-Node fetch with the same fetch using `NODE_USE_ENV_PROXY=1`. Do not reuse the 2026 timings as current evidence.
4. Prefer an actual in-app browser navigation check when that surface is available; a helper-only probe is supporting evidence, not complete end-to-end proof.
5. Confirm that the user's current proxy endpoint is still `127.0.0.1:7890` before building the fixed-endpoint launcher.

Choose the simplest current outcome:

- If direct fetch and in-app navigation are now fast, do not install the launcher. Recommend removing an existing copy.
- If ChatGPT now honors the macOS system proxy or an official setting fixes the helper lane, prefer that supported path and recommend removing the launcher.
- If `NODE_USE_ENV_PROXY=1` no longer changes the result, do not present this launcher as a fix.
- If only the proxy address changed, prefer updating the scoped launcher configuration over adding global launchd state.
- If the original behavior still reproduces and the environment-proxy comparison still fixes it, the guarded launcher remains justified.
- If current behavior cannot be verified, describe the conclusion as provisional instead of treating the historical story as proof.

## Build And Install

When the user asks to build, install, or reinstall the launcher, run:

```bash
bash <skill-base-dir>/scripts/install-chatgpt-guarded.sh
```

Replace `<skill-base-dir>` with the base directory supplied when this skill is loaded.

The installer:

- requires macOS, `/Applications/ChatGPT.app`, and the Swift compiler;
- compiles the bundled AppKit launcher source;
- ad-hoc signs and verifies the app bundle;
- installs it at `$HOME/Applications/ChatGPT Guarded.app`;
- registers it with LaunchServices and reveals it in Finder;
- replaces only its own bundle or a recognized earlier `ChatGPT Guarded` trial bundle.

Use `--no-reveal` only for automated verification:

```bash
bash <skill-base-dir>/scripts/install-chatgpt-guarded.sh --no-reveal
```

After installation, report the full installed path and explain the regular launch options below. Do not commit or push repository changes unless the user separately asks.

## How To Use It

Recommend this normal workflow:

- Open `$HOME/Applications/ChatGPT Guarded.app` once, or find **ChatGPT Guarded** with Spotlight.
- Drag **ChatGPT Guarded** into the Dock for everyday use.
- Remove the original ChatGPT icon from the Dock to reduce accidental bypasses.
- When the launcher says ChatGPT is already running, choose **Quit and Relaunch**. An existing process cannot receive a replacement environment.
- Treat **ChatGPT launched safely** as the success signal. It means both the live proxy probe and process-environment verification passed.

The launcher checks `https://ab.chatgpt.com/v1` through `http://127.0.0.1:7890`, then launches ChatGPT with:

```text
NODE_USE_ENV_PROXY=1
HTTP_PROXY=http://127.0.0.1:7890
HTTPS_PROXY=http://127.0.0.1:7890
NO_PROXY=localhost,127.0.0.1,::1,.local
```

It passes these values directly through `NSWorkspace.OpenConfiguration.environment`, so stale proxy variables in a terminal do not participate in the guarded launch.

## Caveats And Bypass Prevention

Explain these points when the user asks for usage guidance or troubleshooting:

- Opening the original **ChatGPT** app from the Dock, Finder, Spotlight, Terminal, or a Login Item bypasses the guard.
- Adding the original ChatGPT app as a Login Item can start it before the guarded launcher. Keep it disabled as a Login Item.
- Choosing **Cancel** when ChatGPT is already running leaves the old process unchanged and does not apply the guarded environment.
- The launcher refuses to start ChatGPT when the real HTTPS proxy probe fails. Start or repair the proxy first instead of bypassing the warning.
- The default proxy endpoint is fixed at `127.0.0.1:7890`. Rebuild the launcher if that endpoint changes.
- The launcher does not require global `launchctl` proxy variables. Stale global variables can still affect other GUI applications and should be managed separately.
- `NO_PROXY` deliberately contains only loopback and `.local` destinations. Do not add `chatgpt.com`, `ab.chatgpt.com`, or a wildcard, because that restores the direct timeout path.
- A ChatGPT update can change the bundled Node runtime or networking behavior. Re-run the live proxy comparison after a major update if the delay returns.

## Troubleshooting Order

Check the smallest relevant boundary first:

1. Confirm the user launched **ChatGPT Guarded**, not the original app.
2. Confirm no old ChatGPT process survived because the restart prompt was cancelled.
3. Confirm the proxy probe reaches `ab.chatgpt.com` through `127.0.0.1:7890`.
4. Inspect the ChatGPT process environment for the four exact variables above.
5. Compare the current bundled Node fetch with and without `NODE_USE_ENV_PROXY=1` if the timeout persists after a ChatGPT update.

Do not claim that the upstream browser issue is fixed merely because the launcher works. Describe this as a local, scoped workaround.

## Retirement And Removal

Recommend retirement when the reassessment shows that direct/native behavior is healthy, an official proxy path works, or the launcher no longer changes the outcome.

When the user explicitly asks to remove it:

1. Quit **ChatGPT Guarded** and remove its icon from the Dock.
2. Verify that `$HOME/Applications/ChatGPT Guarded.app` has bundle identifier `local.c14.chatgpt-guarded` before deleting that bundle.
3. Leave `/Applications/ChatGPT.app` untouched and return the user to the original app.
4. Check for stale global `NODE_USE_ENV_PROXY`, `HTTP_PROXY`, `HTTPS_PROXY`, and `NO_PROXY` values in the user's launchd context. Unset them only if they belong to this old workaround.

Do not delete the launcher merely because a check is inconclusive. Recommend removal when the old premise has actually stopped holding, and execute removal only after an explicit user request.
