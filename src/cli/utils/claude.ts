import { query, type Query } from '@anthropic-ai/claude-agent-sdk';
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

/**
 * A Claude Code session providing message sending and lifecycle control.
 */
export interface ClaudeSession {
  sendMessage: (message: string | Array<{ type: string; [key: string]: any }>) => void;
  close: () => void;
}

/**
 * Spawn a Claude Code session using the Agent SDK in streaming input mode.
 * The session is eager-started (per D-10) and persists for the lifetime of `clawdesign start`.
 * Messages are fed via an async generator, enabling multi-turn interaction.
 */
export async function spawnClaudeSession(cwd: string): Promise<ClaudeSession> {
  // Queue pattern for async generator: messages are pushed and yielded on demand
  let resolveNext: ((msg: any) => void) | null = null;
  const messageQueue: any[] = [];

  async function* messageStream() {
    while (true) {
      if (messageQueue.length > 0) {
        yield messageQueue.shift()!;
      } else {
        yield await new Promise<any>((resolve) => {
          resolveNext = resolve;
        });
      }
    }
  }

  const q: Query = query({
    prompt: messageStream(),
    options: {
      cwd,
      systemPrompt: {
        type: 'preset' as const,
        preset: 'claude_code' as const,
        append:
          'You are being used by claw-design, a visual web development ' +
          'tool. The user will provide screenshots and DOM context of ' +
          'regions of their website along with change instructions. ' +
          'Edit the source code to implement their requested changes.',
      },
      allowedTools: ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash'],
      settingSources: ['project'],
    },
  });

  function sendMessage(
    msg: string | Array<{ type: string; [key: string]: any }>
  ) {
    if (resolveNext) {
      const resolve = resolveNext;
      resolveNext = null;
      resolve(msg);
    } else {
      messageQueue.push(msg);
    }
  }

  return {
    sendMessage,
    close: () => q.close(),
  };
}
