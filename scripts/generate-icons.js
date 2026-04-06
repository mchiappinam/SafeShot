const path = require('path');
const fs = require('fs');

async function main() {
  const sharp = require('sharp');

  // SafeShot logo: shield with camera lens
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
      <rect width="1024" height="1024" rx="200" fill="url(#bg)"/>
      <path d="M512 160 L800 280 L800 560 Q800 780 512 880 Q224 780 224 560 L224 280 Z"
            fill="none" stroke="url(#accent)" stroke-width="40" stroke-linejoin="round"/>
      <circle cx="512" cy="480" r="160" fill="none" stroke="white" stroke-width="32"/>
      <circle cx="512" cy="480" r="70" fill="white" opacity="0.9"/>
      <circle cx="480" cy="448" r="24" fill="white" opacity="0.4"/>
      <rect x="480" y="680" width="64" height="48" rx="6" fill="#2AE3FF"/>
      <path d="M496 680 L496 660 Q496 640 512 640 Q528 640 528 660 L528 680"
            fill="none" stroke="#2AE3FF" stroke-width="10" stroke-linecap="round"/>
    </svg>`;

  const outDir = path.resolve(__dirname, '..', 'src-tauri', 'icons');
  fs.mkdirSync(outDir, { recursive: true });

  // Tray icon: white shield only, no background, fills the icon area
  // Used for Windows system tray and macOS menu bar
  const traySvg = `
    <svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
      <path d="M512 40 L920 210 L920 560 Q920 850 512 990 Q104 850 104 560 L104 210 Z"
            fill="none" stroke="white" stroke-width="56" stroke-linejoin="round"/>
      <circle cx="512" cy="460" r="190" fill="none" stroke="white" stroke-width="44"/>
      <circle cx="512" cy="460" r="82" fill="white"/>
      <circle cx="474" cy="422" r="28" fill="white" opacity="0.4"/>
      <rect x="478" y="700" width="68" height="52" rx="8" fill="white"/>
      <path d="M494 700 L494 676 Q494 654 512 654 Q530 654 530 676 L530 700"
            fill="none" stroke="white" stroke-width="12" stroke-linecap="round"/>
    </svg>`;

  // Generate tray icon PNGs
  await sharp(Buffer.from(traySvg)).resize(32, 32).png().toFile(path.join(outDir, 'tray-icon.png'));
  await sharp(Buffer.from(traySvg)).resize(64, 64).png().toFile(path.join(outDir, 'tray-icon@2x.png'));

  // Standard PNG icons
  await sharp(Buffer.from(svg)).resize(32, 32).png().toFile(path.join(outDir, '32x32.png'));
  await sharp(Buffer.from(svg)).resize(128, 128).png().toFile(path.join(outDir, '128x128.png'));
  await sharp(Buffer.from(svg)).resize(256, 256).png().toFile(path.join(outDir, '128x128@2x.png'));
  await sharp(Buffer.from(svg)).resize(512, 512).png().toFile(path.join(outDir, 'icon.png'));
  await sharp(Buffer.from(svg)).resize(512, 512).png().toFile(path.join(outDir, 'icon.icns'));

  // Also copy high-res for the renderer logo
  await sharp(Buffer.from(svg)).resize(256, 256).png().toFile(path.resolve(outDir, '..', '..', 'src', 'renderer', 'logo.png'));

  // Windows ICO with multiple sizes for crisp rendering at all contexts
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const pngBuffers = await Promise.all(
    sizes.map(s => sharp(Buffer.from(svg)).resize(s, s).png().toBuffer())
  );
  const ico = createMultiIco(pngBuffers, sizes);
  fs.writeFileSync(path.join(outDir, 'icon.ico'), ico);

  console.log('Icons generated in src-tauri/icons/');
}

// Create an ICO file with multiple PNG images at different sizes
function createMultiIco(pngDataArray, sizes) {
  const count = pngDataArray.length;
  const headerSize = 6;
  const entrySize = 16;
  const entriesSize = entrySize * count;
  let dataOffset = headerSize + entriesSize;

  // Calculate total size
  let totalSize = dataOffset;
  for (const png of pngDataArray) totalSize += png.length;

  const buf = Buffer.alloc(totalSize);

  // ICO header
  buf.writeUInt16LE(0, 0);      // reserved
  buf.writeUInt16LE(1, 2);      // type: ICO
  buf.writeUInt16LE(count, 4);  // image count

  // Write entries and data
  let currentOffset = dataOffset;
  for (let i = 0; i < count; i++) {
    const s = sizes[i];
    const png = pngDataArray[i];
    const entryPos = headerSize + i * entrySize;

    buf.writeUInt8(s >= 256 ? 0 : s, entryPos);      // width
    buf.writeUInt8(s >= 256 ? 0 : s, entryPos + 1);   // height
    buf.writeUInt8(0, entryPos + 2);                   // color palette
    buf.writeUInt8(0, entryPos + 3);                   // reserved
    buf.writeUInt16LE(1, entryPos + 4);                // color planes
    buf.writeUInt16LE(32, entryPos + 6);               // bits per pixel
    buf.writeUInt32LE(png.length, entryPos + 8);       // image data size
    buf.writeUInt32LE(currentOffset, entryPos + 12);   // offset to data

    png.copy(buf, currentOffset);
    currentOffset += png.length;
  }

  return buf;
}

main().catch(err => { console.error(err); process.exit(1); });
