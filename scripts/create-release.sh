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
echo "  1) Tag only (build, no GitHub Release)"
echo "  2) Full release (build + GitHub Release)"
read -p "Choose [1]: " RELEASE_TYPE
RELEASE_TYPE=${RELEASE_TYPE:-1}

# Update version in all files
sed -i "s/\"version\": \".*\"/\"version\": \"$VERSION\"/" package.json
sed -i "s/^version = \".*\"/version = \"$VERSION\"/" src-tauri/Cargo.toml
sed -i "s/\"version\": \".*\"/\"version\": \"$VERSION\"/" src-tauri/tauri.conf.json
sed -i "s/version=\"[0-9]*\.[0-9]*\.[0-9]*\"/version=\"$VERSION\"/" src/renderer/App.tsx
sed -i "s/SafeShot v[0-9]*\.[0-9]*\.[0-9]*/SafeShot v$VERSION/g" src/renderer/welcome.html src/renderer/about.html

echo "Updated version to $VERSION"

# Commit if there are changes, otherwise just tag
if git diff --quiet && git diff --cached --quiet; then
  echo "No file changes, tagging current commit"
else
  git add -A
  git commit -m "release: v$VERSION"
fi

if [[ "$RELEASE_TYPE" == "2" ]]; then
  TAG="v$VERSION"
  echo "Creating release tag: $TAG"
else
  TAG="v$VERSION-beta"
  echo "Creating beta tag: $TAG"
fi

git tag "$TAG"
git push origin main
git push origin "$TAG"

echo ""
if [[ "$RELEASE_TYPE" == "2" ]]; then
  echo "Released $TAG. CI will build installers and create a GitHub Release."
else
  echo "Tagged $TAG. CI will build installers (no GitHub Release)."
fi
echo "Check: https://github.com/mchiappinam/SafeShot/actions"
