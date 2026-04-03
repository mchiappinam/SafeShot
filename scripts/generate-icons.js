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

  // Standard PNG icons
  await sharp(Buffer.from(svg)).resize(32, 32).png().toFile(path.join(outDir, '32x32.png'));
  await sharp(Buffer.from(svg)).resize(128, 128).png().toFile(path.join(outDir, '128x128.png'));
  await sharp(Buffer.from(svg)).resize(256, 256).png().toFile(path.join(outDir, '128x128@2x.png'));
  await sharp(Buffer.from(svg)).resize(256, 256).png().toFile(path.join(outDir, 'icon.png'));
  // macOS .icns placeholder (Tauri converts from PNG)
  await sharp(Buffer.from(svg)).resize(512, 512).png().toFile(path.join(outDir, 'icon.icns'));

  // Windows .ico, must be actual ICO format
  // ICO format: header (6 bytes) + entry (16 bytes) + PNG data
  const pngBuf = await sharp(Buffer.from(svg)).resize(256, 256).png().toBuffer();
  const ico = createIco(pngBuf, 256, 256);
  fs.writeFileSync(path.join(outDir, 'icon.ico'), ico);

  console.log('Icons generated in src-tauri/icons/');
}

// Create a minimal ICO file containing one PNG image
function createIco(pngData, width, height) {
  const headerSize = 6;
  const entrySize = 16;
  const dataOffset = headerSize + entrySize;
  const totalSize = dataOffset + pngData.length;

  const buf = Buffer.alloc(totalSize);

  // ICO header
  buf.writeUInt16LE(0, 0);      // reserved
  buf.writeUInt16LE(1, 2);      // type: 1 = ICO
  buf.writeUInt16LE(1, 4);      // count: 1 image

  // ICO directory entry
  buf.writeUInt8(width >= 256 ? 0 : width, 6);   // width (0 = 256)
  buf.writeUInt8(height >= 256 ? 0 : height, 7);  // height (0 = 256)
  buf.writeUInt8(0, 8);         // color palette
  buf.writeUInt8(0, 9);         // reserved
  buf.writeUInt16LE(1, 10);     // color planes
  buf.writeUInt16LE(32, 12);    // bits per pixel
  buf.writeUInt32LE(pngData.length, 14);  // image data size
  buf.writeUInt32LE(dataOffset, 18);      // offset to image data

  // PNG data
  pngData.copy(buf, dataOffset);

  return buf;
}

main().catch(err => { console.error(err); process.exit(1); });
