#!/bin/bash
set -e

CURRENT=$(grep '"version"' package.json | head -1 | sed 's/.*"version": "\(.*\)".*/\1/')
echo "Latest Version Published: $CURRENT"
read -p "Enter new version: " VERSION

if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Invalid version format. Use semver like 1.1.0"
  exit 1
fi

# Update version in all files
sed -i "s/\"version\": \".*\"/\"version\": \"$VERSION\"/" package.json
sed -i "s/^version = \".*\"/version = \"$VERSION\"/" src-tauri/Cargo.toml
sed -i "s/\"version\": \".*\"/\"version\": \"$VERSION\"/" src-tauri/tauri.conf.json
sed -i "s/version=\"[0-9]*\.[0-9]*\.[0-9]*\"/version=\"$VERSION\"/" src/renderer/App.tsx

echo "Updated version to $VERSION"

# Commit if there are changes, otherwise just tag
if git diff --quiet && git diff --cached --quiet; then
  echo "No file changes, tagging current commit"
else
  git add -A
  git commit -m "release: v$VERSION"
fi

git tag "v$VERSION"
git push origin main
git push origin "v$VERSION"

echo ""
echo "Released v$VERSION. CI will build installers."
echo "Check: https://github.com/mchiappinam/SafeShot/actions"
