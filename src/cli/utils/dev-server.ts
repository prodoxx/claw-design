import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';

export const SCRIPT_PRIORITY = ['dev', 'start', 'serve'] as const;

export class DetectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DetectionError';
  }
}

export interface DetectedScript {
  name: string;
  command: string;
}

export async function detectDevServerScript(
  projectDir: string
): Promise<DetectedScript> {
  const pkgPath = join(projectDir, 'package.json');
  const raw = await readFile(pkgPath, 'utf-8');
  const pkg = JSON.parse(raw);

  if (!pkg.scripts) {
    throw new DetectionError('No "scripts" field found in package.json');
  }

  for (const name of SCRIPT_PRIORITY) {
    if (pkg.scripts[name]) {
      return { name, command: pkg.scripts[name] };
    }
  }

  throw new DetectionError(
    `No dev server script found in package.json.\n` +
      `  Looked for: ${SCRIPT_PRIORITY.join(', ')}\n` +
      `  Tip: use --cmd "your-dev-command" to specify manually`
  );
}

export function spawnDevServer(
  command: string,
  verbose: boolean
): ChildProcess {
  const child = spawn(command, {
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: process.cwd(),
  });

  if (verbose) {
    child.stdout?.pipe(process.stdout);
    child.stderr?.pipe(process.stderr);
  }

  return child;
}
