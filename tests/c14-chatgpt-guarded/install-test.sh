#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
skill_dir="${repo_root}/skills/c14-chatgpt-guarded"
installer="${skill_dir}/scripts/install-chatgpt-guarded.sh"
source_file="${skill_dir}/assets/Launcher.swift"
wrapper_file="${skill_dir}/assets/codex-node-repl-proxy"

fail() {
  printf 'FAIL: %s\n' "$*" >&2
  exit 1
}

assert_contains() {
  local file="$1"
  local expected="$2"
  local message="$3"
  grep -Fq "${expected}" "${file}" || fail "${message}: ${expected}"
}

[[ -f "${installer}" ]] || fail "installer is missing"
[[ -d /Applications/ChatGPT.app ]] || fail "ChatGPT.app is required"

test_root="$(mktemp -d)"
trap 'rm -rf "${test_root}"' EXIT
test_home="${test_root}/home"
mkdir -p "${test_home}"

output="$(HOME="${test_home}" CHATGPT_APP_PATH=/Applications/ChatGPT.app bash "${installer}" --no-reveal)"
destination="${test_home}/Applications/ChatGPT Guarded.app"
installed_wrapper="${test_home}/.local/bin/codex-node-repl-proxy"

[[ -x "${destination}/Contents/MacOS/ChatGPT Guarded" ]] || fail "compiled launcher is missing"
[[ -x "${installed_wrapper}" ]] || fail "installed native-helper wrapper is missing"
plutil -lint "${destination}/Contents/Info.plist" >/dev/null
codesign --verify --deep --strict "${destination}"
zsh -n "${installed_wrapper}"

bundle_id="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "${destination}/Contents/Info.plist")"
[[ "${bundle_id}" == "local.c14.chatgpt-guarded" ]] || fail "unexpected bundle id: ${bundle_id}"
short_version="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "${destination}/Contents/Info.plist")"
[[ "${short_version}" == "0.5" ]] || fail "unexpected launcher version: ${short_version}"
bundle_version="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleVersion' "${destination}/Contents/Info.plist")"
[[ "${bundle_version}" == "5" ]] || fail "unexpected launcher build: ${bundle_version}"
lsui_element="$(/usr/libexec/PlistBuddy -c 'Print :LSUIElement' "${destination}/Contents/Info.plist")"
[[ "${lsui_element}" == "true" ]] || fail "launcher must be an LSUIElement"
alternate_name="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleAlternateNames:0' "${destination}/Contents/Info.plist")"
[[ "${alternate_name}" == "Codex Guarded" ]] || fail "Codex alternate name missing"
metadata_keyword="$(/usr/libexec/PlistBuddy -c 'Print :MDItemKeywords' "${destination}/Contents/Info.plist")"
[[ "${metadata_keyword}" == "Codex" ]] || fail "Codex metadata keyword missing"

assert_contains "${source_file}" 'configuration.createsNewApplicationInstance = false' "single-instance contract missing"
assert_contains "${source_file}" 'let isGuarded = hasExpectedLaunchConfiguration(current)' "existing guarded process check missing"
assert_contains "${source_file}" 'if isGuarded {' "existing guarded process reuse missing"
assert_contains "${source_file}" 'CODEX_NODE_REPL_PATH' "native-helper override missing"
assert_contains "${source_file}" 'private let chromiumProxyArgument = "--proxy-server=\(proxyURL)"' "Chromium proxy argument missing"
assert_contains "${source_file}" 'configuration.arguments = [chromiumProxyArgument]' "Chromium proxy launch configuration missing"
assert_contains "${source_file}" 'environment["HTTP_PROXY"] = proxyURL' "app HTTP proxy missing"
assert_contains "${source_file}" 'environment["HTTPS_PROXY"] = proxyURL' "app HTTPS proxy missing"
assert_contains "${source_file}" 'environment["ALL_PROXY"] = proxyURL' "app all-proxy missing"
assert_contains "${source_file}" 'environment["NO_PROXY"] = proxyBypassHosts' "app local bypass missing"
assert_contains "${source_file}" 'environment["NODE_USE_ENV_PROXY"] = "1"' "app Node proxy robustness opt-in missing"
assert_contains "${source_file}" '"--noproxy", ""' "proxy probe must ignore inherited NO_PROXY"
assert_contains "${source_file}" 'private let proxyProbeMaxAttempts = 3' "proxy retry count missing"
assert_contains "${source_file}" 'private let proxyProbeBackoff: [TimeInterval] = [0.4, 0.8]' "proxy retry backoff missing"
assert_contains "${source_file}" 'guard ensureProxyAvailable() else { return }' "launch path must use resilient proxy probe"
assert_contains "${source_file}" 'ChatGPT was not launched or restarted.' "proxy failure safety message missing"
resilient_probe_call_count="$(grep -Fc 'guard ensureProxyAvailable() else { return }' "${source_file}")"
[[ "${resilient_probe_call_count}" == "2" ]] || fail "both cold launch and relaunch must use resilient proxy probe"
assert_contains "${source_file}" 'Library/Logs/ChatGPT Guarded' "diagnostic log path missing"
assert_contains "${source_file}" 'private let maxDiagnosticLogSizeBytes: UInt64 = 512 * 1024' "diagnostic log rotation limit missing"
assert_contains "${source_file}" 'launcher.previous.log' "rotated diagnostic log missing"
assert_contains "${source_file}" 'trace("proxy_probe attempt=' "proxy attempt trace missing"
assert_contains "${source_file}" 'trace("chatgpt_verification_ok pid=' "launch verification trace missing"
assert_contains "${wrapper_file}" 'export HTTP_PROXY="http://127.0.0.1:7890"' "HTTP proxy missing"
assert_contains "${wrapper_file}" 'export HTTPS_PROXY="http://127.0.0.1:7890"' "HTTPS proxy missing"
assert_contains "${wrapper_file}" 'export NO_PROXY="localhost,127.0.0.1,::1"' "local proxy bypass missing"
assert_contains "${wrapper_file}" 'export NODE_USE_ENV_PROXY=1' "Node proxy robustness opt-in missing"
assert_contains "${wrapper_file}" 'It is not part of the Browser privileged-fetch timeout fix.' "Node proxy robustness scope missing"
assert_contains "${wrapper_file}" 'Library/Logs/ChatGPT Guarded' "Node REPL diagnostic log path missing"
assert_contains "${wrapper_file}" 'wrapper_exec node_use_env_proxy=1' "Node REPL startup trace missing"
assert_contains "${wrapper_file}" 'wrapper_error reason=bundled_node_repl_missing' "Node REPL failure trace missing"

if grep -Eq 'NODE_USE_SYSTEM_CA|BROWSER_USE_DISABLE_AMBIENT_NETWORK|BROWSER_USE_SECURITY_MODE' "${wrapper_file}"; then
  fail "obsolete workaround variable found in native-helper wrapper"
fi

[[ "${output}" == *"Installed: ${destination}"* ]] || fail "installer did not report app destination"
[[ "${output}" == *"Installed helper: ${installed_wrapper}"* ]] || fail "installer did not report helper destination"

printf '%s\n' 'PASS: ChatGPT Guarded installer'
