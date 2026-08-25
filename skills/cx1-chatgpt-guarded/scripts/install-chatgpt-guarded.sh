#!/usr/bin/env bash
# DESC: Build and install the scoped ChatGPT Guarded macOS launcher
set -euo pipefail

usage() {
  printf '%s\n' 'Usage: install-chatgpt-guarded.sh [--no-reveal]'
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

if [[ "$(uname -s)" != "Darwin" ]]; then
  printf '%s\n' 'Error: ChatGPT Guarded can only be built on macOS.' >&2
  exit 1
fi

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
skill_dir="$(cd "${script_dir}/.." && pwd)"
source_file="${skill_dir}/assets/Launcher.swift"
plist_file="${skill_dir}/assets/Info.plist"
wrapper_file="${skill_dir}/assets/codex-node-repl-proxy"
chatgpt_app="${CHATGPT_APP_PATH:-/Applications/ChatGPT.app}"
destination_dir="${HOME}/Applications"
destination="${destination_dir}/ChatGPT Guarded.app"
wrapper_destination="${HOME}/.local/bin/codex-node-repl-proxy"
bundle_id="local.cx1.chatgpt-guarded"

for required in "${source_file}" "${plist_file}" "${wrapper_file}"; do
  if [[ ! -f "${required}" ]]; then
    printf 'Error: missing bundled asset: %s\n' "${required}" >&2
    exit 1
  fi
done

if [[ ! -d "${chatgpt_app}" ]]; then
  printf 'Error: ChatGPT.app was not found at %s\n' "${chatgpt_app}" >&2
  exit 1
fi

bundled_node_repl="${chatgpt_app}/Contents/Resources/cua_node/bin/node_repl"
if [[ ! -x "${bundled_node_repl}" ]]; then
  printf 'Error: bundled Browser helper is missing: %s\n' "${bundled_node_repl}" >&2
  exit 1
fi

swiftc_path="$(xcrun --find swiftc 2>/dev/null || true)"
if [[ -z "${swiftc_path}" ]]; then
  printf '%s\n' 'Error: swiftc is required. Install the Xcode Command Line Tools first.' >&2
  exit 1
fi
sdk_path="$(xcrun --sdk macosx --show-sdk-path)"
target_arch="$(uname -m)"
case "${target_arch}" in
  arm64|x86_64) ;;
  *)
    printf 'Error: unsupported Mac architecture: %s\n' "${target_arch}" >&2
    exit 1
    ;;
esac

mkdir -p "${destination_dir}"
stage_root="$(mktemp -d "${destination_dir}/.chatgpt-guarded-build.XXXXXX")"
stage_app="${stage_root}/ChatGPT Guarded.app"
backup_app="${stage_root}/previous.app"

cleanup() {
  rm -rf "${stage_root}"
}
trap cleanup EXIT

mkdir -p "${stage_app}/Contents/MacOS" "${stage_app}/Contents/Resources" "${stage_root}/module-cache"
cp "${plist_file}" "${stage_app}/Contents/Info.plist"

icon_source=""
for candidate in icon-chatgpt.icns app.icns electron.icns; do
  if [[ -f "${chatgpt_app}/Contents/Resources/${candidate}" ]]; then
    icon_source="${chatgpt_app}/Contents/Resources/${candidate}"
    break
  fi
done
if [[ -z "${icon_source}" ]]; then
  printf 'Error: no usable ChatGPT icon was found in %s\n' "${chatgpt_app}" >&2
  exit 1
fi
cp "${icon_source}" "${stage_app}/Contents/Resources/AppIcon.icns"

printf '%s\n' 'Building ChatGPT Guarded...'
CLANG_MODULE_CACHE_PATH="${stage_root}/module-cache" "${swiftc_path}" \
  -sdk "${sdk_path}" \
  -target "${target_arch}-apple-macosx13.0" \
  -O \
  -framework AppKit \
  -framework Foundation \
  -o "${stage_app}/Contents/MacOS/ChatGPT Guarded" \
  "${source_file}"

plutil -lint "${stage_app}/Contents/Info.plist" >/dev/null
zsh -n "${wrapper_file}"
codesign --force --deep --sign - "${stage_app}" >/dev/null
codesign --verify --deep --strict "${stage_app}"

if [[ -e "${destination}" ]]; then
  existing_id="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "${destination}/Contents/Info.plist" 2>/dev/null || true)"
  if [[ "${existing_id}" != "${bundle_id}" ]]; then
    existing_name="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleDisplayName' "${destination}/Contents/Info.plist" 2>/dev/null || true)"
    if [[ "${existing_name}" != "ChatGPT Guarded" ]]; then
      printf 'Error: refusing to replace unrelated app: %s\n' "${destination}" >&2
      exit 1
    fi
  fi
  mv "${destination}" "${backup_app}"
fi

mkdir -p "$(dirname "${wrapper_destination}")"
install -m 0755 "${wrapper_file}" "${wrapper_destination}"

if ! mv "${stage_app}" "${destination}"; then
  if [[ -d "${backup_app}" ]]; then
    mv "${backup_app}" "${destination}"
  fi
  printf 'Error: failed to install %s\n' "${destination}" >&2
  exit 1
fi

launchservices_register="/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister"
"${launchservices_register}" -f "${destination}"

if [[ "${reveal}" -eq 1 ]]; then
  open -R "${destination}"
fi

printf 'Installed: %s\n' "${destination}"
printf 'Installed helper: %s\n' "${wrapper_destination}"
