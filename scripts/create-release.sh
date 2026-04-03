#!/bin/bash
set -e

read -p "Version (e.g. 1.1.0): " VERSION

if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Invalid version format. Use semver like 1.1.0"
  exit 1
fi

# Update package.json
sed -i "s/\"version\": \".*\"/\"version\": \"$VERSION\"/" package.json

# Update Cargo.toml
sed -i "s/^version = \".*\"/version = \"$VERSION\"/" src-tauri/Cargo.toml

# Update tauri.conf.json
sed -i "s/\"version\": \".*\"/\"version\": \"$VERSION\"/" src-tauri/tauri.conf.json

echo "Updated version to $VERSION"

git add -A
git commit -m "release: v$VERSION"
git tag "v$VERSION"
git push origin main
git push origin "v$VERSION"

echo ""
echo "Released v$VERSION — CI will build installers."
echo "Check: https://github.com/mchiappinam/SafeShot/actions"
