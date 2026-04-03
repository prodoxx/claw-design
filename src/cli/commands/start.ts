import { type ChildProcess } from 'node:child_process';
import treeKill from 'tree-kill';
import { detectDevServerScript, spawnDevServer } from '../utils/dev-server.js';
import { printError } from '../utils/output.js';

export interface StartOptions {
  cmd?: string;
  port?: string;
  verbose?: boolean;
}

export async function startCommand(options: StartOptions): Promise<void> {
  let devServerProcess: ChildProcess | undefined;
  const verbose = options.verbose ?? false;

  // Step 1: Detect or use provided dev server command
  let command: string;
  if (options.cmd) {
    command = options.cmd;
  } else {
    try {
      const detected = await detectDevServerScript(process.cwd());
      command = `npm run ${detected.name}`;
    } catch (err) {
      if (err instanceof Error) {
        printError('Dev server detection failed', err.message);
      }
      process.exitCode = 1;
      return;
    }
  }

  // Step 2: Spawn dev server
  devServerProcess = spawnDevServer(command, verbose);
  console.log(`Dev server spawned (pid: ${devServerProcess.pid})`);

  // TODO: Port detection, Claude session, Electron launch (Plan 02 & 03)

  // Temporary SIGINT handler for clean shutdown
  const cleanup = () => {
    if (devServerProcess?.pid) {
      treeKill(devServerProcess.pid, 'SIGTERM');
    }
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}
