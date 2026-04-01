import { describe, it, expect } from 'vitest';
import { getNextFilename, getDefaultSaveDirectory } from '../../src/main/save-manager';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

describe('getDefaultSaveDirectory', () => {
  it('returns a path ending in SafeShot', () => {
    const dir = getDefaultSaveDirectory();
    expect(dir.endsWith('SafeShot')).toBe(true);
  });

  it('uses Pictures on macOS, Images on Windows', () => {
    const dir = getDefaultSaveDirectory();
    const home = os.homedir();
    if (process.platform === 'darwin') {
      expect(dir).toBe(path.join(home, 'Pictures', 'SafeShot'));
    } else if (process.platform === 'win32') {
      expect(dir).toBe(path.join(home, 'Images', 'SafeShot'));
    }
  });
});

describe('getNextFilename', () => {
  it('returns Screenshot_1.png for empty directory', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'safeshot-test-'));
    try {
      const name = await getNextFilename(tmpDir);
      expect(name).toBe('Screenshot_1.png');
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it('returns Screenshot_4.png when max existing is 3', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'safeshot-test-'));
    try {
      fs.writeFileSync(path.join(tmpDir, 'Screenshot_1.png'), '');
      fs.writeFileSync(path.join(tmpDir, 'Screenshot_3.png'), '');
      fs.writeFileSync(path.join(tmpDir, 'Screenshot_2.png'), '');
      const name = await getNextFilename(tmpDir);
      expect(name).toBe('Screenshot_4.png');
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it('ignores non-matching files', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'safeshot-test-'));
    try {
      fs.writeFileSync(path.join(tmpDir, 'other.png'), '');
      fs.writeFileSync(path.join(tmpDir, 'Screenshot_abc.png'), '');
      const name = await getNextFilename(tmpDir);
      expect(name).toBe('Screenshot_1.png');
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it('returns Screenshot_1.png for non-existent directory', async () => {
    const name = await getNextFilename('/tmp/safeshot-nonexistent-dir-xyz');
    expect(name).toBe('Screenshot_1.png');
  });
});
