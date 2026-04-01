import { Tray, Menu, app, shell, nativeImage } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

export type TrayAction = 'capture' | 'open-folder' | 'about' | 'quit';

export interface TrayManager {
  create(): void;
  destroy(): void;
  setCapturing(active: boolean): void;
  onAction(cb: (action: TrayAction) => void): void;
}

/**
 * Loads the tray icon from assets, falling back to a programmatically
 * generated 16x16 blue square if the file doesn't exist.
 */
function loadTrayIcon(): Electron.NativeImage {
  // Try bundled asset first: assets/tray/tray-icon.png
  const assetPath = path.join(__dirname, '..', '..', 'assets', 'tray', 'tray-icon.png');
  if (fs.existsSync(assetPath)) {
    return nativeImage.createFromPath(assetPath);
  }

  // Fallback: generate a tiny 16x16 blue icon in memory
  const size = 16;
  const channels = 4; // RGBA
  const buf = Buffer.alloc(size * size * channels);
  for (let i = 0; i < size * size; i++) {
    buf[i * channels + 0] = 74;   // R
    buf[i * channels + 1] = 144;  // G
    buf[i * channels + 2] = 217;  // B
    buf[i * channels + 3] = 255;  // A
  }
  return nativeImage.createFromBuffer(buf, { width: size, height: size });
}

export class SafeShotTrayManager implements TrayManager {
  private tray: Tray | null = null;
  private capturing = false;
  private actionCallback: ((action: TrayAction) => void) | null = null;
  private readonly getSaveDirectory: () => string;

  constructor(getSaveDirectory: () => string) {
    this.getSaveDirectory = getSaveDirectory;
  }

  create(): void {
    const icon = loadTrayIcon();
    this.tray = new Tray(icon);
    this.tray.setToolTip('SafeShot');

    this.tray.on('click', () => {
      if (!this.capturing) {
        this.emit('capture');
      }
    });

    this.buildContextMenu();
  }

  destroy(): void {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
  }

  setCapturing(active: boolean): void {
    this.capturing = active;
  }

  onAction(cb: (action: TrayAction) => void): void {
    this.actionCallback = cb;
  }

  private emit(action: TrayAction): void {
    if (action === 'quit') {
      app.quit();
      return;
    }
    if (action === 'open-folder') {
      this.openSaveFolder();
      return;
    }
    this.actionCallback?.(action);
  }

  private buildContextMenu(): void {
    if (!this.tray) return;

    const menu = Menu.buildFromTemplate([
      { label: 'Capture Screenshot', click: () => this.emit('capture') },
      { label: 'Open Save Folder', click: () => this.emit('open-folder') },
      { label: 'About', click: () => this.emit('about') },
      { type: 'separator' },
      { label: 'Quit SafeShot', click: () => this.emit('quit') },
    ]);

    this.tray.setContextMenu(menu);
  }

  private async openSaveFolder(): Promise<void> {
    const dir = this.getSaveDirectory();
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    await shell.openPath(dir);
  }
}
