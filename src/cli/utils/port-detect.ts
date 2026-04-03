import { createConnection } from 'node:net';
import { execFileSync } from 'node:child_process';

/**
 * Ordered patterns for extracting port numbers from dev server stdout.
 * Most specific first to avoid false positives (Pitfall 4 from research).
 */
export const PORT_PATTERNS: readonly RegExp[] = [
  // Full URL: http://localhost:3000, https://127.0.0.1:8080, http://0.0.0.0:4321, http://[::]:3000
  /https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::\]):(\d+)/,
  // "listening on port 3000", "running at port 8080", "started server on 0.0.0.0:3000"
  /(?:listening|running|started\s+server)\s+(?:on|at)\s+(?:(?:\S+:)?(?:port\s+)?)?(\d+)/i,
  // "port: 3000", "Port 3000", "PORT=3000"
  /\b(?:port|Port|PORT)\s*[:=]?\s*(\d+)/,
  // Fallback: any :NNNNN (4-5 digit port after colon) -- most generic, last resort
  /:(\d{4,5})\b/,
] as const;

/**
 * Lines containing these phrases are error messages about ports, not actual
 * listening announcements. Filter them out to avoid false positives like
 * "Port 3016 is already in use" being detected as the dev server port.
 */
const PORT_ERROR_PHRASES = /(?:in use|EADDRINUSE|already|error|failed|unavailable)/i;

/**
 * Extract a port number from dev server output text.
 * Tests patterns from most specific (URL) to least specific (colon:digits).
 * Filters out error lines to avoid false positives from port-in-use messages.
 * Returns null if no valid port found.
 */
export function extractPortFromOutput(output: string): number | null {
  // Filter out lines that mention port errors before matching
  const cleanedOutput = output
    .split('\n')
    .filter(line => !PORT_ERROR_PHRASES.test(line))
    .join('\n');

  for (const pattern of PORT_PATTERNS) {
    const match = cleanedOutput.match(pattern);
    if (match) {
      const port = parseInt(match[1], 10);
      if (port > 0 && port <= 65535) return port;
    }
  }
  return null;
}

/**
 * Poll a TCP port until it accepts connections or timeout expires.
 * Default timeout: 30s (per D-09). Default poll interval: 250ms.
 */
export function waitForPort(
  port: number,
  opts?: { timeout?: number; interval?: number }
): Promise<void> {
  const timeout = opts?.timeout ?? 30_000;
  const interval = opts?.interval ?? 250;

  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    function attempt() {
      if (Date.now() - startTime > timeout) {
        reject(
          new Error(
            `Timeout: port ${port} not ready after ${timeout / 1000}s`
          )
        );
        return;
      }

      const socket = createConnection({ port, host: '127.0.0.1' });
      socket.once('connect', () => {
        socket.destroy();
        resolve();
      });
      socket.once('error', () => {
        socket.destroy();
        setTimeout(attempt, interval);
      });
    }

    attempt();
  });
}

/**
 * Attempt to identify which process is listening on a given port.
 * Best-effort -- returns null if lsof/ps unavailable or port is free.
 * Used for D-14: port-in-use diagnostics.
 */
export function getProcessOnPort(
  port: number
): { pid: number; name: string } | null {
  try {
    const pidStr = execFileSync('lsof', ['-i', `:${port}`, '-t'], {
      encoding: 'utf-8',
    }).trim();

    // lsof may return multiple PIDs (one per line); take the first
    const pid = parseInt(pidStr.split('\n')[0], 10);
    if (Number.isNaN(pid)) return null;

    const name = execFileSync('ps', ['-p', String(pid), '-o', 'comm='], {
      encoding: 'utf-8',
    }).trim();

    return { pid, name };
  } catch {
    return null;
  }
}
