/**
 * Patch Electron.app on macOS so the menu bar, dock tooltip, about dialog,
 * and dock icon all show "Claw Design" instead of "Electron".
 *
 * This modifies files inside node_modules/electron/dist/Electron.app:
 * - Info.plist: CFBundleName and CFBundleDisplayName
 * - Resources/electron.icns: replaced with our custom icon
 *
 * Re-applies on every `npm install` since node_modules is ephemeral.
 */
'use strict';

if (process.platform !== 'darwin') process.exit(0);

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const electronAppDir = path.join(
  __dirname,
  '..',
  'node_modules',
  'electron',
  'dist',
  'Electron.app',
  'Contents',
);

const plistPath = path.join(electronAppDir, 'Info.plist');

if (!fs.existsSync(plistPath)) {
  // Electron not yet downloaded (e.g. CI with --ignore-scripts on electron)
  process.exit(0);
}

// 1. Patch bundle name in Info.plist
const plistBuddy = '/usr/libexec/PlistBuddy';

try {
  execFileSync(plistBuddy, ['-c', 'Set :CFBundleName Claw Design', plistPath]);
  execFileSync(plistBuddy, ['-c', 'Set :CFBundleDisplayName Claw Design', plistPath]);
} catch {
  // Non-fatal -- menu bar will show "Electron" but everything else works
}

// 2. Replace Electron icon with Claw Design icon
const customIcon = path.join(__dirname, '..', 'resources', 'icon.icns');
const electronIcon = path.join(electronAppDir, 'Resources', 'electron.icns');

try {
  if (fs.existsSync(customIcon) && fs.existsSync(electronIcon)) {
    fs.copyFileSync(customIcon, electronIcon);
  }
} catch {
  // Non-fatal -- about dialog and dock will show Electron atom icon
}
