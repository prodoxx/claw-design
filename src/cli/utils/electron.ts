import { spawn, type ChildProcess } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Spawn the Electron binary with the built main process script.
 * Passes URL and project metadata via environment variables.
 */
export function spawnElectron(url: string, projectName: string): ChildProcess {
  // Resolve electron binary path from the electron npm package
  const require = createRequire(import.meta.url);
  const electronPath = require('electron') as unknown as string;

  // Path to built main process (from electron-vite build output)
  const projectRoot = path.resolve(__dirname, '..', '..', '..');
  const mainScript = path.join(projectRoot, 'out', 'main', 'index.js');

  const child = spawn(electronPath, [mainScript], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      CLAW_URL: url,
      CLAW_PROJECT_NAME: projectName,
      CLAW_PROJECT_DIR: process.cwd(),
    },
  });

  // Forward Electron main process logs to CLI terminal
  child.stdout?.on('data', (chunk: Buffer) => {
    process.stdout.write(chunk);
  });
  child.stderr?.on('data', (chunk: Buffer) => {
    process.stderr.write(chunk);
  });

  return child;
}
