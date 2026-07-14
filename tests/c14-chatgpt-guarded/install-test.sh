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
lsui_element="$(/usr/libexec/PlistBuddy -c 'Print :LSUIElement' "${destination}/Contents/Info.plist")"
[[ "${lsui_element}" == "true" ]] || fail "launcher must be an LSUIElement"

assert_contains "${source_file}" 'configuration.createsNewApplicationInstance = false' "single-instance contract missing"
assert_contains "${source_file}" 'if hasExpectedEnvironment(current)' "existing guarded process reuse missing"
assert_contains "${source_file}" 'CODEX_NODE_REPL_PATH' "native-helper override missing"
assert_contains "${source_file}" '"--noproxy", ""' "proxy probe must ignore inherited NO_PROXY"
assert_contains "${wrapper_file}" 'export HTTP_PROXY="http://127.0.0.1:7890"' "HTTP proxy missing"
assert_contains "${wrapper_file}" 'export HTTPS_PROXY="http://127.0.0.1:7890"' "HTTPS proxy missing"
assert_contains "${wrapper_file}" 'export NO_PROXY="localhost,127.0.0.1,::1"' "local proxy bypass missing"
assert_contains "${wrapper_file}" 'export NODE_USE_ENV_PROXY=1' "Node proxy robustness opt-in missing"
assert_contains "${wrapper_file}" 'It is not part of the Browser privileged-fetch timeout fix.' "Node proxy robustness scope missing"

if grep -Eq 'NODE_USE_SYSTEM_CA|BROWSER_USE_DISABLE_AMBIENT_NETWORK|BROWSER_USE_SECURITY_MODE' "${wrapper_file}"; then
  fail "obsolete workaround variable found in native-helper wrapper"
fi

[[ "${output}" == *"Installed: ${destination}"* ]] || fail "installer did not report app destination"
[[ "${output}" == *"Installed helper: ${installed_wrapper}"* ]] || fail "installer did not report helper destination"

printf '%s\n' 'PASS: ChatGPT Guarded installer'
