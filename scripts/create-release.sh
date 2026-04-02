#!/bin/bash
set -e

# Ask for version
read -p "Version (e.g. 1.0.5): " VERSION

if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Invalid version format. Use semver like 1.0.5"
  exit 1
fi

# Update package.json
sed -i "s/\"version\": \".*\"/\"version\": \"$VERSION\"/" package.json
echo "Updated package.json to $VERSION"

# Commit, tag, push
git add package.json
git commit -m "release: v$VERSION"
git tag "v$VERSION"
git push origin main
git push origin "v$VERSION"

echo ""
echo "Released v$VERSION — CI will build installers."
echo "Check: https://github.com/mchiappinam/SafeShot/actions"
