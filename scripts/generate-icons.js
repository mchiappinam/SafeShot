const path = require('path');
const fs = require('fs');

async function main() {
  const sharp = require('sharp');

  // SafeShot logo: shield with camera lens, using Brand brand colors
  const svg = `
    <svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#2322F0;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#020A51;stop-opacity:1" />
        </linearGradient>
        <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#2AE3FF;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#2322F0;stop-opacity:1" />
        </linearGradient>
      </defs>
      <!-- Rounded square background -->
      <rect width="1024" height="1024" rx="200" fill="url(#bg)"/>
      <!-- Shield shape -->
      <path d="M512 160 L800 280 L800 560 Q800 780 512 880 Q224 780 224 560 L224 280 Z"
            fill="none" stroke="url(#accent)" stroke-width="40" stroke-linejoin="round"/>
      <!-- Camera lens (outer ring) -->
      <circle cx="512" cy="480" r="160" fill="none" stroke="white" stroke-width="32"/>
      <!-- Camera lens (inner circle) -->
      <circle cx="512" cy="480" r="70" fill="white" opacity="0.9"/>
      <!-- Camera lens (highlight) -->
      <circle cx="480" cy="448" r="24" fill="white" opacity="0.4"/>
      <!-- Lock icon at bottom of shield -->
      <rect x="480" y="680" width="64" height="48" rx="6" fill="#2AE3FF"/>
      <path d="M496 680 L496 660 Q496 640 512 640 Q528 640 528 660 L528 680"
            fill="none" stroke="#2AE3FF" stroke-width="10" stroke-linecap="round"/>
    </svg>`;

  const outDir = path.resolve(__dirname, '..', 'src-tauri', 'icons');
  fs.mkdirSync(outDir, { recursive: true });

  await sharp(Buffer.from(svg)).resize(32, 32).png().toFile(path.join(outDir, '32x32.png'));
  await sharp(Buffer.from(svg)).resize(128, 128).png().toFile(path.join(outDir, '128x128.png'));
  await sharp(Buffer.from(svg)).resize(256, 256).png().toFile(path.join(outDir, '128x128@2x.png'));
  await sharp(Buffer.from(svg)).resize(256, 256).png().toFile(path.join(outDir, 'icon.png'));
  await sharp(Buffer.from(svg)).resize(512, 512).png().toFile(path.join(outDir, 'icon.icns'));

  const pngBuf = await sharp(Buffer.from(svg)).resize(256, 256).png().toBuffer();
  const ico = createIco(pngBuf, 256, 256);
  fs.writeFileSync(path.join(outDir, 'icon.ico'), ico);

  console.log('Icons generated in src-tauri/icons/');
}

function createIco(pngData, width, height) {
  const headerSize = 6;
  const entrySize = 16;
  const dataOffset = headerSize + entrySize;
  const totalSize = dataOffset + pngData.length;
  const buf = Buffer.alloc(totalSize);
  buf.writeUInt16LE(0, 0);
  buf.writeUInt16LE(1, 2);
  buf.writeUInt16LE(1, 4);
  buf.writeUInt8(width >= 256 ? 0 : width, 6);
  buf.writeUInt8(height >= 256 ? 0 : height, 7);
  buf.writeUInt8(0, 8);
  buf.writeUInt8(0, 9);
  buf.writeUInt16LE(1, 10);
  buf.writeUInt16LE(32, 12);
  buf.writeUInt32LE(pngData.length, 14);
  buf.writeUInt32LE(dataOffset, 18);
  pngData.copy(buf, dataOffset);
  return buf;
}

main().catch(err => { console.error(err); process.exit(1); });
