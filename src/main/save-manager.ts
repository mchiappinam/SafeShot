import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { dialog } from 'electron';
import type { SaveOptions, SaveResult } from '../shared/types';

const SCREENSHOT_PATTERN = /^Screenshot_(\d+)\.png$/;

/**
 * Returns the default save directory based on platform.
 * Windows: {user}/Images/SafeShot/, macOS: {user}/Pictures/SafeShot/
 * Requirement 8.1
 */
export function getDefaultSaveDirectory(): string {
  const home = os.homedir();
  return process.platform === 'win32'
    ? path.join(home, 'Images', 'SafeShot')
    : path.join(home, 'Pictures', 'SafeShot');
}

/** Creates directory if it doesn't exist. Requirement 8.2 */
export async function ensureDirectoryExists(directory: string): Promise<void> {
  await fs.promises.mkdir(directory, { recursive: true });
}

/**
 * Scans directory for Screenshot_{N}.png files and returns next filename.
 * Requirements 8.3, 8.4, 8.10
 */
export async function getNextFilename(directory: string): Promise<string> {
  let maxN = 0;
  try {
    const entries = await fs.promises.readdir(directory);
    for (const entry of entries) {
      const match = SCREENSHOT_PATTERN.exec(entry);
      if (match) {
        const n = parseInt(match[1], 10);
        if (n > maxN) maxN = n;
      }
    }
  } catch { maxN = 0; }
  return `Screenshot_${maxN + 1}.png`;
}

function dataURLToBuffer(dataURL: string): Buffer {
  return Buffer.from(dataURL.replace(/^data:image\/\w+;base64,/, ''), 'base64');
}

/**
 * Saves a screenshot from a base64 PNG data URL.
 * Requirements: 8.2–8.10
 */
export async function saveScreenshot(imageDataURL: string, options: SaveOptions): Promise<SaveResult> {
  try {
    const sharp = (await import('sharp')).default;

    if (options.showDialog) {
      const { filePath, canceled } = await dialog.showSaveDialog({
        title: 'Save Screenshot',
        defaultPath: path.join(options.directory, options.filename ?? await getNextFilename(options.directory)),
        filters: [{ name: 'PNG Image', extensions: ['png'] }],
      });
      if (canceled || !filePath) return { success: false, error: 'Save cancelled by user' };
      await sharp(dataURLToBuffer(imageDataURL)).png().toFile(filePath);
      return { success: true, filePath };
    }

    await ensureDirectoryExists(options.directory);
    const filename = options.filename ?? await getNextFilename(options.directory);
    const finalPath = path.join(options.directory, filename);
    // Use wx flag to fail if file already exists, then retry with next name
    const buffer = dataURLToBuffer(imageDataURL);
    const pngBuffer = await sharp(buffer).png().toBuffer();
    try {
      await fs.promises.writeFile(finalPath, pngBuffer, { flag: 'wx' });
    } catch (writeErr: unknown) {
      if ((writeErr as NodeJS.ErrnoException).code === 'EEXIST') {
        // File was created between getNextFilename and write — retry once
        const retryName = await getNextFilename(options.directory);
        const retryPath = path.join(options.directory, retryName);
        await fs.promises.writeFile(retryPath, pngBuffer, { flag: 'wx' });
        return { success: true, filePath: retryPath };
      }
      throw writeErr;
    }
    return { success: true, filePath: finalPath };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export interface SaveManager {
  getDefaultSaveDirectory(): string;
  getNextFilename(directory: string): Promise<string>;
  saveScreenshot(imageDataURL: string, options: SaveOptions): Promise<SaveResult>;
  ensureDirectoryExists(directory: string): Promise<void>;
}

export function createSaveManager(): SaveManager {
  return { getDefaultSaveDirectory, getNextFilename, saveScreenshot, ensureDirectoryExists };
}
