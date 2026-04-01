import { Tray, Menu, app, shell, nativeImage } from 'electron';
import * as fs from 'fs';

export type TrayAction = 'capture' | 'open-folder' | 'about' | 'quit';

export interface TrayManager {
  create(): void;
  destroy(): void;
  setCapturing(active: boolean): void;
  onAction(cb: (action: TrayAction) => void): void;
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
    // Use an empty native image as placeholder; real icons will be in assets/tray/
    const icon = nativeImage.createEmpty();
    this.tray = new Tray(icon);
    this.tray.setToolTip('SafeShot');

    // Left-click triggers capture (Requirement 4.2)
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

  /** Disable left-click activation during Capture_Mode (Requirement 4.7) */
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
      {
        label: 'Capture Screenshot',
        click: () => this.emit('capture'),
      },
      {
        label: 'Open Save Folder',
        click: () => this.emit('open-folder'),
      },
      {
        label: 'About',
        click: () => this.emit('about'),
      },
      { type: 'separator' },
      {
        label: 'Quit SafeShot',
        click: () => this.emit('quit'),
      },
    ]);

    this.tray.setContextMenu(menu);
  }

  private async openSaveFolder(): Promise<void> {
    const dir = this.getSaveDirectory();
    // Create directory if it doesn't exist (Requirement 4.8)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    await shell.openPath(dir);
  }
}
