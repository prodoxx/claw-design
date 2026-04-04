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

// Note: The Claude Code session management (spawnClaudeSession, ClaudeSession)
// has been removed. Claude agent lifecycle is now handled by AgentManager in
// the Electron main process (src/main/agent-manager.ts), which spawns per-task
// agents instead of maintaining a single eager session.
