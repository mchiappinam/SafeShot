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

  const iconsDir = path.resolve(__dirname, '..', 'assets', 'icons');
  fs.mkdirSync(iconsDir, { recursive: true });
  await sharp(Buffer.from(svg)).resize(1024, 1024).png().toFile(path.join(iconsDir, 'icon.png'));
  console.log('Created assets/icons/icon.png');

  const trayDir = path.resolve(__dirname, '..', 'assets', 'tray');
  fs.mkdirSync(trayDir, { recursive: true });

  const traySvg = `
    <svg width="32" height="32" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="6" fill="#4A90D9"/>
      <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle"
            font-family="Arial,sans-serif" font-weight="bold" font-size="14" fill="white">SS</text>
    </svg>`;
  await sharp(Buffer.from(traySvg)).resize(32, 32).png().toFile(path.join(trayDir, 'tray-icon.png'));
  console.log('Created assets/tray/tray-icon.png');

  const templateSvg = `
    <svg width="22" height="22" xmlns="http://www.w3.org/2000/svg">
      <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle"
            font-family="Arial,sans-serif" font-weight="bold" font-size="11" fill="black">SS</text>
    </svg>`;
  await sharp(Buffer.from(templateSvg)).resize(22, 22).png().toFile(path.join(trayDir, 'tray-iconTemplate.png'));
  console.log('Created assets/tray/tray-iconTemplate.png');
  console.log('Done.');
}

main().catch(err => { console.error(err); process.exit(1); });
