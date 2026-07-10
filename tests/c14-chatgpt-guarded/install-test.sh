#!/bin/bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
INSTALLER="$REPO_ROOT/skills/c14-chatgpt-guarded/scripts/install-chatgpt-guarded.sh"
SOURCE="$REPO_ROOT/skills/c14-chatgpt-guarded/assets/Launcher.swift"
SKILL="$REPO_ROOT/skills/c14-chatgpt-guarded/SKILL.md"

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

assert_contains() {
  local file="$1"
  local expected="$2"
  local message="$3"
  grep -Fq "$expected" "$file" || fail "$message: '$expected' not found in '$file'"
}

[ -x "$INSTALLER" ] || fail "installer is not executable: $INSTALLER"
[ -d /Applications/ChatGPT.app ] || fail "ChatGPT.app is required for the build test"

test_root="$(mktemp -d)"
trap 'rm -rf "$test_root"' EXIT
test_home="$test_root/home"
mkdir -p "$test_home"

output="$(HOME="$test_home" CHATGPT_APP_PATH=/Applications/ChatGPT.app "$INSTALLER" --no-reveal)"
destination="$test_home/Applications/ChatGPT Guarded.app"

[ -x "$destination/Contents/MacOS/ChatGPT Guarded" ] || fail "compiled launcher is missing"
[ -f "$destination/Contents/Resources/AppIcon.icns" ] || fail "launcher icon is missing"
plutil -lint "$destination/Contents/Info.plist" >/dev/null
codesign --verify --deep --strict "$destination"

bundle_id="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$destination/Contents/Info.plist")"
[ "$bundle_id" = "local.c14.chatgpt-guarded" ] || fail "unexpected bundle identifier: $bundle_id"
[[ "$output" == *"Installed: $destination"* ]] || fail "installer did not report the destination"

# 模拟早期试用版的 bundle id，验证正式安装可以安全迁移。
/usr/libexec/PlistBuddy -c 'Set :CFBundleIdentifier local.example.chatgpt-guarded-trial' "$destination/Contents/Info.plist"
codesign --force --deep --sign - "$destination" >/dev/null
HOME="$test_home" CHATGPT_APP_PATH=/Applications/ChatGPT.app "$INSTALLER" --no-reveal >/dev/null
codesign --verify --deep --strict "$destination"
bundle_id="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$destination/Contents/Info.plist")"
[ "$bundle_id" = "local.c14.chatgpt-guarded" ] || fail "trial bundle was not migrated: $bundle_id"

assert_contains "$SOURCE" "NSWorkspace.OpenConfiguration" "scoped launch API"
assert_contains "$SOURCE" "configuration.environment = guardedEnvironment()" "scoped environment injection"
assert_contains "$SKILL" "Opening the original **ChatGPT** app" "original-app bypass warning"
assert_contains "$SKILL" "Login Item" "login-item bypass warning"
assert_contains "$SKILL" "Quit and Relaunch" "existing-process guidance"
assert_contains "$SKILL" 'Do not add `chatgpt.com`' "NO_PROXY warning"
assert_contains "$SKILL" "## Background And Expiration Policy" "dated background section"
assert_contains "$SKILL" "Do not reuse the 2026 timings as current evidence" "current-state reassessment"
assert_contains "$SKILL" "prefer that supported path and recommend removing the launcher" "native-fix retirement guidance"
assert_contains "$SKILL" "## Retirement And Removal" "removal section"
assert_contains "$SKILL" 'Leave `/Applications/ChatGPT.app` untouched' "original-app removal safety"

echo "PASS: c14-chatgpt-guarded install"
