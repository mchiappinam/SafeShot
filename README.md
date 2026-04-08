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

| Platform | Status | File to download |
|----------|--------|------------------|
| Windows 10+ | ✅ Passed QA | `SafeShot-Windows-x64.exe` |
| macOS 11+ (Intel) | ✅ Passed QA | `SafeShot-macOS-Intel-x64.dmg` |
| macOS 11+ (Apple Silicon) | 🔶 Untested | `SafeShot-macOS-AppleSilicon-aarch64.dmg` |
| Ubuntu / Debian | 🔶 Untested | `SafeShot-Linux-amd64.deb` |
| Fedora / Arch / Other | 🔶 Untested | `SafeShot-Linux-amd64.AppImage` |

All downloads available on the [releases page](https://github.com/mchiappinam/SafeShot/releases/latest).

🔶 Untested platforms are built from the same codebase and should work, but haven't been verified yet. If you run into issues, please [open an issue](https://github.com/mchiappinam/SafeShot/issues).

## Download and Install

1. Go to the [latest release](https://github.com/mchiappinam/SafeShot/releases/latest)
2. Download the installer for your platform
3. Run the installer and follow the prompts
4. SafeShot will appear in your system tray (near the clock)

SafeShot starts automatically when your computer boots. You can toggle this from the tray menu.

## How to Use

### Capture a Screenshot
- Press **Print Screen** (Windows) or **⌘⇧S** (macOS), or
- Click the **SafeShot icon** in your system tray

### Select an Area
- Click and drag to select the area you want to capture
- Drag the edges or corners to resize
- Drag inside the selection to move it
- Press **Ctrl+A** (Windows) or **⌘A** (macOS) to select the entire screen

### Annotation Tools
Once you've selected an area, a toolbar appears with drawing tools:

| Tool | Description |
|------|-------------|
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
| ◻/◼ Solid | Toggle filled or hollow shapes |
| 🎨 Color | Pick a color |
| ⚪ Thickness | Adjust stroke width |

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
- About
- Quit

## Features

- Instant screen capture with area selection
- 10 annotation tools with color picker and thickness control
- Solid or hollow shapes
- Multi-monitor support
- Keyboard shortcuts for everything
- Auto-start on boot
- Saves to your Pictures/SafeShot folder
- Remembers your last color and thickness
- Tiny installer (~4 MB)
- Zero network access, fully offline

## Privacy

SafeShot has **zero network capabilities**. It cannot connect to the internet. Your screenshots are never uploaded, shared, or tracked. Everything stays on your local machine.

## System Requirements

- Windows 10 or later
- macOS 11 (Big Sur) or later
- Linux with WebKitGTK 4.1
- ~20 MB disk space

## License

Proprietary. Free to use, no distribution or modification permitted. See [LICENSE](LICENSE).

## Author

Developed by [Matheus Chiappina](https://chiappina.com)
