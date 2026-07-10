#!/usr/bin/env bash
# DESC: Build and install the guarded ChatGPT macOS launcher
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: install-chatgpt-guarded.sh [--no-reveal]

Build and install ChatGPT Guarded.app into $HOME/Applications.

Options:
  --no-reveal  Do not reveal the installed app in Finder.
EOF
}

reveal=1
case "${1:-}" in
  "") ;;
  --no-reveal) reveal=0 ;;
  -h|--help)
    usage
    exit 0
    ;;
  *)
    usage >&2
    exit 2
    ;;
esac

if [ "$(uname -s)" != "Darwin" ]; then
  echo "Error: ChatGPT Guarded can only be built on macOS." >&2
  exit 1
fi

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
skill_dir="$(cd "$script_dir/.." && pwd)"
source_file="$skill_dir/assets/Launcher.swift"
plist_file="$skill_dir/assets/Info.plist"
chatgpt_app="${CHATGPT_APP_PATH:-/Applications/ChatGPT.app}"
destination_dir="$HOME/Applications"
destination="$destination_dir/ChatGPT Guarded.app"
bundle_id="local.c14.chatgpt-guarded"

if [ ! -d "$chatgpt_app" ]; then
  echo "Error: ChatGPT.app was not found at $chatgpt_app" >&2
  exit 1
fi

if [ ! -f "$source_file" ] || [ ! -f "$plist_file" ]; then
  echo "Error: bundled launcher assets are incomplete." >&2
  exit 1
fi

swiftc_path="$(command -v swiftc || true)"
if [ -z "$swiftc_path" ]; then
  echo "Error: swiftc is required. Install the Xcode Command Line Tools first." >&2
  exit 1
fi

if pgrep -f "$destination/Contents/MacOS/ChatGPT Guarded" >/dev/null 2>&1; then
  echo "Error: ChatGPT Guarded is running. Close it before reinstalling." >&2
  exit 1
fi

mkdir -p "$destination_dir"
stage_root="$(mktemp -d "$destination_dir/.chatgpt-guarded-build.XXXXXX")"
stage_app="$stage_root/ChatGPT Guarded.app"
backup_app="$stage_root/previous.app"

cleanup() {
  rm -rf "$stage_root"
}
trap cleanup EXIT

mkdir -p "$stage_app/Contents/MacOS" "$stage_app/Contents/Resources" "$stage_root/module-cache"
cp "$plist_file" "$stage_app/Contents/Info.plist"

icon_source=""
for candidate in icon-chatgpt.icns app.icns electron.icns; do
  if [ -f "$chatgpt_app/Contents/Resources/$candidate" ]; then
    icon_source="$chatgpt_app/Contents/Resources/$candidate"
    break
  fi
done

if [ -z "$icon_source" ]; then
  echo "Error: no usable ChatGPT icon was found in $chatgpt_app" >&2
  exit 1
fi

cp "$icon_source" "$stage_app/Contents/Resources/AppIcon.icns"

echo "Building ChatGPT Guarded..."
CLANG_MODULE_CACHE_PATH="$stage_root/module-cache" "$swiftc_path" \
  -O \
  -framework AppKit \
  -framework Foundation \
  -o "$stage_app/Contents/MacOS/ChatGPT Guarded" \
  "$source_file"

plutil -lint "$stage_app/Contents/Info.plist" >/dev/null
codesign --force --deep --sign - "$stage_app" >/dev/null
codesign --verify --deep --strict "$stage_app"

if [ -e "$destination" ]; then
  existing_id="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$destination/Contents/Info.plist" 2>/dev/null || true)"
  if [ "$existing_id" != "$bundle_id" ]; then
    existing_name="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleDisplayName' "$destination/Contents/Info.plist" 2>/dev/null || true)"
    existing_executable="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleExecutable' "$destination/Contents/Info.plist" 2>/dev/null || true)"
    if [ "$existing_name" != "ChatGPT Guarded" ] || [ "$existing_executable" != "ChatGPT Guarded" ]; then
      echo "Error: refusing to replace $destination because it is not a recognized ChatGPT Guarded bundle." >&2
      exit 1
    fi
  fi
  mv "$destination" "$backup_app"
fi

if ! mv "$stage_app" "$destination"; then
  if [ -d "$backup_app" ]; then
    mv "$backup_app" "$destination"
  fi
  echo "Error: failed to install ChatGPT Guarded." >&2
  exit 1
fi

launchservices_register="/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister"
"$launchservices_register" -f "$destination"

if [ "$reveal" -eq 1 ]; then
  open -R "$destination"
fi

echo "Installed: $destination"
echo "Launch it from Spotlight or drag it into the Dock."
