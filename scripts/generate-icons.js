const path = require('path');
const fs = require('fs');

async function main() {
  const sharp = require('sharp');

  const svg = `
    <svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#4A90D9;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#2C5F8A;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="1024" height="1024" rx="192" fill="url(#bg)"/>
      <text x="50%" y="52%" dominant-baseline="middle" text-anchor="middle"
            font-family="Arial,sans-serif" font-weight="bold" font-size="384" fill="white">SS</text>
      <circle cx="740" cy="280" r="96" fill="none" stroke="white" stroke-width="24"/>
      <circle cx="740" cy="280" r="40" fill="white"/>
    </svg>`;

  const outDir = path.resolve(__dirname, '..', 'src-tauri', 'icons');
  fs.mkdirSync(outDir, { recursive: true });

  // Tauri needs these specific sizes
  await sharp(Buffer.from(svg)).resize(32, 32).png().toFile(path.join(outDir, '32x32.png'));
  await sharp(Buffer.from(svg)).resize(128, 128).png().toFile(path.join(outDir, '128x128.png'));
  await sharp(Buffer.from(svg)).resize(256, 256).png().toFile(path.join(outDir, '128x128@2x.png'));
  await sharp(Buffer.from(svg)).resize(256, 256).png().toFile(path.join(outDir, 'icon.png'));

  // For Windows .ico — just use the 256x256 png, tauri-cli converts it
  await sharp(Buffer.from(svg)).resize(256, 256).png().toFile(path.join(outDir, 'icon.ico'));
  // For macOS .icns — same approach
  await sharp(Buffer.from(svg)).resize(512, 512).png().toFile(path.join(outDir, 'icon.icns'));

  console.log('Icons generated in src-tauri/icons/');
}

main().catch(err => { console.error(err); process.exit(1); });
