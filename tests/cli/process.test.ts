import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock tree-kill before importing
vi.mock('tree-kill', () => ({
  default: vi.fn((_pid: number, _signal: string, cb?: (err?: Error) => void) => {
    if (cb) cb();
  }),
}));

import kill from 'tree-kill';
import {
  registerShutdownHandlers,
  resetShutdownState,
  type ManagedProcesses,
} from '../../src/cli/utils/process.js';

const mockKill = vi.mocked(kill);

describe('registerShutdownHandlers', () => {
  const processOnSpy = vi.spyOn(process, 'on');

  beforeEach(() => {
    vi.clearAllMocks();
    resetShutdownState();
  });

  afterEach(() => {
    resetShutdownState();
  });

  it('registers SIGINT listener on process', () => {
    registerShutdownHandlers({});
    expect(processOnSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
  });

  it('registers SIGTERM listener on process', () => {
    registerShutdownHandlers({});
    expect(processOnSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
  });

  it('registers uncaughtException listener on process', () => {
    registerShutdownHandlers({});
    expect(processOnSpy).toHaveBeenCalledWith('uncaughtException', expect.any(Function));
  });
});

describe('shutdown behavior', () => {
  const processExitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    resetShutdownState();
  });

  afterEach(() => {
    vi.useRealTimers();
    resetShutdownState();
  });

  it('calls tree-kill with devServer.pid and SIGTERM when SIGINT fires', () => {
    const processes: ManagedProcesses = {
      devServer: { pid: 12345 },
    };
    registerShutdownHandlers(processes);

    // Find and call the SIGINT handler
    const sigintCall = vi.mocked(process.on).mock.calls.find(
      (call) => call[0] === 'SIGINT'
    );
    expect(sigintCall).toBeDefined();
    const handler = sigintCall![1] as Function;
    handler();

    expect(mockKill).toHaveBeenCalledWith(12345, 'SIGTERM', expect.any(Function));
  });

  it('calls claudeSession.close() when SIGINT fires', () => {
    const mockClose = vi.fn();
    const processes: ManagedProcesses = {
      claudeSession: { close: mockClose },
    };
    registerShutdownHandlers(processes);

    const sigintCall = vi.mocked(process.on).mock.calls.find(
      (call) => call[0] === 'SIGINT'
    );
    const handler = sigintCall![1] as Function;
    handler();

    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it('second shutdown call is no-op (tree-kill called only once, not twice)', () => {
    const processes: ManagedProcesses = {
      devServer: { pid: 12345 },
    };
    registerShutdownHandlers(processes);

    const sigintCall = vi.mocked(process.on).mock.calls.find(
      (call) => call[0] === 'SIGINT'
    );
    const handler = sigintCall![1] as Function;

    // First call
    handler();
    // Second call -- should be no-op
    handler();

    // tree-kill should only be called once (from first shutdown)
    expect(mockKill).toHaveBeenCalledTimes(1);
  });

  it('calls process.exit after shutdown', () => {
    const processes: ManagedProcesses = {};
    registerShutdownHandlers(processes);

    const sigintCall = vi.mocked(process.on).mock.calls.find(
      (call) => call[0] === 'SIGINT'
    );
    const handler = sigintCall![1] as Function;
    handler();

    expect(processExitSpy).toHaveBeenCalledWith(0);
  });

  it('sets a 5-second force exit timeout', () => {
    const setTimeoutSpy = vi.spyOn(global, 'setTimeout');
    const processes: ManagedProcesses = {};
    registerShutdownHandlers(processes);

    const sigintCall = vi.mocked(process.on).mock.calls.find(
      (call) => call[0] === 'SIGINT'
    );
    const handler = sigintCall![1] as Function;
    handler();

    // Should have called setTimeout with 5000ms
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 5000);
  });
});
