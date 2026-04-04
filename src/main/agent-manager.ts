import { randomUUID } from 'node:crypto';
import {
  query,
  type SDKMessage,
  type SDKUserMessage,
  type SDKAssistantMessage,
  type SDKAuthStatusMessage,
  type SDKAssistantMessageError,
} from '@anthropic-ai/claude-agent-sdk';
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
  activity?: string;
}

export interface TaskLogEntry {
  timestamp: number;
  type: 'tool' | 'text' | 'status';
  content: string;
}

interface InternalTask extends Task {
  abortController?: AbortController;
  queryRef?: { close: () => void };
  activity?: string;
  logs: TaskLogEntry[];
  /**
   * Collects fatal errors encountered during the stream (e.g. auth failures).
   * If non-empty when result arrives, the task is marked 'error' regardless
   * of the result subtype.
   */
  fatalErrors: string[];
}

/**
 * Errors that indicate a fatal API/auth problem during the stream.
 * If any assistant message carries one of these, the task should fail
 * even if the SDK emits a result with subtype 'success'.
 */
const FATAL_ASSISTANT_ERRORS: ReadonlySet<SDKAssistantMessageError> = new Set([
  'authentication_failed',
  'billing_error',
  'invalid_request',
]);

/**
 * Map known SDK error substrings to user-friendly messages.
 */
