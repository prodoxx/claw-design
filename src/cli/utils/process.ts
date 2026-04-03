import kill from 'tree-kill';
import pc from 'picocolors';

/**
 * Processes managed by the shutdown coordinator.
 * Each field is optional -- only populated when the process has been spawned.
 */
export interface ManagedProcesses {
  devServer?: { pid: number };
  claudeSession?: { close: () => void };
  electronProcess?: { pid: number };
}

let shuttingDown = false;
const registeredListeners: Array<{ event: string; handler: (...args: any[]) => void }> = [];

/**
 * Register signal handlers for graceful shutdown of all managed processes.
 * Coordinates ordered teardown: Claude session, Electron, dev server.
 * Idempotent -- second shutdown call is a no-op.
 */
export function registerShutdownHandlers(processes: ManagedProcesses): void {
  function shutdown(signal: string) {
    if (shuttingDown) return;
    shuttingDown = true;

    console.log(pc.dim(`\n  Shutting down (${signal})...`));

    // Step 1: Close Claude session (graceful)
    try {
      processes.claudeSession?.close();
    } catch {
      /* ignore */
    }

    // Step 2: Kill Electron process tree
    if (processes.electronProcess?.pid) {
      kill(processes.electronProcess.pid, 'SIGTERM', () => {});
    }

    // Step 3: Kill dev server process tree (per PROC-02: tree-kill, not process.kill)
    if (processes.devServer?.pid) {
      kill(processes.devServer.pid, 'SIGTERM', () => {});
    }

    // Step 4: Force exit after 5s if still alive
    setTimeout(() => process.exit(1), 5000).unref();

    // Step 5: Normal exit
    process.exit(0);
  }

  const sigintHandler = () => shutdown('SIGINT');
  const sigtermHandler = () => shutdown('SIGTERM');
  const uncaughtHandler = (err: Error) => {
    console.error('Uncaught exception:', err);
    shutdown('uncaughtException');
  };

  process.on('SIGINT', sigintHandler);
  process.on('SIGTERM', sigtermHandler);
  process.on('uncaughtException', uncaughtHandler);

  registeredListeners.push(
    { event: 'SIGINT', handler: sigintHandler },
    { event: 'SIGTERM', handler: sigtermHandler },
    { event: 'uncaughtException', handler: uncaughtHandler },
  );
}

/**
 * Reset shutdown state for testing. Removes registered signal listeners.
 */
export function resetShutdownState(): void {
  shuttingDown = false;
  for (const { event, handler } of registeredListeners) {
    process.removeListener(event, handler);
  }
  registeredListeners.length = 0;
}
