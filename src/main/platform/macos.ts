import { systemPreferences, dialog, shell, app } from 'electron';

const SCREEN_RECORDING_URL =
  'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture';

/**
 * Checks whether the app has been granted screen recording permission on macOS.
 * Returns true if access is granted, false otherwise.
 * Requirements: 2.7
 */
export async function checkScreenRecordingPermission(): Promise<boolean> {
  if (process.platform !== 'darwin') {
    return true;
  }

  try {
    const status = systemPreferences.getMediaAccessStatus('screen');
    return status === 'granted';
  } catch (err) {
    console.error('[macos] Failed to check screen recording permission:', err);
    return false;
  }
}

/**
 * Shows a dialog explaining that screen recording permission is required,
 * with a button to open System Settings > Privacy > Screen Recording.
 * Requirements: 2.8
 */
export async function requestScreenRecordingPermission(): Promise<void> {
  if (process.platform !== 'darwin') {
    return;
  }

  const { response } = await dialog.showMessageBox({
    type: 'warning',
    title: 'Screen Recording Permission Required',
    message: 'SafeShot needs Screen Recording permission to capture your screen.',
    detail:
      'Please open System Settings, go to Privacy & Security > Screen Recording, ' +
      'and enable SafeShot. Then relaunch the app.',
    buttons: ['Open System Settings', 'Cancel'],
    defaultId: 0,
    cancelId: 1,
  });

  if (response === 0) {
    try {
      await shell.openExternal(SCREEN_RECORDING_URL);
    } catch (err) {
      console.error('[macos] Failed to open System Settings:', err);
    }
  }
}
