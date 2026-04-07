#!/bin/bash
set -e

CURRENT=$(grep '"version"' package.json | head -1 | sed 's/.*"version": "\(.*\)".*/\1/')
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
echo "  5) Windows + macOS both      (tag: v$VERSION-beta)"
echo "  6) Full release (all)        (tag: v$VERSION)"
read -p "Choose [5]: " BUILD_TYPE
BUILD_TYPE=${BUILD_TYPE:-5}

# Update version in all files
sed -i "s/\"version\": \".*\"/\"version\": \"$VERSION\"/" package.json
sed -i "s/^version = \".*\"/version = \"$VERSION\"/" src-tauri/Cargo.toml
sed -i "s/\"version\": \".*\"/\"version\": \"$VERSION\"/" src-tauri/tauri.conf.json
sed -i "s/SafeShot v[0-9]*\.[0-9]*\.[0-9]*/SafeShot v$VERSION/g" src/renderer/welcome.html src/renderer/about.html

echo "Updated version to $VERSION"

# Commit if there are changes
if git diff --quiet && git diff --cached --quiet; then
  echo "No file changes, tagging current commit"
else
  git add -A
  if [ "$BUILD_TYPE" = "6" ]; then
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
  5) TAG="v$VERSION-beta" ;;
  6) TAG="v$VERSION" ;;
  *) TAG="v$VERSION-beta" ;;
esac

git tag "$TAG"
git push origin main
git push origin "$TAG"

echo ""
echo "Tagged: $TAG"
case $BUILD_TYPE in
  1) echo "Building: Windows only" ;;
  2) echo "Building: macOS ARM only" ;;
  3) echo "Building: macOS Intel only" ;;
  4) echo "Building: macOS ARM + Intel" ;;
  5) echo "Building: Windows + macOS ARM + Intel" ;;
  6) echo "Building: all platforms + GitHub Release" ;;
esac
echo "Check: https://github.com/mchiappinam/SafeShot/actions"
