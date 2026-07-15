#!/bin/bash
set -e

CURRENT=$(grep '"version"' package.json | head -1 | sed 's/.*"version": "\(.*\)".*/\1/')
CONFIG=".github/runner-config.json"

echo "Latest Version Published: $CURRENT"
read -p "Enter new version: " VERSION

if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Invalid version format. Use semver like 0.1.0"
  exit 1
fi

echo ""
echo "  1) Windows only              (tag: v$VERSION-beta-win)"
echo "  2) macOS ARM only            (tag: v$VERSION-beta-mac-arm)"
echo "  3) macOS Intel only          (tag: v$VERSION-beta-mac-x64)"
echo "  4) macOS both                (tag: v$VERSION-beta-mac)"
echo "  5) Linux only                (tag: v$VERSION-beta-linux)"
echo "  6) All platforms             (tag: v$VERSION-beta)"
echo "  7) Full release (all)        (tag: v$VERSION)"
read -p "Choose [6]: " BUILD_TYPE
BUILD_TYPE=${BUILD_TYPE:-6}

# Runner selection
echo ""
echo "Current runners:"
cat "$CONFIG"
echo ""
echo "  k) Keep current (default)"
echo "  g) GitHub-hosted (all platforms)"
echo "  s) Self-hosted (all platforms)"
echo "  m) Mix (pick per platform)"
read -p "Runner mode [k]: " RUNNER_MODE
RUNNER_MODE=${RUNNER_MODE:-k}

if [ "$RUNNER_MODE" = "k" ]; then
  echo "Keeping current runners"
elif [ "$RUNNER_MODE" = "s" ]; then
  cat > "$CONFIG" << 'EOF'
{
  "windows": ["self-hosted", "Windows"],
  "macos-arm": ["self-hosted", "macOS"],
  "macos-x64": ["self-hosted", "macOS"],
  "linux": ["self-hosted", "Linux"]
}
EOF
  echo "Set all runners to self-hosted"
elif [ "$RUNNER_MODE" = "m" ]; then
  echo ""
  echo "For each platform, enter 'g' for GitHub-hosted or 's' for self-hosted"

  read -p "  Windows [g]: " WIN_RUNNER
  WIN_RUNNER=${WIN_RUNNER:-g}
  if [ "$WIN_RUNNER" = "s" ]; then
    WIN_VAL='["self-hosted", "Windows"]'
  else
    WIN_VAL='["windows-latest"]'
  fi

  read -p "  macOS ARM [g]: " MAC_ARM_RUNNER
  MAC_ARM_RUNNER=${MAC_ARM_RUNNER:-g}
  if [ "$MAC_ARM_RUNNER" = "s" ]; then
    MAC_ARM_VAL='["self-hosted", "macOS"]'
  else
    MAC_ARM_VAL='["macos-14"]'
  fi

  read -p "  macOS Intel [g]: " MAC_X64_RUNNER
  MAC_X64_RUNNER=${MAC_X64_RUNNER:-g}
  if [ "$MAC_X64_RUNNER" = "s" ]; then
    MAC_X64_VAL='["self-hosted", "macOS"]'
  else
    MAC_X64_VAL='["macos-15-intel"]'
  fi

  read -p "  Linux [g]: " LINUX_RUNNER
  LINUX_RUNNER=${LINUX_RUNNER:-g}
  if [ "$LINUX_RUNNER" = "s" ]; then
    LINUX_VAL='["self-hosted", "Linux"]'
  else
    LINUX_VAL='["ubuntu-22.04"]'
  fi

  jq -n \
    --argjson win "$WIN_VAL" \
    --argjson arm "$MAC_ARM_VAL" \
    --argjson x64 "$MAC_X64_VAL" \
    --argjson linux "$LINUX_VAL" \
    '{"windows": $win, "macos-arm": $arm, "macos-x64": $x64, "linux": $linux}' > "$CONFIG"
  echo "Set runners per platform"
else
  cat > "$CONFIG" << 'EOF'
{
  "windows": ["windows-latest"],
  "macos-arm": ["macos-14"],
  "macos-x64": ["macos-15-intel"],
  "linux": ["ubuntu-22.04"]
}
EOF
  echo "Set all runners to GitHub-hosted"
fi

# Update version in all files
sed -i "s/\"version\": \".*\"/\"version\": \"$VERSION\"/" package.json
sed -i "s/^version = \".*\"/version = \"$VERSION\"/" src-tauri/Cargo.toml
sed -i "s/\"version\": \".*\"/\"version\": \"$VERSION\"/" src-tauri/tauri.conf.json
sed -i "s/SafeShot v[0-9]*\.[0-9]*\.[0-9]*/SafeShot v$VERSION/g" src/renderer/welcome.html src/renderer/about.html
sed -i "s/Version: [0-9]*\.[0-9]*\.[0-9]*/Version: $VERSION/g" src/renderer/about.html

echo "Updated version to $VERSION"

# Commit if there are changes
if git diff --quiet && git diff --cached --quiet; then
  echo "No file changes, tagging current commit"
else
  git add -A
  if [ "$BUILD_TYPE" = "7" ]; then
    git commit -m "release v$VERSION"
  else
    git commit -m "v$VERSION"
  fi
fi

case $BUILD_TYPE in
  1) TAG="v$VERSION-beta-win" ;;
  2) TAG="v$VERSION-beta-mac-arm" ;;
  3) TAG="v$VERSION-beta-mac-x64" ;;
  4) TAG="v$VERSION-beta-mac" ;;
  5) TAG="v$VERSION-beta-linux" ;;
  6) TAG="v$VERSION-beta" ;;
  7) TAG="v$VERSION" ;;
  *) TAG="v$VERSION-beta" ;;
esac

git tag "$TAG"
git push origin HEAD
git push origin "$TAG"

echo ""
echo "Tagged: $TAG"
case $BUILD_TYPE in
  1) echo "Building: Windows only" ;;
  2) echo "Building: macOS ARM only" ;;
  3) echo "Building: macOS Intel only" ;;
  4) echo "Building: macOS ARM + Intel" ;;
  5) echo "Building: Linux only" ;;
  6) echo "Building: all platforms" ;;
  7) echo "Building: all platforms + GitHub Release"
     echo "Winget and Homebrew will update automatically after release" ;;
esac
echo "Check: https://github.com/mchiappinam/SafeShot/actions"
