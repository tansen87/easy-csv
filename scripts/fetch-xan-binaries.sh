#!/usr/bin/env bash
#
# Fetch the pinned precompiled `xan` binary for a given target platform and
# place it under src-tauri/resources/plugins/<target>/, where it is embedded
# via include_bytes! (see xan.rs / plugins.rs).
#
# Usage (run from the repo root on the target CI machine):
#   ./scripts/fetch-xan-binaries.sh macos-aarch64
#   ./scripts/fetch-xan-binaries.sh linux-x86_64-gnu
#
# Source: medialab/xan releases (https://github.com/medialab/xan/releases)
# The upstream provides per-target binaries: x86_64-apple-darwin,
# aarch64-apple-darwin, x86_64-unknown-linux-gnu, aarch64-unknown-linux-gnu ...
#
# Pinning: XAN_VERSION is a fixed release tag (not "latest") so builds are
# reproducible. The checksum manifest in $CHECKSUMS is authoritative; if a new
# version is bumped, update the SHA-256 there too.

set -euo pipefail

XAN_VERSION="${XAN_VERSION:-v0.60.0}"
REPO="medialab/xan"

# target dir name used in resources/plugins -> upstream release target name
declare -A TARGET_MAP=(
  [macos-x86_64]="x86_64-apple-darwin"
  [macos-aarch64]="aarch64-apple-darwin"
  [linux-x86_64-gnu]="x86_64-unknown-linux-gnu"
  [linux-aarch64-gnu]="aarch64-unknown-linux-gnu"
)

# SHA-256 per <target>:<version>. FILLED IN when the version is pinned during
# CI bring-up (run `shasum -a 256` on the downloaded binary once).
declare -A CHECKSUMS=( )

target="${1:-}"
if [[ -z "$target" || -z "${TARGET_MAP[$target]:-}" ]]; then
  echo "error: unknown target '$target'. Choose from: ${!TARGET_MAP[*]}" >&2
  exit 1
fi

dest_dir="src-tauri/resources/plugins/$target"
dest="$dest_dir/xan"
asset="${XAN_VERSION#v}/$target/xan.tar.gz"

mkdir -p "$dest_dir"
url="https://github.com/$REPO/releases/download/${XAN_VERSION}/xan-${TARGET_MAP[$target]}.tar.gz"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

echo "[fetch-xan] downloading $url"
curl -fL --retry 3 -o "$tmp/xan.tar.gz" "$url"

expected="${CHECKSUMS[$target]:-}"
if [[ -n "$expected" ]]; then
  actual="$(shasum -a 256 "$tmp/xan.tar.gz" | awk '{print $1}')"
  if [[ "$actual" != "$expected" ]]; then
    echo "error: SHA-256 mismatch for $target (got $actual, expected $expected)" >&2
    exit 1
  fi
  echo "[fetch-xan] checksum OK"
else
  echo "[fetch-xan] WARNING: no pinned checksum for $target $XAN_VERSION; skipping verification" >&2
fi

tar -xzf "$tmp/xan.tar.gz" -C "$tmp"
# The release payload contains the binary at a predictable path; locate it.
bin="$(find "$tmp" -maxdepth 2 -type f -name xan -o -maxdepth 2 -type f -name xan.exe | head -n1)"
if [[ -z "$bin" ]]; then
  echo "error: could not locate xan binary in release archive" >&2
  exit 1
fi

cp "$bin" "$dest"
chmod +x "$dest"
echo "[fetch-xan] wrote $dest"