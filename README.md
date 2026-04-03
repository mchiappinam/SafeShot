# SafeShot

Privacy-first screenshot tool for Windows and macOS. Inspired by similar tools.

Fast screen capture with area selection, annotation tools, and local-only save/copy. Zero network capabilities, no cloud, no telemetry, no tracking.

## Features

- PrtScn key or system tray icon to trigger capture
- Area selection with resize handles and move support
- Annotation tools: pencil, line, sharpie, circle, triangle, octagon
- Color picker with 14 preset colors and custom hex input
- Save (auto-increment filenames), copy to clipboard
- Undo/redo for annotations
- Multi-monitor support

## Tech Stack

Tauri 2 (Rust) · React 18 · TypeScript · Canvas 2D · Vitest + fast-check

## Build

Requires: Rust toolchain, Node.js 20+

```bash
npm install
node scripts/generate-icons.js
npx tauri build
```

Output: `src-tauri/target/release/bundle/nsis/` (Windows) or `src-tauri/target/release/bundle/dmg/` (macOS)

## Development

```bash
npm install
npx tauri dev
```

## License

MIT, see [LICENSE](LICENSE)

## Author

Developed by [Matheus Chiappina](https://chiappina.com)
