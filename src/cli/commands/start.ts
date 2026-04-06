import { detectDevServerScript, detectPackageManager, spawnDevServer, DetectionError } from '../utils/dev-server.js';
import { extractPortFromOutput, waitForPort, getProcessOnPort } from '../utils/port-detect.js';
import { isClaudeInstalled, getClaudeAuthStatus } from '../utils/claude.js';
import { checkNodeVersion, checkElectronBinary } from '../utils/preflight.js';
import { spawnElectron } from '../utils/electron.js';
import { registerShutdownHandlers } from '../utils/process.js';
import { createSpinner, printReady, printError } from '../utils/output.js';
import pc from 'picocolors';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import type { ChildProcess } from 'node:child_process';
import { createInterface } from 'node:readline';

export interface StartOptions {
  cmd?: string;
  port?: string;
  verbose?: boolean;
}

export async function startCommand(options: StartOptions): Promise<void> {
  const verbose = options.verbose ?? false;

  // Pre-flight checks (D-14): fast checks before any async work
  const nodeCheck = checkNodeVersion();
  if (!nodeCheck.ok) {
    printError(
      'Node.js 20+ required',
      `Found Node ${nodeCheck.version}.`,
      'Update Node.js: https://nodejs.org'
    );
    process.exit(1);
  }

  if (!checkElectronBinary()) {
    printError(
      'Electron not found',
      'The Electron binary is missing from the installation.',
      'Reinstall: npm install -g claw-design'
    );
    process.exit(1);
  }

  // Step 1: Check Claude Code installed (per D-12)
  if (!isClaudeInstalled()) {
    printError(
      'Claude Code not found',
      'Claude Code CLI is not installed or not in PATH.',
      'Install: https://claude.ai/download'
    );
    process.exit(1);
  }

  // Step 1b: Check Claude Code authentication
  const authStatus = getClaudeAuthStatus();
  if (!authStatus.loggedIn) {
    printError(
      'Claude Code not authenticated',
      'You need to sign in before using clawdesign.',
      'Run: claude login'
    );
    process.exit(1);
  }

  // Step 2: Detect dev server (per D-05, D-06)
  let command: string;
  const detectSpinner = createSpinner('Detecting dev server...');

  if (options.cmd) {
    command = options.cmd;
    detectSpinner.succeed(`Using custom command: ${pc.cyan(command)}`);
  } else {
    try {
      const detected = await detectDevServerScript(process.cwd());
      const pm = await detectPackageManager(process.cwd());
      const runCmd = pm === 'npm' ? `npm run ${detected.name}` : `${pm} run ${detected.name}`;
      command = runCmd;
      detectSpinner.succeed(`Detected: ${pc.cyan(runCmd)} (from package.json)`);
    } catch (err) {
      if (err instanceof DetectionError) {
        detectSpinner.fail('No dev server detected');
        printError('No dev server detected', err.message);
      } else {
        detectSpinner.fail('Dev server detection failed');
        printError(
          'Dev server detection failed',
          err instanceof Error ? err.message : String(err)
        );
      }
      process.exit(1);
    }
  }

  // Read project name from package.json for Electron window title (D-03)
  let projectName = 'unknown';
  try {
    const pkg = JSON.parse(readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8'));
    projectName = pkg.name || 'unknown';
  } catch {
    // Not critical -- window title will show 'unknown'
  }

  // Step 3: Spawn dev server (per CLI-04)
  const serverSpinner = createSpinner('Starting dev server...');
  const devServer: ChildProcess = spawnDevServer(command, verbose);
  serverSpinner.succeed(`Dev server started ${pc.dim(command)}`);

  // Step 4: Detect port (per D-07, D-08)
  let port: number;

  if (options.port) {
    port = parseInt(options.port, 10);
  } else {
    // Listen to stdout/stderr for port detection
    const portSpinner = createSpinner('Detecting port from dev server output...');
    let accumulatedOutput = '';

    port = await new Promise<number>((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('port-detect-timeout'));
      }, 10_000);

      function onData(chunk: Buffer) {
        accumulatedOutput += chunk.toString();
        const detected = extractPortFromOutput(accumulatedOutput);
        if (detected !== null) {
          cleanup();
          resolve(detected);
        }
      }

      function cleanup() {
        clearTimeout(timeout);
        devServer.stdout?.removeListener('data', onData);
        devServer.stderr?.removeListener('data', onData);
      }

      devServer.stdout?.on('data', onData);
      devServer.stderr?.on('data', onData);
    }).catch(async () => {
      // Port not detected from stdout -- prompt user interactively (per D-07)
      portSpinner.stop();
      const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      return new Promise<number>((resolve, reject) => {
        rl.question(
          `${pc.yellow('  Could not detect port from dev server output.')}\n  Enter port number: `,
          (answer) => {
            rl.close();
            const parsed = parseInt(answer.trim(), 10);
            if (Number.isNaN(parsed) || parsed <= 0 || parsed > 65535) {
              reject(new Error('Invalid port number'));
            } else {
              resolve(parsed);
            }
          }
        );
      });
    });

    portSpinner.succeed(`Port detected: ${pc.cyan(String(port))}`);
  }

  // Step 5: Wait for port readiness (per D-09, D-14, D-15)
  const readySpinner = createSpinner(`Waiting for localhost:${port}...`);
  const readyStart = Date.now();
  const elapsedTimer = setInterval(() => {
    const elapsed = Math.round((Date.now() - readyStart) / 1000);
    readySpinner.text = `Waiting for localhost:${port}... ${pc.dim(`${elapsed}s`)}`;
  }, 1000);

  try {
    await waitForPort(port, { timeout: 30_000 });
    clearInterval(elapsedTimer);
    readySpinner.succeed(`Dev server ready on ${pc.cyan(`http://localhost:${port}`)}`);
  } catch {
    clearInterval(elapsedTimer);
    readySpinner.fail(`Port ${port} not ready`);

    // Check if port is in use by another process (per D-14)
    const occupant = getProcessOnPort(port);
    if (occupant) {
      printError(
        'Port already in use',
        `Port ${port} is occupied by ${occupant.name} (PID ${occupant.pid})`,
        `Try: kill ${occupant.pid} or clawdesign start --port <other>`
      );
    } else {
      printError(
        'Startup timeout',
        `Port ${port} not ready after 30s`,
        'Try: clawdesign start --verbose\n  Or:  clawdesign start --port <port>'
      );
    }
    process.exit(1);
  }

  // Step 6: Launch Electron window (per CLI-06)
  // Pre-built by `npm run build` / prepublishOnly hook (D-18).
  // No runtime build needed -- out/ is included in the npm package.
  // Claude Code session is managed by AgentManager inside the Electron main process.
  const electronSpinner = createSpinner('Opening Electron window...');
  const electronProcess = spawnElectron(`http://localhost:${port}`, projectName);
  electronSpinner.succeed(`Electron window opened ${pc.dim(`localhost:${port}`)}`);


  // Step 7: Register shutdown and print ready (per D-01 final step)
  // AgentManager handles its own cleanup from within Electron main process.
  registerShutdownHandlers({
    devServer: { pid: devServer.pid! },
    electronProcess: { pid: electronProcess.pid! },
  });

  // Dev server crash handling (per D-13): notify but do NOT exit
  devServer.on('exit', (code, signal) => {
    console.log(pc.yellow('\n  Dev server exited.'));
    console.log(pc.dim('  Press Ctrl+C to stop, then re-run clawdesign start'));
  });

  // Electron window closed -- trigger shutdown to kill dev server + Claude
  electronProcess.on('exit', () => {
    console.log(pc.dim('\n  Electron window closed.'));
    process.emit('SIGINT');
  });

  printReady(port);
}
