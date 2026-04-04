#!/bin/bash
set -e

CURRENT=$(grep '"version"' package.json | head -1 | sed 's/.*"version": "\(.*\)".*/\1/')
echo "Latest Version Published: $CURRENT"
read -p "Enter new version: " VERSION

if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Invalid version format. Use semver like 1.1.0"
  exit 1
fi

echo ""
echo "  1) Windows only        (tag: v$VERSION-beta)"
echo "  2) macOS only          (tag: v$VERSION-beta-mac)"
echo "  3) Windows + macOS     (tag: v$VERSION-beta-all)"
echo "  4) Full release (both) (tag: v$VERSION)"
read -p "Choose [1]: " BUILD_TYPE
BUILD_TYPE=${BUILD_TYPE:-1}

# Update version in all files
sed -i "s/\"version\": \".*\"/\"version\": \"$VERSION\"/" package.json
sed -i "s/^version = \".*\"/version = \"$VERSION\"/" src-tauri/Cargo.toml
sed -i "s/\"version\": \".*\"/\"version\": \"$VERSION\"/" src-tauri/tauri.conf.json
sed -i "s/version=\"[0-9]*\.[0-9]*\.[0-9]*\"/version=\"$VERSION\"/" src/renderer/App.tsx
sed -i "s/SafeShot v[0-9]*\.[0-9]*\.[0-9]*/SafeShot v$VERSION/g" src/renderer/welcome.html src/renderer/about.html

echo "Updated version to $VERSION"

# Commit if there are changes
if git diff --quiet && git diff --cached --quiet; then
  echo "No file changes, tagging current commit"
else
  git add -A
  if [ "$BUILD_TYPE" = "4" ]; then
    git commit -m "Release v$VERSION"
  else
    git commit -m "v$VERSION"
  fi
fi

case $BUILD_TYPE in
  1) TAG="v$VERSION-beta" ;;
  2) TAG="v$VERSION-beta-mac" ;;
  3) TAG="v$VERSION-beta-all" ;;
  4) TAG="v$VERSION" ;;
  *) TAG="v$VERSION-beta" ;;
esac

git tag "$TAG"
git push origin main
git push origin "$TAG"

echo ""
echo "Tagged: $TAG"
case $BUILD_TYPE in
  1) echo "Building: Windows only" ;;
  2) echo "Building: macOS only" ;;
  3) echo "Building: Windows + macOS" ;;
  4) echo "Building: Windows + macOS + GitHub Release" ;;
esac
echo "Check: https://github.com/mchiappinam/SafeShot/actions"
