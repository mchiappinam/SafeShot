import { execSync } from 'child_process';
import * as path from 'path';

/**
 * Build orchestration script.
 * Requirements: 2.1, 2.2
 *
 * Steps:
 * 1. Compile main process TypeScript
 * 2. Build renderer with Vite
 * 3. Compile native addon (node-gyp)
 * 4. Package with electron-builder
 */

const root = path.resolve(__dirname, '..');

function run(cmd: string, label: string): void {
  console.log(`\n[build] ${label}...`);
  execSync(cmd, { cwd: root, stdio: 'inherit' });
  console.log(`[build] ${label} done.`);
}

async function main(): Promise<void> {
  // 1. Compile main process
  run('npx tsc -p tsconfig.main.json', 'Compile main process');

  // 2. Build renderer
  run('npx vite build', 'Build renderer');

  // 3. Build native addon (skip if node-gyp not available)
  try {
    run('npx node-gyp rebuild --directory src/native', 'Build native addon');
  } catch {
    console.warn('[build] Native addon build skipped (node-gyp not available or failed).');
  }

  // 4. Package with electron-builder
  const platform = process.argv.includes('--win') ? '--win'
    : process.argv.includes('--mac') ? '--mac'
    : '';
  run(`npx electron-builder ${platform}`.trim(), 'Package with electron-builder');
}

main().catch((err) => {
  console.error('[build] Build failed:', err);
  process.exit(1);
});
