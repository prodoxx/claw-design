import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';

/**
 * Parse Node.js version string to major version number.
 * Exported for testability.
 */
export function parseNodeMajor(versionString: string): number {
  return parseInt(versionString.split('.')[0], 10);
}

/**
 * Check if the running Node.js version meets the minimum requirement (>= 20).
 * Per D-14: fast pre-flight check before any async work.
 */
export function checkNodeVersion(): { ok: boolean; version: string } {
  const major = parseNodeMajor(process.versions.node);
  return { ok: major >= 20, version: process.versions.node };
}

/**
 * Check if the Electron binary is installed and accessible.
 * Uses the same resolution pattern as electron.ts:spawnElectron().
 * Per D-14: catches missing electron after npm install failures.
 */
export function checkElectronBinary(): boolean {
  try {
    const require = createRequire(import.meta.url);
    const electronPath = require('electron') as unknown as string;
    return typeof electronPath === 'string' && existsSync(electronPath);
  } catch {
    return false;
  }
}
