import { globalShortcut, app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

// ─── Types ───────────────────────────────────────────────────────────

export interface HotkeyConflict {
  key: string;
  conflictingApp?: string;
}

export interface HotkeyManager {
  register(): void;
  unregister(): void;
  onConflict(cb: (error: HotkeyConflict) => void): void;
}

// ─── Logging ─────────────────────────────────────────────────────────

function writeLog(level: 'INFO' | 'ERROR', message: string): void {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] [${level}] ${message}\n`;
  try {
    const logPath = path.join(app.getPath('userData'), 'safeshot.log');
    fs.appendFileSync(logPath, line, 'utf8');
  } catch {
    // Silently ignore log write failures — never crash on logging
  }
}

// ─── HotkeyManager Implementation ────────────────────────────────────

export class SafeShotHotkeyManager implements HotkeyManager {
  private readonly key = 'PrintScreen';
  private conflictCallback: ((error: HotkeyConflict) => void) | null = null;
  private onCapture: () => void;
  private isCapturing: () => boolean;

  /**
   * @param onCapture   Called when PrtScn is pressed and not already capturing.
   * @param isCapturing Returns true when the app is already in Capture_Mode.
   *                    Requirement 3.7 — ignore PrtScn if already capturing.
   */
  constructor(onCapture: () => void, isCapturing: () => boolean) {
    this.onCapture = onCapture;
    this.isCapturing = isCapturing;
  }

  /**
   * Register PrtScn as a global hotkey.
   * Requirement 3.1, 3.8, 3.9
   */
  register(): void {
    const registered = globalShortcut.register(this.key, () => {
      // Requirement 3.7 — ignore additional PrtScn presses while in Capture_Mode
      if (this.isCapturing()) {
        writeLog('INFO', `HotkeyManager: PrtScn ignored — already in Capture_Mode.`);
        return;
      }
      this.onCapture();
    });

    if (!registered) {
      // Requirement 3.8 — log conflict and emit event for alternative hotkey config
      const conflict: HotkeyConflict = { key: this.key };
      writeLog(
        'ERROR',
        `HotkeyManager: Failed to register '${this.key}' — another application may have claimed it.`
      );
      if (this.conflictCallback) {
        this.conflictCallback(conflict);
      }
    } else {
      writeLog('INFO', `HotkeyManager: '${this.key}' registered successfully.`);
    }
  }

  /**
   * Unregister PrtScn on quit.
   * Requirement 3.1
   */
  unregister(): void {
    globalShortcut.unregister(this.key);
    writeLog('INFO', `HotkeyManager: '${this.key}' unregistered.`);
  }

  /**
   * Register a callback invoked when hotkey registration fails due to a conflict.
   * Requirement 3.8
   */
  onConflict(cb: (error: HotkeyConflict) => void): void {
    this.conflictCallback = cb;
  }
}
