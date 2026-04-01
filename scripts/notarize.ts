import { notarize } from '@electron/notarize';
import * as path from 'path';

/**
 * macOS notarization script for electron-builder afterSign hook.
 * Requirements: 2.2, 2.7
 */
export default async function notarizeApp(context: {
  electronPlatformName: string;
  appOutDir: string;
  packager: { appInfo: { productFilename: string } };
}): Promise<void> {
  const { electronPlatformName, appOutDir, packager } = context;

  if (electronPlatformName !== 'darwin') return;

  const appName = packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);

  const appleId = process.env.APPLE_ID;
  const appleIdPassword = process.env.APPLE_ID_PASSWORD;
  const teamId = process.env.APPLE_TEAM_ID;

  if (!appleId || !appleIdPassword || !teamId) {
    console.warn('[notarize] Skipping notarization — APPLE_ID, APPLE_ID_PASSWORD, or APPLE_TEAM_ID not set.');
    return;
  }

  console.log(`[notarize] Notarizing ${appPath}...`);

  await notarize({
    tool: 'notarytool',
    appPath,
    appleId,
    appleIdPassword,
    teamId,
  });

  console.log('[notarize] Notarization complete.');
}
