import { app, session } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import * as https from 'https';

// ─── Types ───────────────────────────────────────────────────────────

export interface LifecycleManager {
  initialize(): Promise<void>;
  requestSingleInstance(): boolean;
  registerAutoLaunch(): Promise<void>;
  handleShutdown(): Promise<void>;
  handleError(error: Error): void;
}

// ─── Logging ─────────────────────────────────────────────────────────

function getLogPath(): string {
  return path.join(app.getPath('userData'), 'safeshot.log');
}

function writeLog(level: 'INFO' | 'ERROR', message: string): void {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] [${level}] ${message}\n`;
  try {
    fs.appendFileSync(getLogPath(), line, 'utf8');
  } catch {
    // Silently ignore log write failures — never crash on logging
  }
}

// ─── Network Isolation ───────────────────────────────────────────────

/**
 * Blocks all outbound network requests at the Electron session level.
 * Requirement 1.1, 1.2, 1.3, 1.5, 1.6
 */
function enforceNetworkIsolation(): void {
  // 1. Block all outbound requests via webRequest
  session.defaultSession.webRequest.onBeforeRequest(
    { urls: ['<all_urls>'] },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (_details: any, callback: any) => {
      callback({ cancel: true });
    }
  );

  // 2. Set strict CSP headers on all responses
  session.defaultSession.webRequest.onHeadersReceived(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (_details: any, callback: any) => {
      callback({
        responseHeaders: {
          'Content-Security-Policy': [
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; font-src 'self'; object-src 'none'; media-src 'none'; frame-src 'none'",
          ],
        },
      });
    }
  );

  // 3. Monkey-patch Node's http/https modules as defense-in-depth
  const networkError = new Error(
    'SafeShot: network access is disabled. All operations are strictly local.'
  );

  const blockRequest = (): never => {
    throw networkError;
  };

  // Patch http
  (http as unknown as Record<string, unknown>).request = blockRequest;
  (http as unknown as Record<string, unknown>).get = blockRequest;
  (http as unknown as Record<string, unknown>).createServer = blockRequest;

  // Patch https
  (https as unknown as Record<string, unknown>).request = blockRequest;
  (https as unknown as Record<string, unknown>).get = blockRequest;
  (https as unknown as Record<string, unknown>).createServer = blockRequest;

  // Patch Electron's net module if available
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const electronNet = require('electron').net;
    if (electronNet) {
      electronNet.request = blockRequest;
      electronNet.fetch = blockRequest;
    }
  } catch {
    // net module may not be available in all contexts
  }

  writeLog('INFO', 'Network isolation enforced.');
}

// ─── LifecycleManager Implementation ─────────────────────────────────

export class SafeShotLifecycleManager implements LifecycleManager {
  private overlayCloseCallback: (() => void) | null = null;

  /**
   * Register a callback to close the overlay window on error recovery.
   */
  setOverlayCloseCallback(cb: () => void): void {
    this.overlayCloseCallback = cb;
  }

  /**
   * Enforce single-instance lock. Returns false if another instance is running.
   * Requirement 14.3
   */
  requestSingleInstance(): boolean {
    const gotLock = app.requestSingleInstanceLock();
    if (!gotLock) {
      writeLog('INFO', 'Another instance is already running. Quitting.');
      app.quit();
      return false;
    }
    return true;
  }

  /**
   * Register the app to launch on system startup.
   * Requirement 2.3
   */
  async registerAutoLaunch(): Promise<void> {
    try {
      app.setLoginItemSettings({
        openAtLogin: true,
        openAsHidden: true,
      });
      writeLog('INFO', 'Auto-launch registered.');
    } catch (err) {
      writeLog('ERROR', `Failed to register auto-launch: ${err}`);
    }
  }

  /**
   * Full initialization sequence:
   * - Enforce network isolation
   * - Register auto-launch
   * - Set up unhandled error handlers
   * Requirement 1.1, 1.2, 1.3, 2.3, 14.5
   */
  async initialize(): Promise<void> {
    writeLog('INFO', 'SafeShot initializing...');

    enforceNetworkIsolation();
    await this.registerAutoLaunch();
    this.registerErrorHandlers();

    writeLog('INFO', 'SafeShot initialized.');
  }

  /**
   * Graceful shutdown within 2 seconds.
   * Requirement 14.4, 2.6
   */
  async handleShutdown(): Promise<void> {
    writeLog('INFO', 'Shutdown requested. Cleaning up...');

    return new Promise<void>((resolve) => {
      // Force-quit after 2 seconds regardless
      const timeout = setTimeout(() => {
        writeLog('INFO', 'Forced shutdown after 2s timeout.');
        resolve();
        app.exit(0);
      }, 2000);

      // Attempt graceful cleanup
      try {
        if (this.overlayCloseCallback) {
          this.overlayCloseCallback();
        }
      } catch (err) {
        writeLog('ERROR', `Error during shutdown cleanup: ${err}`);
      }

      // Cleanup succeeded — cancel the forced timeout and resolve
      clearTimeout(timeout);
      writeLog('INFO', 'Graceful shutdown complete.');
      resolve();
    });
  }

  /**
   * Unhandled error recovery: close overlay, log error, return to idle.
   * Requirement 14.5
   */
  handleError(error: Error): void {
    writeLog('ERROR', `Unhandled error: ${error.message}\n${error.stack ?? ''}`);

    try {
      if (this.overlayCloseCallback) {
        this.overlayCloseCallback();
      }
    } catch (closeErr) {
      writeLog('ERROR', `Failed to close overlay during error recovery: ${closeErr}`);
    }
  }

  /**
   * Register process-level unhandled error handlers.
   */
  private registerErrorHandlers(): void {
    process.on('uncaughtException', (error: Error) => {
      this.handleError(error);
    });

    process.on('unhandledRejection', (reason: unknown) => {
      const error =
        reason instanceof Error ? reason : new Error(String(reason));
      this.handleError(error);
    });
  }
}
