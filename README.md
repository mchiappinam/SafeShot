<p align="center">
  <img src="src-tauri/icons/icon.png" width="80" alt="SafeShot" />
</p>

<h1 align="center">SafeShot</h1>

<p align="center">
  <strong>Privacy-first screenshot tool</strong><br>
  Your screenshots stay yours. No cloud. No tracking. No compromises.
</p>

<p align="center">
  <a href="https://github.com/mchiappinam/SafeShot/releases/latest">
    <img src="https://img.shields.io/github/v/release/mchiappinam/SafeShot?color=2322F0&label=Download&style=for-the-badge" alt="Download" />
  </a>
</p>

---

## What is SafeShot?

SafeShot is a lightweight screenshot tool that lives in your system tray. Capture any area of your screen, annotate it, and save or copy instantly. Everything stays on your computer, nothing is ever uploaded anywhere.

## Why SafeShot?

We got tired of screenshot tools that phone home, upload your images to unknown servers, or come bundled with trackers and bloatware. Many popular alternatives are developed overseas with questionable privacy practices and opaque data handling.

SafeShot is different. Built in the USA ![US](src-tauri/icons/us.png) with security as the foundation, not an afterthought. The app has zero network capabilities by design. It physically cannot connect to the internet. Your screenshots never leave your machine, period.

Oh, and the installer is under 4 MB.

## Platform Support

| Platform | Status |
|----------|--------|
| Windows 10+ | ✅ Passed QA |
| macOS 11+ (Intel) | ✅ Passed QA |
| macOS 11+ (Apple Silicon) | 🔶 Untested |
| Ubuntu / Debian | 🔶 Untested |
| Fedora / Arch / Other | 🔶 Untested |

All downloads available on the [releases page](https://github.com/mchiappinam/SafeShot/releases/latest).

🔶 Untested platforms are built from the same codebase and should work, but haven't been verified yet. If you run into issues, please [open an issue](https://github.com/mchiappinam/SafeShot/issues).

## Download and Install

### Windows (winget)

```
winget install SafeShot
```

### macOS (Homebrew)

```
brew install mchiappinam/safeshot/safeshot
```

### Manual install

1. Go to the [latest release](https://github.com/mchiappinam/SafeShot/releases/latest)
2. Download the installer for your platform
3. Run the installer and follow the prompts
4. SafeShot will appear in your system tray (near the clock)

SafeShot starts automatically when your computer boots. You can toggle this from the tray menu.

## How to Use

### Capture a Screenshot
- Press **Print Screen** (Windows/Linux) or **⌘⇧S** (macOS), or
- Click the **SafeShot icon** in your system tray

### Select an Area
- Click and drag to select the area you want to capture
- Drag the edges or corners to resize
- Drag inside the selection to move it
- Press **Ctrl+A** (Windows/Linux) or **⌘A** (macOS) to select the entire screen

### Annotation Tools
Once you've selected an area, a toolbar appears with drawing tools:

| Tool | Description |
|------|-------------|
| ✥ Move Selection | Move or resize the selected area |
| ✋ Move Objects | Move annotations around |
| 💧 Pick Color | Sample a color from the screen |
| 🖊 Sharpie | Freehand drawing |
| 🖍️ Highlighter | Semi-transparent marker |
| ╱ Line | Straight line |
| ➜ Arrow | Line with arrowhead |
| ▢ Rectangle | Rectangle shape |
| ○ Circle | Ellipse shape |
| △ Triangle | Triangle shape |
| ⬡ Octagon | Regular octagon |
| T Text | Click to type text |
| 🎨 Color | Pick a color |
| ⚙ Settings | Thickness, fill mode, selection presets |

### Save and Copy
- **Ctrl+C** / **⌘C** copies the screenshot to your clipboard
- **Ctrl+S** / **⌘S** quick saves to Pictures/SafeShot
- **Ctrl+B** / **⌘B** opens a Save As dialog
- **Ctrl+Z** / **⌘Z** and **Ctrl+Y** / **⌘Y** for undo and redo
- **ESC** to cancel and close

### Tray Menu
Right-click the SafeShot icon in your system tray for:
- Capture Screenshot
- Open Save Folder
- Start on Boot (toggle)
- How to Use
- Settings
- About
- Quit

## Features

- Instant screen capture with area selection
- 12 annotation tools with color picker and thickness control
- Solid, hollow, blur, or redact shapes
- Blur pixelates content underneath a shape
- Redact auto-detects text lines and covers them with bars
- Multi-monitor support
- Keyboard shortcuts for everything
- Auto-start on boot
- Saves to your Pictures/SafeShot folder
- Remembers your last color, thickness, tool, and fill mode
- Selection presets: custom, last used, full screen, or fixed sizes
- Optional cursor capture in screenshots
- Configurable hotkey
- Custom save folders for quick save and Save As
- Tiny installer (~4 MB)
- Zero network access, fully offline

## Privacy

SafeShot has **zero network capabilities**. It cannot connect to the internet. Your screenshots are never uploaded, shared, or tracked. Everything stays on your local machine.

## System Requirements

- Windows 10 or later
- macOS 11 (Big Sur) or later
- Linux with WebKitGTK 4.1
- ~20 MB disk space

## Linux Notes

- Works best on X11. Wayland support depends on your desktop environment and may have limitations with screen capture and clipboard.
- The Print Screen shortcut may be intercepted by your desktop environment's built-in screenshot tool (GNOME, KDE). You may need to disable it in your DE settings or use SafeShot from the tray icon instead.
- The `.deb` package requires `libwebkit2gtk-4.1` and `libappindicator3-1` as dependencies.
- The `.AppImage` is self-contained and should run on most distributions.

## License

Free for personal use. Commercial use requires a license. See [LICENSE](LICENSE).

## Author

Developed by [Matheus Chiappina](https://chiappina.com)
