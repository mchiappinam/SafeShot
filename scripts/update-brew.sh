#!/bin/bash
set -e

REPO="mchiappinam/SafeShot"
CASK_DIR=".kiro/homebrew-safeshot"
CASK_FILE="$CASK_DIR/Casks/safeshot.rb"

# Get version from package.json
VERSION=$(grep '"version"' package.json | head -1 | sed 's/.*"version": "\(.*\)".*/\1/')
echo "Updating brew cask to v$VERSION"

# Download DMGs and compute SHA256
INTEL_URL="https://github.com/$REPO/releases/download/v$VERSION/SafeShot-macOS-Intel-x64.dmg"
ARM_URL="https://github.com/$REPO/releases/download/v$VERSION/SafeShot-macOS-AppleSilicon-aarch64.dmg"

echo "Downloading Intel DMG..."
INTEL_SHA=$(curl -sL "$INTEL_URL" | sha256sum | awk '{print $1}')
echo "  SHA256: $INTEL_SHA"

echo "Downloading ARM DMG..."
ARM_SHA=$(curl -sL "$ARM_URL" | sha256sum | awk '{print $1}')
echo "  SHA256: $ARM_SHA"

# Verify we got real hashes (not a 404 page)
if [ ${#INTEL_SHA} -ne 64 ] || [ ${#ARM_SHA} -ne 64 ]; then
  echo "Error: failed to download DMGs. Is the release published?"
  exit 1
fi

# Write the cask file
cat > "$CASK_FILE" << EOF
cask "safeshot" do
  version "$VERSION"

  on_intel do
    url "https://github.com/$REPO/releases/download/v#{version}/SafeShot-macOS-Intel-x64.dmg"
    sha256 "$INTEL_SHA"
  end

  on_arm do
    url "https://github.com/$REPO/releases/download/v#{version}/SafeShot-macOS-AppleSilicon-aarch64.dmg"
    sha256 "$ARM_SHA"
  end

  name "SafeShot"
  desc "Privacy-first screenshot tool. No cloud, no tracking."
  homepage "https://github.com/$REPO"

  app "SafeShot.app"

  zap trash: [
    "~/Library/Application Support/SafeShot",
    "~/Library/LaunchAgents/com.chiappina.safeshot.plist",
  ]
end
EOF

echo "Updated $CASK_FILE"

# Commit and push
cd "$CASK_DIR"
git add -A
git commit -m "v$VERSION"
git push origin main
cd - > /dev/null

echo ""
echo "Brew cask updated and pushed."
echo "Users can now run: brew upgrade --cask safeshot"
