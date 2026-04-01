import { ipcMain, clipboard, nativeImage } from 'electron';
import type { BrowserWindow, WebContents } from 'electron';
import type { ScreenCapture } from './screen-capture';
import type { SaveResult } from '../shared/types';
import {
  CAPTURE_CANCEL,
  SAVE_REQUEST,
  SAVE_RESULT,
  COPY_REQUEST,
  PRINT_REQUEST,
  OVERLAY_CLOSE,
} from '../shared/ipc-channels';

export interface IpcHandlerDeps {
  screenCapture: ScreenCapture;
  overlayWindow: BrowserWindow | null;
  onCaptureDone: () => void;
  onCopyRequest: (imageDataURL: string) => void;
  onPrintRequest: (imageDataURL: string, webContents: WebContents) => void;
  onSaveRequest: (imageDataURL: string, shiftHeld: boolean) => Promise<SaveResult>;
}

/**
 * Registers all IPC handlers for the main process.
 * Requirements: 3.2, 7.6, 7.7, 7.8, 11.5, 14.2
 */
export function registerIpcHandlers(deps: IpcHandlerDeps): void {
  // ── capture:cancel ── R→M  User cancelled; clean up resources
  ipcMain.on(CAPTURE_CANCEL, () => {
    deps.screenCapture.release();
    deps.onCaptureDone();
    const win = deps.overlayWindow;
    if (win && !win.isDestroyed()) {
      win.close();
    }
  });

  // ── overlay:close ── R→M  Close the overlay window
  ipcMain.on(OVERLAY_CLOSE, () => {
    deps.screenCapture.release();
    deps.onCaptureDone();
    const win = deps.overlayWindow;
    if (win && !win.isDestroyed()) {
      win.close();
    }
  });

  // ── copy:request ── R→M  Copy selection to clipboard
  ipcMain.on(COPY_REQUEST, (_event, payload: { imageDataURL: string }) => {
    const { imageDataURL } = payload;
    clipboard.writeImage(nativeImage.createFromDataURL(imageDataURL));
    deps.onCopyRequest(imageDataURL);
    // Close the overlay after copying (Requirement 7.12)
    const win = deps.overlayWindow;
    if (win && !win.isDestroyed()) {
      deps.screenCapture.release();
      deps.onCaptureDone();
      win.close();
    }
  });

  // ── print:request ── R→M  Send selection to print dialog
  ipcMain.on(PRINT_REQUEST, (_event, payload: { imageDataURL: string }) => {
    const win = deps.overlayWindow;
    if (win && !win.isDestroyed()) {
      deps.onPrintRequest(payload.imageDataURL, win.webContents);
      win.webContents.print();
    }
  });

  // ── save:request ── R→M  Request save (quick or save-as)
  ipcMain.handle(SAVE_REQUEST, async (_event, payload: { imageDataURL: string; shiftHeld: boolean }) => {
    const { imageDataURL, shiftHeld } = payload;
    const result = await deps.onSaveRequest(imageDataURL, shiftHeld);

    // Send save:result back to renderer
    const win = deps.overlayWindow;
    if (win && !win.isDestroyed()) {
      win.webContents.send(SAVE_RESULT, {
        success: result.success,
        error: result.error,
        path: result.filePath,
      });
    }

    return result;
  });
}

/**
 * Removes all registered IPC handlers.
 * Call this when the overlay is torn down to prevent stale handlers.
 * Requirements: 11.5, 14.2
 */
export function unregisterIpcHandlers(): void {
  ipcMain.removeAllListeners(CAPTURE_CANCEL);
  ipcMain.removeAllListeners(OVERLAY_CLOSE);
  ipcMain.removeAllListeners(COPY_REQUEST);
  ipcMain.removeAllListeners(PRINT_REQUEST);
  ipcMain.removeHandler(SAVE_REQUEST);
}
