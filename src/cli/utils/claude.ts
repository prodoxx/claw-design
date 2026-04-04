import { execFileSync } from 'node:child_process';

/**
 * Check if Claude Code CLI is installed and available in PATH.
 * Synchronous check -- runs once at startup (per D-12).
 */
export function isClaudeInstalled(): boolean {
  try {
    execFileSync('which', ['claude'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export interface ClaudeAuthStatus {
  loggedIn: boolean;
  authMethod?: string;
  apiProvider?: string;
  apiKeySource?: string;
  email?: string | null;
}

/**
 * Check if the user is authenticated with Claude Code.
 *
 * Runs `claude auth status --json` and parses the result.
 * Returns the parsed status, or `{ loggedIn: false }` if the command
 * fails or produces unparseable output.
 */
export function getClaudeAuthStatus(): ClaudeAuthStatus {
  try {
    const raw = execFileSync('claude', ['auth', 'status', '--json'], {
      encoding: 'utf-8',
      timeout: 10_000,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const parsed = JSON.parse(raw.trim());
    return {
      loggedIn: Boolean(parsed.loggedIn),
      authMethod: parsed.authMethod,
      apiProvider: parsed.apiProvider,
      apiKeySource: parsed.apiKeySource,
      email: parsed.email,
    };
  } catch {
    return { loggedIn: false };
  }
}
