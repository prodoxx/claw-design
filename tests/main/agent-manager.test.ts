import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DomExtractionResult } from '../../src/main/dom-extract.js';
import type { CSSRect } from '../../src/main/capture.js';

// ---- Mock the Agent SDK ----

// We store the mock query function here so tests can control what messages it yields
let mockQueryMessages: Array<Record<string, unknown>> = [];
let mockQueryCloseCallCount = 0;
let mockQueryDeferred: Array<{
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
  messages: Array<Record<string, unknown>>;
}> = [];

function createDeferredQuery(messages: Array<Record<string, unknown>>) {
  let resolveDeferred: (value: unknown) => void;
  let rejectDeferred: (reason?: unknown) => void;
  const gate = new Promise((res, rej) => {
    resolveDeferred = res;
    rejectDeferred = rej;
  });

  const entry = {
    resolve: resolveDeferred!,
    reject: rejectDeferred!,
    messages,
  };
  mockQueryDeferred.push(entry);

  return {
    async *[Symbol.asyncIterator]() {
      // Wait for the gate to open before yielding messages
      await gate;
      for (const msg of messages) {
        yield msg;
      }
    },
    close: vi.fn(),
    interrupt: vi.fn(),
    setPermissionMode: vi.fn(),
    setModel: vi.fn(),
    setMaxThinkingTokens: vi.fn(),
    applyFlagSettings: vi.fn(),
    initializationResult: vi.fn(),
    supportedCommands: vi.fn(),
    supportedModels: vi.fn(),
    supportedAgents: vi.fn(),
    stopTask: vi.fn(),
    setMcpServers: vi.fn(),
    streamInput: vi.fn(),
    next: vi.fn(),
    return: vi.fn(),
    throw: vi.fn(),
  };
}

vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn((_params: unknown) => {
    // If there are deferred queries waiting, use the first one
    // Otherwise create an immediate query from mockQueryMessages
    const messages = [...mockQueryMessages];
    return {
      async *[Symbol.asyncIterator]() {
        for (const msg of messages) {
          yield msg;
        }
      },
      close: vi.fn(() => {
        mockQueryCloseCallCount++;
      }),
      interrupt: vi.fn(),
      setPermissionMode: vi.fn(),
      setModel: vi.fn(),
      setMaxThinkingTokens: vi.fn(),
      applyFlagSettings: vi.fn(),
      initializationResult: vi.fn(),
      supportedCommands: vi.fn(),
      supportedModels: vi.fn(),
      supportedAgents: vi.fn(),
      stopTask: vi.fn(),
      setMcpServers: vi.fn(),
      streamInput: vi.fn(),
      next: vi.fn(),
      return: vi.fn(),
      throw: vi.fn(),
    };
  }),
}));

// Must import after mock setup
import { AgentManager, type TaskUpdate } from '../../src/main/agent-manager.js';

const sampleDom: DomExtractionResult = {
  elements: [
    {
      tag: 'div',
      id: 'main',
      classes: ['container'],
      text: 'Hello',
      bounds: { x: 0, y: 0, width: 100, height: 100 },
      path: 'div#main',
    },
  ],
  viewport: { width: 1920, height: 1080 },
};

const sampleBounds: CSSRect = { x: 0, y: 0, width: 100, height: 100 };
const sampleScreenshot = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

function makeInput(instruction = 'change it') {
  return {
    instruction,
    screenshot: sampleScreenshot,
    dom: sampleDom,
    bounds: sampleBounds,
  };
}