function humanReadableError(errors: string[]): string {
  const joined = errors.join(' ');
  if (
    joined.includes('authentication_failed') ||
    joined.includes('Invalid API key')
  ) {
    return 'Not authenticated. Run "claude login" in your terminal to sign in.';
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
  if (joined.includes('invalid_request')) {
    return 'Invalid request. Check your Claude Code installation.';
  }
  if (joined.length > 0) {
    // Show the actual error for debugging (truncated)
    return joined.slice(0, 200);
  }
  return 'Something went wrong. Retry or dismiss to continue.';
}

/**
 * Describe a tool use in a short, human-readable string.
 */
function describeToolUse(
  toolName: string,
  input?: Record<string, unknown>,
): string {
  const filePath = input?.file_path as string | undefined;
  const short = filePath
    ? filePath.replace(/^.*\//, '') // basename only
    : undefined;

  switch (toolName) {
    case 'Read':
      return short ? `Reading ${short}` : 'Reading file...';
    case 'Write':
      return short ? `Writing ${short}` : 'Writing file...';
    case 'Edit':
      return short ? `Editing ${short}` : 'Editing file...';
    case 'Glob':
      return 'Searching for files...';
    case 'Grep':
      return 'Searching code...';
    case 'Bash': {
      const cmd = input?.command as string | undefined;
      return cmd ? `Running: ${cmd.slice(0, 60)}` : 'Running command...';
    }
    default:
      return `Using ${toolName}...`;
  }
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
      logs: [],
      fatalErrors: [],
    };
    this.tasks.set(id, task);
    this.emitUpdate(task);
    this.processQueue();
    return id;
  }

  /**
   * Retry a task re-using its original screenshot, DOM context, and bounds.
   * Dismisses the old task and creates a new one.
   */
  async retryTask(id: string): Promise<string> {
    const original = this.tasks.get(id);
    if (!original) {
      throw new Error(`Task ${id} not found`);
    }
    const { instruction, screenshot, dom, bounds } = original;
    this.dismissTask(id);
    return this.submitTask({ instruction, screenshot, dom, bounds });
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
      task.bounds,
    );

    // Build clean env: strip ANTHROPIC_API_KEY if set, so the SDK subprocess
    // uses Claude Code's own auth (OAuth from `claude login`) instead of a
    // potentially invalid API key from the environment.
    const cleanEnv = { ...process.env };
    delete cleanEnv.ANTHROPIC_API_KEY;

    const q = query({
      prompt,
      options: {
        abortController,
        cwd: this.projectDir,
        env: cleanEnv,
        systemPrompt: {
          type: 'preset',
          preset: 'claude_code',
          append:
            'You are used by claw-design. The user selected a region of their website and provided a screenshot, DOM context, and change instruction. Edit the source code to implement the change. Be concise in your response.',
        },
        allowedTools: ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash'],
        permissionMode: 'acceptEdits',
        settingSources: ['user', 'project'],
        persistSession: false,
        maxTurns: 20,
      },
    });

    task.queryRef = q;

    try {
      for await (const message of q as AsyncIterable<SDKMessage>) {
        const msg = message as Record<string, unknown>;

        if (msg.type === 'system' && msg.subtype === 'init') {
          task.status = 'editing';
          this.addLog(task, 'status', 'Claude connected, starting edits...');
          this.emitUpdate(task);
        } else if (msg.type === 'auth_status') {
          // Auth status updates (e.g. OAuth flow progress or auth errors)
          const authMsg = message as SDKAuthStatusMessage;
          if (authMsg.error) {
            task.fatalErrors.push(authMsg.error);
            this.addLog(task, 'status', `Auth error: ${authMsg.error}`);
          }
        } else if (msg.type === 'assistant') {
          // Check for API-level errors on assistant messages (e.g. auth failures)
          const assistantMsg = message as SDKAssistantMessage;
          if (
            assistantMsg.error &&
            FATAL_ASSISTANT_ERRORS.has(assistantMsg.error)
          ) {
            task.fatalErrors.push(assistantMsg.error);
            this.addLog(
              task,
              'status',
              `API error: ${assistantMsg.error}`,
            );
          }
          // Extract tool use info for activity streaming
          this.extractActivity(task, msg);
        } else if (msg.type === 'tool_use_summary') {
          // Human-readable summary of what a tool did
          const summary = (msg as Record<string, unknown>).summary as string;
          if (summary) {
            task.activity = summary;
            this.addLog(task, 'text', summary);
            this.emitUpdate(task);
          }
        } else if (msg.type === 'result') {
          // If fatal errors accumulated during the stream, override success
          if (task.fatalErrors.length > 0) {
            task.status = 'error';
            task.error = humanReadableError(task.fatalErrors);
            task.activity = undefined;
            this.addLog(task, 'status', `Error: ${task.error}`);
            this.emitUpdate(task);
          } else if (msg.subtype === 'success') {
            task.status = 'done';
            task.activity = undefined;
            this.addLog(task, 'status', 'Completed');
            this.emitUpdate(task);
          } else {
            // Error result from SDK (execution errors, max turns, etc.)
            const errors = (msg.errors as string[]) || [];
            task.status = 'error';
            task.error = humanReadableError(errors);
            task.activity = undefined;
            this.addLog(task, 'status', `Error: ${task.error}`);
            this.emitUpdate(task);
          }
        }
        // Other message types (tool_progress, etc.) intentionally ignored for IPC perf
      }
    } catch (err: unknown) {
      // Aborted queries throw; only set error if not already done
      if (task.status !== 'done' && task.status !== 'error') {
        task.status = 'error';
        const errMsg = err instanceof Error ? err.message : String(err);
        task.error = errMsg || 'Something went wrong. Retry or dismiss to continue.';
        this.addLog(task, 'status', `Error: ${errMsg}`);
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

  /**
   * Extract activity text from assistant messages containing tool_use blocks.
   */
  private extractActivity(
    task: InternalTask,
    msg: Record<string, unknown>,
  ): void {
    const assistantMsg = msg.message as
      | { content?: Array<Record<string, unknown>> }
      | undefined;
    if (!assistantMsg?.content) return;

    for (const block of assistantMsg.content) {
      if (block.type === 'tool_use') {
        const toolName = block.name as string;
        const input = block.input as Record<string, unknown> | undefined;
        const activity = describeToolUse(toolName, input);
        task.activity = activity;
        this.addLog(task, 'tool', activity);
        this.emitUpdate(task);
      } else if (block.type === 'text' && typeof block.text === 'string') {
        // Capture Claude's text responses in logs (not as activity)
        const text = (block.text as string).slice(0, 500);
        if (text.trim()) {
          this.addLog(task, 'text', text);
        }
      }
    }
  }

  private addLog(task: InternalTask, type: TaskLogEntry['type'], content: string): void {
    task.logs.push({ timestamp: Date.now(), type, content });
  }

  /**
   * Get logs for a task by ID.
   */
  getTaskLogs(id: string): TaskLogEntry[] {
    return this.tasks.get(id)?.logs ?? [];
  }

  private emitUpdate(task: InternalTask): void {
    if (!this.onTaskUpdate) return;
    this.onTaskUpdate({
      id: task.id,
      instruction: task.instruction,
      status: task.status,
      error: task.error,
      activity: task.activity,
    });
  }
}
