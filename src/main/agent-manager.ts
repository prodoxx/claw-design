import { randomUUID } from 'node:crypto';
import { query, type SDKMessage, type SDKUserMessage } from '@anthropic-ai/claude-agent-sdk';
import type { DomExtractionResult } from './dom-extract.js';
import type { CSSRect } from './capture.js';
import { assemblePrompt } from './prompt.js';

export type TaskStatus = 'queued' | 'sending' | 'editing' | 'done' | 'error';

export interface Task {
  id: string;
  instruction: string;
  status: TaskStatus;
  error?: string;
  screenshot: Buffer;
  dom: DomExtractionResult;
  bounds: CSSRect;
}

export interface TaskUpdate {
  id: string;
  instruction: string;
  status: TaskStatus;
  error?: string;
}

interface InternalTask extends Task {
  abortController?: AbortController;
  queryRef?: { close: () => void };
}

/**
 * Map known SDK error substrings to user-friendly messages.
 */
function humanReadableError(errors: string[]): string {
  const joined = errors.join(' ');
  if (joined.includes('authentication_failed')) {
    return 'Authentication failed. Check your Claude API key.';
  }
  if (joined.includes('rate_limit')) {
    return 'Rate limit reached. Retry in a moment.';
  }
  if (joined.includes('billing_error')) {
    return 'Billing issue. Check your Claude account.';
  }
  if (joined.includes('server_error')) {
    return 'Claude server error. Retry in a moment.';
  }
  return 'Something went wrong. Retry or dismiss to continue.';
}

/**
 * Manages parallel Claude agent queries.
 *
 * Enforces a concurrency limit (max 3 parallel agents), tracks task status
 * through a lifecycle (queued -> sending -> editing -> done/error), and
 * exposes retry/dismiss/shutdown for task management.
 *
 * Per Pitfall 2 (04-RESEARCH): limits concurrent query() calls.
 * Per Pitfall 3 (04-RESEARCH): only reacts to system init + result messages,
 * ignoring high-frequency stream events to prevent IPC flooding.
 */
export class AgentManager {
  private tasks: Map<string, InternalTask> = new Map();
  private activeCount = 0;
  private readonly maxParallel = 3;
  private readonly projectDir: string;
  private onTaskUpdate: ((update: TaskUpdate) => void) | null = null;

  constructor(projectDir: string) {
    this.projectDir = projectDir;
  }

  setOnTaskUpdate(cb: (update: TaskUpdate) => void): void {
    this.onTaskUpdate = cb;
  }

  /**
   * Submit a new task for Claude to execute.
   * Returns the generated task ID.
   */
  async submitTask(input: {
    instruction: string;
    screenshot: Buffer;
    dom: DomExtractionResult;
    bounds: CSSRect;
  }): Promise<string> {
    const id = randomUUID();
    const task: InternalTask = {
      id,
      instruction: input.instruction,
      status: 'queued',
      screenshot: input.screenshot,
      dom: input.dom,
      bounds: input.bounds,
    };
    this.tasks.set(id, task);
    this.emitUpdate(task);
    this.processQueue();
    return id;
  }

  /**
   * Retry a failed or completed task with fresh visual context.
   * Creates a new task using the original instruction.
   */
  async retryTask(
    id: string,
    freshScreenshot: Buffer,
    freshDom: DomExtractionResult,
    freshBounds: CSSRect,
  ): Promise<string> {
    const original = this.tasks.get(id);
    if (!original) {
      throw new Error(`Task ${id} not found`);
    }
    return this.submitTask({
      instruction: original.instruction,
      screenshot: freshScreenshot,
      dom: freshDom,
      bounds: freshBounds,
    });
  }

  /**
   * Dismiss a task, removing it from the internal map.
   * If the task is active (sending/editing), aborts the query.
   */
  dismissTask(id: string): void {
    const task = this.tasks.get(id);
    if (!task) return;

    if (
      (task.status === 'sending' || task.status === 'editing') &&
      task.abortController
    ) {
      task.abortController.abort();
    }

    this.tasks.delete(id);
  }