describe('AgentManager', () => {
  let manager: AgentManager;
  let updates: TaskUpdate[];

  beforeEach(async () => {
    mockQueryMessages = [];
    mockQueryCloseCallCount = 0;
    mockQueryDeferred = [];
    manager = new AgentManager('/test/project');
    updates = [];
    manager.setOnTaskUpdate((update) => {
      updates.push(update);
    });
    // Restore the default mock implementation (vi.clearAllMocks removes it)
    const sdk = await import('@anthropic-ai/claude-agent-sdk');
    (sdk.query as ReturnType<typeof vi.fn>).mockImplementation((_params: unknown) => {
      const messages = [...mockQueryMessages];
      return {
        async *[Symbol.asyncIterator]() {
          for (const msg of messages) {
            yield msg;
          }
        },
        close: vi.fn(() => { mockQueryCloseCallCount++; }),
        interrupt: vi.fn(),
        setPermissionMode: vi.fn(),
        setModel: vi.fn(),
        setMaxThinkingTokens: vi.fn(),
        applyFlagSettings: vi.fn(),
        initializationResult: vi.fn(),
        supportedCommands: vi.fn(),
        supportedModels: vi.fn(),
        supportedAgents: vi.fn(),
        stopTask: vi.fn(),
        setMcpServers: vi.fn(),
        streamInput: vi.fn(),
        next: vi.fn(),
        return: vi.fn(),
        throw: vi.fn(),
      };
    });
  });

  it('submitTask creates a task with queued status and returns a task ID', async () => {
    // Use deferred so the query doesn't complete immediately
    const { query: mockQuery } = await import('@anthropic-ai/claude-agent-sdk');
    (mockQuery as ReturnType<typeof vi.fn>).mockImplementationOnce(() =>
      createDeferredQuery([]),
    );

    const id = await manager.submitTask(makeInput());
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
    // First update should show queued
    const queuedUpdate = updates.find((u) => u.id === id && u.status === 'queued');
    expect(queuedUpdate).toBeDefined();
  });

  it('submitTask calls processQueue and transitions to sending when under limit', async () => {
    const { query: mockQuery } = await import('@anthropic-ai/claude-agent-sdk');
    (mockQuery as ReturnType<typeof vi.fn>).mockImplementationOnce(() =>
      createDeferredQuery([]),
    );

    const id = await manager.submitTask(makeInput());
    // Should transition to sending since activeCount starts at 0 (< maxParallel=3)
    const sendingUpdate = updates.find((u) => u.id === id && u.status === 'sending');
    expect(sendingUpdate).toBeDefined();
  });

  it('executeTask transitions sending -> editing -> done on success', async () => {
    mockQueryMessages = [
      { type: 'system', subtype: 'init', tools: [], mcp_servers: [], model: 'claude-4' },
      { type: 'result', subtype: 'success', result: 'Done!', is_error: false, duration_ms: 100 },
    ];

    const id = await manager.submitTask(makeInput());
    // Wait for the query to complete
    await vi.waitFor(() => {
      const doneUpdate = updates.find((u) => u.id === id && u.status === 'done');
      expect(doneUpdate).toBeDefined();
    });

    const statuses = updates.filter((u) => u.id === id).map((u) => u.status);
    expect(statuses).toContain('queued');
    expect(statuses).toContain('sending');
    expect(statuses).toContain('editing');
    expect(statuses).toContain('done');
  });

  it('executeTask sets error status on SDK error result', async () => {
    mockQueryMessages = [
      { type: 'system', subtype: 'init', tools: [], mcp_servers: [], model: 'claude-4' },
      {
        type: 'result',
        subtype: 'error_during_execution',
        is_error: true,
        errors: ['authentication_failed'],
        duration_ms: 50,
      },
    ];

    const id = await manager.submitTask(makeInput());
    await vi.waitFor(() => {
      const errorUpdate = updates.find((u) => u.id === id && u.status === 'error');
      expect(errorUpdate).toBeDefined();
    });

    const errorUpdate = updates.find((u) => u.id === id && u.status === 'error');
    expect(errorUpdate!.error).toBeDefined();
    expect(errorUpdate!.error!.length).toBeGreaterThan(0);
  });

  it('emitTaskUpdate calls onTaskUpdate callback for each status change', async () => {
    mockQueryMessages = [
      { type: 'system', subtype: 'init', tools: [], mcp_servers: [], model: 'claude-4' },
      { type: 'result', subtype: 'success', result: 'Done!', is_error: false, duration_ms: 100 },
    ];

    const id = await manager.submitTask(makeInput());
    await vi.waitFor(() => {
      const doneUpdate = updates.find((u) => u.id === id && u.status === 'done');
      expect(doneUpdate).toBeDefined();
    });

    // Should have at least: queued, sending, editing, done
    expect(updates.length).toBeGreaterThanOrEqual(4);
    for (const update of updates) {
      expect(update).toHaveProperty('id');
      expect(update).toHaveProperty('instruction');
      expect(update).toHaveProperty('status');
    }
  });

  it('enforces concurrency limit of 3 parallel agents', async () => {
    const { query: mockQuery } = await import('@anthropic-ai/claude-agent-sdk');

    // All tasks use deferred queries that won't resolve
    (mockQuery as ReturnType<typeof vi.fn>).mockImplementation(() =>
      createDeferredQuery([]),
    );

    await manager.submitTask(makeInput('task 1'));
    await manager.submitTask(makeInput('task 2'));
    await manager.submitTask(makeInput('task 3'));
    const id4 = await manager.submitTask(makeInput('task 4'));

    // First 3 should be sending, 4th should still be queued
    const task4Statuses = updates
      .filter((u) => u.id === id4)
      .map((u) => u.status);
    expect(task4Statuses).toContain('queued');
    expect(task4Statuses).not.toContain('sending');
  });

  it('drains queue when an active task completes', async () => {
    const { query: mockQuery } = await import('@anthropic-ai/claude-agent-sdk');

    // First 3 tasks: deferred (won't complete immediately)
    // We'll resolve the first one to make room for the 4th
    const deferredQueries: ReturnType<typeof createDeferredQuery>[] = [];
    (mockQuery as ReturnType<typeof vi.fn>).mockImplementation(() => {
      const dq = createDeferredQuery([
        { type: 'system', subtype: 'init', tools: [], mcp_servers: [], model: 'claude-4' },
        { type: 'result', subtype: 'success', result: 'Done', is_error: false, duration_ms: 10 },
      ]);
      deferredQueries.push(dq);
      return dq;
    });

    await manager.submitTask(makeInput('task 1'));
    await manager.submitTask(makeInput('task 2'));
    await manager.submitTask(makeInput('task 3'));
    const id4 = await manager.submitTask(makeInput('task 4'));

    // 4th should be queued
    expect(updates.filter((u) => u.id === id4).map((u) => u.status)).toContain('queued');

    // Resolve the first deferred query
    mockQueryDeferred[0].resolve(undefined);

    // Wait for the 4th task to start
    await vi.waitFor(() => {
      const sendingUpdate = updates.find((u) => u.id === id4 && u.status === 'sending');
      expect(sendingUpdate).toBeDefined();
    });
  });

  it('retryTask creates a new task with the original instruction', async () => {
    mockQueryMessages = [
      { type: 'system', subtype: 'init', tools: [], mcp_servers: [], model: 'claude-4' },
      {
        type: 'result',
        subtype: 'error_during_execution',
        is_error: true,
        errors: ['server_error'],
        duration_ms: 50,
      },
    ];

    const originalInstruction = 'make button bigger';
    const id = await manager.submitTask(makeInput(originalInstruction));
    await vi.waitFor(() => {
      expect(updates.find((u) => u.id === id && u.status === 'error')).toBeDefined();
    });

    // Now retry with fresh screenshot/dom
    mockQueryMessages = [
      { type: 'system', subtype: 'init', tools: [], mcp_servers: [], model: 'claude-4' },
      { type: 'result', subtype: 'success', result: 'Done!', is_error: false, duration_ms: 100 },
    ];

    const newId = await manager.retryTask(id);
    expect(newId).not.toBe(id);

    // The new task should use the original instruction
    const newTaskUpdates = updates.filter((u) => u.id === newId);
    expect(newTaskUpdates[0].instruction).toBe(originalInstruction);
  });

  it('dismissTask removes the task from the internal map', async () => {
    const { query: mockQuery } = await import('@anthropic-ai/claude-agent-sdk');
    (mockQuery as ReturnType<typeof vi.fn>).mockImplementationOnce(() =>
      createDeferredQuery([]),
    );

    const id = await manager.submitTask(makeInput());
    expect(manager.getTask(id)).toBeDefined();

    manager.dismissTask(id);
    expect(manager.getTask(id)).toBeUndefined();
  });

  it('dismissTask aborts active query via AbortController', async () => {
    const { query: mockQuery } = await import('@anthropic-ai/claude-agent-sdk');

    let capturedAbortController: AbortController | undefined;
    (mockQuery as ReturnType<typeof vi.fn>).mockImplementationOnce((params: { options?: { abortController?: AbortController } }) => {
      capturedAbortController = params.options?.abortController;
      return createDeferredQuery([]);
    });

    const id = await manager.submitTask(makeInput());
    // Wait for sending state
    await vi.waitFor(() => {
      expect(updates.find((u) => u.id === id && u.status === 'sending')).toBeDefined();
    });

    expect(capturedAbortController).toBeDefined();
    expect(capturedAbortController!.signal.aborted).toBe(false);

    manager.dismissTask(id);
    expect(capturedAbortController!.signal.aborted).toBe(true);
  });

  it('shutdown aborts all active queries', async () => {
    const { query: mockQuery } = await import('@anthropic-ai/claude-agent-sdk');

    const abortControllers: AbortController[] = [];
    (mockQuery as ReturnType<typeof vi.fn>).mockImplementation((params: { options?: { abortController?: AbortController } }) => {
      if (params.options?.abortController) {
        abortControllers.push(params.options.abortController);
      }
      return createDeferredQuery([]);
    });

    await manager.submitTask(makeInput('task 1'));
    await manager.submitTask(makeInput('task 2'));

    manager.shutdown();

    for (const ac of abortControllers) {
      expect(ac.signal.aborted).toBe(true);
    }
  });

  it('maps SDK error messages to human-readable strings', async () => {
    // Test with authentication_failed error
    mockQueryMessages = [
      { type: 'system', subtype: 'init', tools: [], mcp_servers: [], model: 'claude-4' },
      {
        type: 'result',
        subtype: 'error_during_execution',
        is_error: true,
        errors: ['authentication_failed'],
        duration_ms: 50,
      },
    ];

    const id = await manager.submitTask(makeInput());
    await vi.waitFor(() => {
      expect(updates.find((u) => u.id === id && u.status === 'error')).toBeDefined();
    });

    const errorUpdate = updates.find((u) => u.id === id && u.status === 'error');
    expect(errorUpdate!.error).toContain('claude login');
  });

  it('detects auth errors on SDKAssistantMessage.error and overrides success result', async () => {
    mockQueryMessages = [
      { type: 'system', subtype: 'init', tools: [], mcp_servers: [], model: 'claude-4' },
      {
        type: 'assistant',
        error: 'authentication_failed',
        message: { content: [{ type: 'text', text: 'Invalid API key' }] },
      },
      { type: 'result', subtype: 'success', result: '', is_error: false, duration_ms: 50 },
    ];

    const id = await manager.submitTask(makeInput());
    await vi.waitFor(() => {
      const final = updates.filter((u) => u.id === id);
      const hasResult = final.some((u) => u.status === 'error' || u.status === 'done');
      expect(hasResult).toBe(true);
    });

    // Should be error, NOT done
    const statuses = updates.filter((u) => u.id === id).map((u) => u.status);
    expect(statuses).toContain('error');
    expect(statuses).not.toContain('done');

    const errorUpdate = updates.find((u) => u.id === id && u.status === 'error');
    expect(errorUpdate!.error).toContain('claude login');
  });

  it('detects auth errors on SDKAuthStatusMessage and overrides success result', async () => {
    mockQueryMessages = [
      { type: 'system', subtype: 'init', tools: [], mcp_servers: [], model: 'claude-4' },
      {
        type: 'auth_status',
        isAuthenticating: false,
        output: [],
        error: 'Invalid API key',
      },
      { type: 'result', subtype: 'success', result: '', is_error: false, duration_ms: 50 },
    ];

    const id = await manager.submitTask(makeInput());
    await vi.waitFor(() => {
      const final = updates.filter((u) => u.id === id);
      const hasResult = final.some((u) => u.status === 'error' || u.status === 'done');
      expect(hasResult).toBe(true);
    });

    // Should be error, NOT done
    const statuses = updates.filter((u) => u.id === id).map((u) => u.status);
    expect(statuses).toContain('error');
    expect(statuses).not.toContain('done');

    const errorUpdate = updates.find((u) => u.id === id && u.status === 'error');
    expect(errorUpdate!.error).toContain('claude login');
  });

  it('logs auth status and assistant errors to task logs', async () => {
    mockQueryMessages = [
      { type: 'system', subtype: 'init', tools: [], mcp_servers: [], model: 'claude-4' },
      {
        type: 'assistant',
        error: 'billing_error',
        message: { content: [{ type: 'text', text: 'Billing issue' }] },
      },
      { type: 'result', subtype: 'success', result: '', is_error: false, duration_ms: 50 },
    ];

    const id = await manager.submitTask(makeInput());
    await vi.waitFor(() => {
      const final = updates.filter((u) => u.id === id);
      expect(final.some((u) => u.status === 'error' || u.status === 'done')).toBe(true);
    });

    const logs = manager.getTaskLogs(id);
    const apiErrorLog = logs.find((l) => l.content.includes('API error: billing_error'));
    expect(apiErrorLog).toBeDefined();
    expect(apiErrorLog!.type).toBe('status');
  });
});
