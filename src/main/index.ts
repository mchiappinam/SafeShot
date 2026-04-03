import { app, BrowserWindow, screen } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { SafeShotLifecycleManager } from './lifecycle-manager';
import { SafeShotHotkeyManager } from './hotkey-manager';
import { SafeShotTrayManager } from './tray-manager';
import { ScreenCapture } from './screen-capture';
import { registerIpcHandlers, unregisterIpcHandlers } from './ipc-handlers';
import { createSaveManager, getDefaultSaveDirectory } from './save-manager';
import { CAPTURE_START, ABOUT_OPEN } from '../shared/ipc-channels';

function log(msg: string): void {
  const line = `[${new Date().toISOString()}] [INFO] ${msg}\n`;
  try { fs.appendFileSync(path.join(app.getPath('userData'), 'safeshot.log'), line); } catch {}
}

const lifecycleManager = new SafeShotLifecycleManager();
const screenCapture = new ScreenCapture();
const saveManager = createSaveManager();
let hotkeyManager: SafeShotHotkeyManager | null = null;
if (!lifecycleManager.requestSingleInstance()) { process.exit(0); }
app.on('second-instance', () => {});

app.whenReady().then(async () => {
  try {
    await lifecycleManager.initialize();
    log('Lifecycle initialized');

    // Deny all permission requests (geolocation, notifications, etc.)
    const { session } = await import('electron');
    session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
      callback(false);
    });
    session.defaultSession.setPermissionCheckHandler(() => false);
    if (process.platform === 'win32') {
      try { (await import('./platform/windows')).applyPrtScnOverride(); log('PrtScn override applied'); } catch (e) { log('PrtScn override failed: ' + e); }
    }
    if (process.platform === 'darwin') {
      const m = await import('./platform/macos');
      if (!(await m.checkScreenRecordingPermission())) await m.requestScreenRecordingPermission();
    }
    let capturing = false;
    let overlayWindow: BrowserWindow | null = null;
    let displayCleanup: (() => void) | null = null;
    hotkeyManager = new SafeShotHotkeyManager(() => { void startCapture(); }, () => capturing);
    hotkeyManager.onConflict((c) => log('Hotkey conflict: ' + c.key));
    const trayManager = new SafeShotTrayManager(getDefaultSaveDirectory);
    trayManager.onAction((action) => {
      log('Tray action: ' + action);
      if (action === 'capture') void startCapture();
      else if (action === 'about' && overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.webContents.send(ABOUT_OPEN, {});
    });
    function onCaptureDone(): void {
      capturing = false; trayManager.setCapturing(false); unregisterIpcHandlers();
      if (displayCleanup) { displayCleanup(); displayCleanup = null; }
      overlayWindow = null; log('Capture done');
    }
    async function startCapture(): Promise<void> {
      if (capturing) return;
      capturing = true; trayManager.setCapturing(true); log('Starting capture');
      try {
        const screens = await screenCapture.captureAllDisplays();
        log('Captured ' + screens.length + ' displays');

        // Compute bounding rect of all displays for multi-monitor overlay
        const allDisplays = screen.getAllDisplays();
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const d of allDisplays) {
          minX = Math.min(minX, d.bounds.x);
          minY = Math.min(minY, d.bounds.y);
          maxX = Math.max(maxX, d.bounds.x + d.bounds.width);
          maxY = Math.max(maxY, d.bounds.y + d.bounds.height);
        }
        const totalWidth = maxX - minX;
        const totalHeight = maxY - minY;
        log('Overlay bounds: ' + minX + ',' + minY + ' ' + totalWidth + 'x' + totalHeight);

        overlayWindow = new BrowserWindow({
          x: minX, y: minY, width: totalWidth, height: totalHeight,
          frame: false, alwaysOnTop: true,
          skipTaskbar: true, resizable: false, focusable: true,
          fullscreenable: false, backgroundColor: '#000000',
          // kiosk mode covers taskbar on Windows
          kiosk: true,
          webPreferences: { contextIsolation: true, nodeIntegration: false, preload: path.join(__dirname, 'preload.js') },
        });
        overlayWindow.setAlwaysOnTop(true, 'screen-saver');
        overlayWindow.focus();
        const htmlPath = path.join(__dirname, '..', '..', 'renderer', 'index.html');
        log('Loading: ' + htmlPath + ' exists=' + fs.existsSync(htmlPath));
        overlayWindow.loadFile(htmlPath);
        registerIpcHandlers({ screenCapture, overlayWindow, onCaptureDone, onCopyRequest: () => {}, onPrintRequest: () => {},
          onSaveRequest: async (img: string, shift: boolean) => saveManager.saveScreenshot(img, { directory: getDefaultSaveDirectory(), showDialog: shift }),
        });
        overlayWindow.webContents.on('did-finish-load', () => { overlayWindow?.webContents.send(CAPTURE_START, { screens }); log('Sent capture:start'); });
        overlayWindow.on('closed', () => { if (capturing) onCaptureDone(); });
        const onChange = () => { if (capturing && overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.close(); };
        screen.on('display-added', onChange); screen.on('display-removed', onChange); screen.on('display-metrics-changed', onChange);
        displayCleanup = () => { screen.removeListener('display-added', onChange); screen.removeListener('display-removed', onChange); screen.removeListener('display-metrics-changed', onChange); };
      } catch (err) { log('Capture failed: ' + err); screenCapture.release(); onCaptureDone(); }
    }
    lifecycleManager.setOverlayCloseCallback(() => { if (overlayWindow && !overlayWindow.isDestroyed()) { overlayWindow.close(); overlayWindow = null; } });
    trayManager.create(); log('Tray created');
    hotkeyManager.register(); log('Hotkey registered');
    log('SafeShot ready');
  } catch (err) { log('FATAL: ' + err); }
});
app.on('before-quit', async (event) => {
  event.preventDefault(); hotkeyManager?.unregister();
  if (process.platform === 'win32') { try { (await import('./platform/windows')).restorePrtScnOverride(); } catch {} }
  await lifecycleManager.handleShutdown(); app.exit(0);
});
app.on('window-all-closed', () => {});
