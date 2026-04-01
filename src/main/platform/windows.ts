import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

const PRTSCN_HIVE = 'HKCU' as const;
const PRTSCN_SUBKEY = 'Control Panel\\Keyboard';
const PRTSCN_VALUE_NAME = 'PrintScreenKeyForSnippingEnabled';

function getBackupFilePath(): string {
  const appDataDir = path.join(app.getPath('appData'), 'SafeShot');
  return path.join(appDataDir, 'registry-backup.json');
}

function loadNativeAddon() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('../../native') as typeof import('../../native');
  } catch {
    return null;
  }
}

/**
 * Reads the current PrtScn registry value, backs it up, then sets it to 0
 * to disable the default Snipping Tool / Snip & Sketch PrtScn binding.
 * Requirements: 2.9, 2.11, 3.9
 */
export function applyPrtScnOverride(): void {
  const addon = loadNativeAddon();
  if (!addon) {
    console.warn('[windows] Native addon unavailable — skipping PrtScn override');
    return;
  }

  try {
    const current = addon.readRegistryDword(PRTSCN_HIVE, PRTSCN_SUBKEY, PRTSCN_VALUE_NAME);
    const previousValue = current ?? 1; // default Windows value is 1 (enabled)

    // Persist backup so uninstaller / restorePrtScnOverride can restore it
    const backupPath = getBackupFilePath();
    const backupDir = path.dirname(backupPath);
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    fs.writeFileSync(backupPath, JSON.stringify({ [PRTSCN_VALUE_NAME]: previousValue }), 'utf-8');

    addon.writeRegistryDword(PRTSCN_HIVE, PRTSCN_SUBKEY, PRTSCN_VALUE_NAME, 0);
    console.log(`[windows] PrtScn override applied (previous value: ${previousValue})`);
  } catch (err) {
    console.error('[windows] Failed to apply PrtScn override:', err);
  }
}

/**
 * Reads the backup file and restores the original PrtScn registry value.
 * Requirements: 2.10, 2.11
 */
export function restorePrtScnOverride(): void {
  const addon = loadNativeAddon();
  if (!addon) {
    console.warn('[windows] Native addon unavailable — skipping PrtScn restore');
    return;
  }

  const backupPath = getBackupFilePath();
  if (!fs.existsSync(backupPath)) {
    console.warn('[windows] No registry backup found — restoring default value (1)');
    try {
      addon.writeRegistryDword(PRTSCN_HIVE, PRTSCN_SUBKEY, PRTSCN_VALUE_NAME, 1);
    } catch (err) {
      console.error('[windows] Failed to restore PrtScn registry value:', err);
    }
    return;
  }

  try {
    const backup = JSON.parse(fs.readFileSync(backupPath, 'utf-8')) as Record<string, number>;
    const originalValue = backup[PRTSCN_VALUE_NAME] ?? 1;
    addon.writeRegistryDword(PRTSCN_HIVE, PRTSCN_SUBKEY, PRTSCN_VALUE_NAME, originalValue);
    console.log(`[windows] PrtScn registry restored to ${originalValue}`);
  } catch (err) {
    console.error('[windows] Failed to restore PrtScn override:', err);
  }
}
