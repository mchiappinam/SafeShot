import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import { SafeShotLifecycleManager } from './lifecycle-manager';
import { SafeShotHotkeyManager } from './hotkey-manager';
import { SafeShotTrayManager } from './tray-manager';
import { ScreenCapture } from './screen-capture';
import { registerIpcHandlers, unregisterIpcHandlers } from './ipc-handlers';
import { createSaveManager, getDefaultSaveDirectory } from './save-manager';
import { CAPTURE_START } from '../shared/ipc-channels';

// ─── App Bootstrap ───────────────────────────────────────────────────

const lifecycleManager = new SafeShotLifecycleManager();
const screenCapture = new ScreenCapture();
const saveManager = createSaveManager();
let hotkeyManager: SafeShotHotkeyManager | null = null;

// Enforce single-instance lock before anything else
if (!lifecycleManager.requestSingleInstance()) {
  // Another instance is running; app.quit() was already called inside
  // requestSingleInstance(). Nothing more to do.
  process.exit(0);
}

// When a second instance tries to launch, focus the existing window
app.on('second-instance', () => {
  // Future: focus the overlay or tray icon
});

app.whenReady().then(async () => {
  await lifecycleManager.initialize();

  let capturing = false;

  hotkeyManager = new SafeShotHotkeyManager(
    () => {
      // onCapture: triggered when PrtScn is pressed and not already capturing
      void startCapture();
    },
    () => capturing
  );

  hotkeyManager.onConflict((conflict) => {
    // Surface conflict to TrayManager so user can configure an alternative hotkey
    console.warn(`Hotkey conflict for '${conflict.key}'`, conflict);
  });

  const trayManager = new SafeShotTrayManager(getDefaultSaveDirectory);

  trayManager.onAction((action) => {
    if (action === 'capture') {
      void startCapture();
    }
    // 'about' and 'open-folder' are handled inside TrayManager
  });

  // ── Capture flow ────────────────────────────────────────────────────

  /** Called when the overlay is done (closed, cancelled, or after save/copy). */
  function onCaptureDone(): void {
    capturing = false;
    trayManager.setCapturing(false);
    unregisterIpcHandlers();
    overlayWindow = null;
  }

  async function startCapture(): Promise<void> {
    if (capturing) return;
    capturing = true;
    trayManager.setCapturing(true);

    try {
      const screens = await screenCapture.captureAllDisplays();

      // Create the overlay window (frameless, transparent, always-on-top)
      overlayWindow = new BrowserWindow({
        fullscreen: true,
        transparent: true,
        frame: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: false,
        focusable: true,
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
          preload: path.join(__dirname, 'preload.js'),
        },
      });

      // Register IPC handlers now that we have the overlay window
      registerIpcHandlers({
        screenCapture,
        overlayWindow,
        onCaptureDone,
        onCopyRequest: (_imageDataURL) => {
          // Copy already handled inside registerIpcHandlers via clipboard.writeImage
        },
        onPrintRequest: (_imageDataURL, _webContents) => {
          // Print is dispatched via webContents.print() inside registerIpcHandlers
        },
        onSaveRequest: async (imageDataURL, shiftHeld) => {
          return saveManager.saveScreenshot(imageDataURL, {
            directory: getDefaultSaveDirectory(),
            showDialog: shiftHeld,
          });
        },
      });

      // Send captured screen data to renderer
      overlayWindow.webContents.on('did-finish-load', () => {
        overlayWindow?.webContents.send(CAPTURE_START, { screens });
      });

      overlayWindow.on('closed', () => {
        if (capturing) {
          onCaptureDone();
        }
      });

      // Cancel capture if display configuration changes during Capture_Mode (Requirement 10.6)
      const onDisplayChange = () => {
        if (capturing && overlayWindow && !overlayWindow.isDestroyed()) {
          overlayWindow.close();
        }
      };
      const { screen } = await import('electron');
      screen.once('display-added', onDisplayChange);
      screen.once('display-removed', onDisplayChange);
      screen.once('display-metrics-changed', onDisplayChange);

    } catch (err) {
      console.error('Capture failed:', err);
      screenCapture.release();
      onCaptureDone();
    }
  }

  // Register overlay close callback for error recovery and shutdown
  let overlayWindow: BrowserWindow | null = null;
  lifecycleManager.setOverlayCloseCallback(() => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.close();
      overlayWindow = null;
    }
  });

  // Start core services
  trayManager.create();
  hotkeyManager.register();

  // macOS: re-create tray/services if the dock icon is clicked and no windows open
  app.on('activate', () => {
    // No-op for SafeShot — it's a tray-only app with no dock presence
  });
});

// ─── Shutdown Handling ───────────────────────────────────────────────

app.on('before-quit', async (event) => {
  event.preventDefault();
  hotkeyManager?.unregister();
  await lifecycleManager.handleShutdown();
  app.exit(0);
});

// macOS: keep the process alive when all windows are closed (tray app)
app.on('window-all-closed', () => {
  // Do NOT quit — SafeShot lives in the tray
});