  /**
   * Shut down all active queries and clean up resources.
   */
  shutdown(): void {
    for (const task of this.tasks.values()) {
      if (
        (task.status === 'sending' || task.status === 'editing') &&
        task.abortController
      ) {
        task.abortController.abort();
      }
      if (task.queryRef) {
        task.queryRef.close();
      }
    }
  }

  /**
   * Get a task by ID (public view without internal fields).
   */
  getTask(id: string): Task | undefined {
    const task = this.tasks.get(id);
    if (!task) return undefined;
    return {
      id: task.id,
      instruction: task.instruction,
      status: task.status,
      error: task.error,
      screenshot: task.screenshot,
      dom: task.dom,
      bounds: task.bounds,
    };
  }

  /**
   * Get all tasks (public view).
   */
  getAllTasks(): Task[] {
    return Array.from(this.tasks.values()).map((t) => ({
      id: t.id,
      instruction: t.instruction,
      status: t.status,
      error: t.error,
      screenshot: t.screenshot,
      dom: t.dom,
      bounds: t.bounds,
    }));
  }

  // ---- Private ----

  private processQueue(): void {
    if (this.activeCount >= this.maxParallel) return;

    for (const task of this.tasks.values()) {
      if (task.status === 'queued') {
        this.activeCount++;
        task.status = 'sending';
        this.emitUpdate(task);
        this.executeTask(task);
        // Only start one task per processQueue call; executeTask will call
        // processQueue again when it completes.
        return;
      }
    }
  }

  private async executeTask(task: InternalTask): Promise<void> {
    const abortController = new AbortController();
    task.abortController = abortController;

    const prompt: AsyncIterable<SDKUserMessage> = assemblePrompt(
      task.instruction,
      task.screenshot,
      task.dom,
    );

    const q = query({
      prompt,
      options: {
        abortController,
        cwd: this.projectDir,
        systemPrompt: {
          type: 'preset',
          preset: 'claude_code',
          append:
            'You are used by claw-design. The user selected a region of their website and provided a screenshot, DOM context, and change instruction. Edit the source code to implement the change. Be concise in your response.',
        },
        allowedTools: ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash'],
        permissionMode: 'acceptEdits',
        settingSources: ['project'],
        persistSession: false,
        maxTurns: 20,
      },
    });

    task.queryRef = q;

    try {
      for await (const message of q as AsyncIterable<SDKMessage>) {
        // Per Pitfall 3: only react to init and result messages
        const msg = message as Record<string, unknown>;

        if (msg.type === 'system' && msg.subtype === 'init') {
          task.status = 'editing';
          this.emitUpdate(task);
        } else if (msg.type === 'result') {
          if (msg.subtype === 'success') {
            task.status = 'done';
            this.emitUpdate(task);
          } else {
            // Error result
            const errors = (msg.errors as string[]) || [];
            task.status = 'error';
            task.error = humanReadableError(errors);
            this.emitUpdate(task);
          }
        }
        // All other message types are intentionally ignored
      }
    } catch (err: unknown) {
      // Aborted queries throw; only set error if not already done
      if (task.status !== 'done' && task.status !== 'error') {
        task.status = 'error';
        task.error =
          err instanceof Error
            ? err.message
            : 'Something went wrong. Retry or dismiss to continue.';
        this.emitUpdate(task);
      }
    } finally {
      try {
        q.close();
      } catch {
        // close() may throw if already closed
      }
      this.activeCount--;
      this.processQueue();
    }
  }

  private emitUpdate(task: InternalTask): void {
    if (!this.onTaskUpdate) return;
    this.onTaskUpdate({
      id: task.id,
      instruction: task.instruction,
      status: task.status,
      error: task.error,
    });
  }
}
