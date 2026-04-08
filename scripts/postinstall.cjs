/**
 * Patch Electron.app bundle name on macOS so the menu bar shows
 * "Claw Design" instead of "Electron" during development.
 *
 * This modifies the Info.plist inside node_modules/electron/dist/Electron.app.
 * The change is cosmetic and only affects macOS. It re-applies on every
 * `npm install` since node_modules is ephemeral.
 */
'use strict';

if (process.platform !== 'darwin') process.exit(0);

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const plistPath = path.join(
  __dirname,
  '..',
  'node_modules',
  'electron',
  'dist',
  'Electron.app',
  'Contents',
  'Info.plist',
);

if (!fs.existsSync(plistPath)) {
  // Electron not yet downloaded (e.g. CI with --ignore-scripts on electron)
  process.exit(0);
}

const plistBuddy = '/usr/libexec/PlistBuddy';

try {
  execFileSync(plistBuddy, ['-c', 'Set :CFBundleName Claw Design', plistPath]);
  execFileSync(plistBuddy, ['-c', 'Set :CFBundleDisplayName Claw Design', plistPath]);
} catch {
  // Non-fatal -- menu bar will show "Electron" but everything else works
}
