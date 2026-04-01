# SafeShot

Privacy-first screenshot tool for Windows and macOS. Inspired by similar tools.

Fast screen capture with area selection, annotation tools, and local-only save/copy/print. Zero network capabilities — no cloud, no telemetry, no tracking. Your screenshots stay yours.

## Features

- **PrtScn key** or system tray icon to trigger capture
- **Area selection** with resize handles and move support
- **Annotation tools**: pencil, line, sharpie, circle, triangle, octagon
- **Color picker** with 14 preset colors and custom hex input
- **Save** (auto-increment filenames), **copy to clipboard**, **print**
- **Undo/redo** for annotations
- **Multi-monitor** support with per-display DPI handling
- **Network isolation** enforced at multiple levels

## Tech Stack

Electron 30+ · React 18 · TypeScript · Canvas 2D · sharp · Vitest + fast-check

## Build

```bash
npm install
node scripts/generate-icons.js
npx tsc -p tsconfig.main.json
npx vite build
npx electron-builder --win nsis    # Windows installer
npx electron-builder --mac dmg     # macOS (requires Mac)
npx electron-builder --linux AppImage  # Linux
```

## Development

```bash
npm install
npm test              # Run all tests
npm run dev           # Dev mode (renderer + main watch)
npx electron dist/main/main/index.js  # Run compiled app
```

## License

MIT — see [LICENSE](LICENSE)

## Author

Developed by [Matheus Chiappina](https://chiappina.com)
