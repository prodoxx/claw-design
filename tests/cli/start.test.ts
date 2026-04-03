import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';

// Mock all five utility modules
vi.mock('../../src/cli/utils/dev-server.js', () => ({
  detectDevServerScript: vi.fn(),
  detectPackageManager: vi.fn(),
  spawnDevServer: vi.fn(),
  DetectionError: class DetectionError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'DetectionError';
    }
  },
}));

vi.mock('../../src/cli/utils/port-detect.js', () => ({
  extractPortFromOutput: vi.fn(),
  waitForPort: vi.fn(),
  getProcessOnPort: vi.fn(),
}));

vi.mock('../../src/cli/utils/claude.js', () => ({
  isClaudeInstalled: vi.fn(),
  spawnClaudeSession: vi.fn(),
}));

vi.mock('../../src/cli/utils/electron.js', () => ({
  buildElectron: vi.fn(),
  spawnElectron: vi.fn(),
}));

vi.mock('../../src/cli/utils/process.js', () => ({
  registerShutdownHandlers: vi.fn(),
}));

vi.mock('../../src/cli/utils/output.js', () => ({
  createSpinner: vi.fn(),
  printReady: vi.fn(),
  printError: vi.fn(),
  printHeader: vi.fn(),
}));

vi.mock('node:fs', () => ({
  readFileSync: vi.fn(() => JSON.stringify({ name: 'test-project' })),
}));

// Mock picocolors to pass through strings (no ANSI codes in tests)
vi.mock('picocolors', () => ({
  default: {
    cyan: (s: string) => s,
    dim: (s: string) => s,
    yellow: (s: string) => s,
    green: (s: string) => s,
    red: (s: string) => s,
    bold: (s: string) => s,
  },
}));

import { detectDevServerScript, detectPackageManager, spawnDevServer, DetectionError } from '../../src/cli/utils/dev-server.js';
import { extractPortFromOutput, waitForPort, getProcessOnPort } from '../../src/cli/utils/port-detect.js';
import { isClaudeInstalled, spawnClaudeSession } from '../../src/cli/utils/claude.js';
import { buildElectron, spawnElectron } from '../../src/cli/utils/electron.js';
import { registerShutdownHandlers } from '../../src/cli/utils/process.js';
import { createSpinner, printReady, printError } from '../../src/cli/utils/output.js';
import { startCommand } from '../../src/cli/commands/start.js';

const mockDetectDevServerScript = vi.mocked(detectDevServerScript);
const mockDetectPackageManager = vi.mocked(detectPackageManager);
const mockSpawnDevServer = vi.mocked(spawnDevServer);
const mockExtractPortFromOutput = vi.mocked(extractPortFromOutput);
const mockWaitForPort = vi.mocked(waitForPort);
const mockGetProcessOnPort = vi.mocked(getProcessOnPort);
const mockIsClaudeInstalled = vi.mocked(isClaudeInstalled);
const mockSpawnClaudeSession = vi.mocked(spawnClaudeSession);
const mockBuildElectron = vi.mocked(buildElectron);
const mockSpawnElectron = vi.mocked(spawnElectron);
const mockRegisterShutdownHandlers = vi.mocked(registerShutdownHandlers);
const mockCreateSpinner = vi.mocked(createSpinner);
const mockPrintReady = vi.mocked(printReady);
const mockPrintError = vi.mocked(printError);

// Mock spinner object returned by createSpinner
function makeMockSpinner() {
  return {
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn(),
    fail: vi.fn(),
    stop: vi.fn(),
    text: '',
    // ora has many other properties but these are all we use
  } as any;
}

// Create a mock dev server ChildProcess with EventEmitter-based stdout/stderr
function makeMockDevServer() {
  const stdout = new EventEmitter();
  const stderr = new EventEmitter();
  const proc = new EventEmitter() as EventEmitter & {
    pid: number;
    stdout: EventEmitter;
    stderr: EventEmitter;
  };
  proc.pid = 12345;
  proc.stdout = stdout;
  proc.stderr = stderr;
  return proc;
}

// Create a mock Electron ChildProcess
function makeMockElectronProcess() {
  const proc = new EventEmitter() as EventEmitter & {
    pid: number;
    on: (event: string, listener: (...args: any[]) => void) => any;
  };
  proc.pid = 54321;
  return proc;
}

// Track process.exit calls without actually exiting
const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {
  throw new Error('process.exit called');
}) as any);

describe('startCommand', () => {
  let mockSpinner: ReturnType<typeof makeMockSpinner>;
  let mockDevServer: ReturnType<typeof makeMockDevServer>;
  let mockElectronProcess: ReturnType<typeof makeMockElectronProcess>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });

    mockSpinner = makeMockSpinner();
    mockCreateSpinner.mockReturnValue(mockSpinner);
    mockDetectPackageManager.mockResolvedValue('npm');

    mockDevServer = makeMockDevServer();
    mockElectronProcess = makeMockElectronProcess();
    mockSpawnElectron.mockReturnValue(mockElectronProcess as any);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('happy path: detects dev server, waits for port, launches Claude', async () => {
    // Setup all mocks for success path
    mockIsClaudeInstalled.mockReturnValue(true);
    mockDetectDevServerScript.mockResolvedValue({ name: 'dev', command: 'vite' });
    mockSpawnDevServer.mockReturnValue(mockDevServer as any);

    // When stdout emits data, extractPortFromOutput should find port 3000
    mockExtractPortFromOutput.mockReturnValue(3000);

    // Emit stdout data after a tick so the listener is registered
    setTimeout(() => {
      mockDevServer.stdout.emit('data', Buffer.from('http://localhost:3000'));
    }, 10);

    mockWaitForPort.mockResolvedValue(undefined);
    mockSpawnClaudeSession.mockResolvedValue({ sendMessage: vi.fn(), close: vi.fn() });

    await startCommand({});

    // Assertions: all 8 steps executed
    expect(mockIsClaudeInstalled).toHaveBeenCalled();
    expect(mockDetectDevServerScript).toHaveBeenCalledWith(process.cwd());
    expect(mockSpawnDevServer).toHaveBeenCalled();
    expect(mockWaitForPort).toHaveBeenCalledWith(3000, { timeout: 30_000 });
    expect(mockSpawnClaudeSession).toHaveBeenCalledWith(process.cwd());
    expect(mockBuildElectron).toHaveBeenCalled();
    expect(mockSpawnElectron).toHaveBeenCalledWith('http://localhost:3000', 'test-project');
    expect(mockRegisterShutdownHandlers).toHaveBeenCalledWith(
      expect.objectContaining({
        devServer: { pid: 12345 },
        claudeSession: expect.objectContaining({ sendMessage: expect.any(Function), close: expect.any(Function) }),
        electronProcess: { pid: 54321 },
      })
    );
    expect(mockPrintReady).toHaveBeenCalledWith(3000);
  });

  it('--cmd flag bypasses auto-detection', async () => {
    mockIsClaudeInstalled.mockReturnValue(true);
    mockSpawnDevServer.mockReturnValue(mockDevServer as any);
    mockExtractPortFromOutput.mockReturnValue(8000);
    mockWaitForPort.mockResolvedValue(undefined);
    mockSpawnClaudeSession.mockResolvedValue({ sendMessage: vi.fn(), close: vi.fn() });

    setTimeout(() => {
      mockDevServer.stdout.emit('data', Buffer.from('Serving on port 8000'));
    }, 10);

    await startCommand({ cmd: 'python -m http.server 8000' });

    // detectDevServerScript should NOT be called
    expect(mockDetectDevServerScript).not.toHaveBeenCalled();
    // spawnDevServer should be called with the custom command
    expect(mockSpawnDevServer).toHaveBeenCalledWith('python -m http.server 8000', false);
  });

  it('--port flag bypasses port auto-detection', async () => {
    mockIsClaudeInstalled.mockReturnValue(true);
    mockDetectDevServerScript.mockResolvedValue({ name: 'dev', command: 'vite' });
    mockSpawnDevServer.mockReturnValue(mockDevServer as any);
    mockWaitForPort.mockResolvedValue(undefined);
    mockSpawnClaudeSession.mockResolvedValue({ sendMessage: vi.fn(), close: vi.fn() });

    await startCommand({ port: '4000' });

    // waitForPort should be called with 4000
    expect(mockWaitForPort).toHaveBeenCalledWith(4000, { timeout: 30_000 });
    // extractPortFromOutput should NOT be called (no stdout listener needed)
    expect(mockExtractPortFromOutput).not.toHaveBeenCalled();
  });

  it('exits when Claude Code not installed', async () => {
    mockIsClaudeInstalled.mockReturnValue(false);

    await expect(startCommand({})).rejects.toThrow('process.exit called');

    expect(mockPrintError).toHaveBeenCalledWith(
      'Claude Code not found',
      expect.any(String),
      expect.stringContaining('https://claude.ai/download')
    );
    expect(mockExit).toHaveBeenCalledWith(1);
    // Should stop before reaching dev server detection
    expect(mockDetectDevServerScript).not.toHaveBeenCalled();
  });

  it('exits when no dev server script found', async () => {
    mockIsClaudeInstalled.mockReturnValue(true);
    mockDetectDevServerScript.mockRejectedValue(new DetectionError('No dev server script found'));

    await expect(startCommand({})).rejects.toThrow('process.exit called');

    expect(mockExit).toHaveBeenCalledWith(1);
    expect(mockSpinner.fail).toHaveBeenCalled();
  });

  it('exits on port readiness timeout', async () => {
    mockIsClaudeInstalled.mockReturnValue(true);
    mockDetectDevServerScript.mockResolvedValue({ name: 'dev', command: 'vite' });
    mockSpawnDevServer.mockReturnValue(mockDevServer as any);
    mockExtractPortFromOutput.mockReturnValue(3000);
    mockWaitForPort.mockRejectedValue(new Error('Timeout: port 3000 not ready after 30s'));
    mockGetProcessOnPort.mockReturnValue(null);

    setTimeout(() => {
      mockDevServer.stdout.emit('data', Buffer.from('http://localhost:3000'));
    }, 10);

    await expect(startCommand({})).rejects.toThrow('process.exit called');

    expect(mockExit).toHaveBeenCalledWith(1);
    expect(mockPrintError).toHaveBeenCalledWith(
      'Startup timeout',
      expect.stringContaining('not ready after 30s'),
      expect.stringContaining('--verbose')
    );
  });

  it('uses pnpm when pnpm lockfile detected', async () => {
    mockIsClaudeInstalled.mockReturnValue(true);
    mockDetectDevServerScript.mockResolvedValue({ name: 'dev', command: 'vite' });
    mockDetectPackageManager.mockResolvedValue('pnpm');
    mockSpawnDevServer.mockReturnValue(mockDevServer as any);
    mockExtractPortFromOutput.mockReturnValue(3000);
    mockWaitForPort.mockResolvedValue(undefined);
    mockSpawnClaudeSession.mockResolvedValue({ sendMessage: vi.fn(), close: vi.fn() });

    setTimeout(() => {
      mockDevServer.stdout.emit('data', Buffer.from('http://localhost:3000'));
    }, 10);

    await startCommand({});

    expect(mockSpawnDevServer).toHaveBeenCalledWith('pnpm run dev', false);
  });

  it('uses bun when bun lockfile detected', async () => {
    mockIsClaudeInstalled.mockReturnValue(true);
    mockDetectDevServerScript.mockResolvedValue({ name: 'dev', command: 'vite' });
    mockDetectPackageManager.mockResolvedValue('bun');
    mockSpawnDevServer.mockReturnValue(mockDevServer as any);
    mockExtractPortFromOutput.mockReturnValue(3000);
    mockWaitForPort.mockResolvedValue(undefined);
    mockSpawnClaudeSession.mockResolvedValue({ sendMessage: vi.fn(), close: vi.fn() });

    setTimeout(() => {
      mockDevServer.stdout.emit('data', Buffer.from('http://localhost:3000'));
    }, 10);

    await startCommand({});

    expect(mockSpawnDevServer).toHaveBeenCalledWith('bun run dev', false);
  });

  it('handles dev server crash without exiting', async () => {
    mockIsClaudeInstalled.mockReturnValue(true);
    mockDetectDevServerScript.mockResolvedValue({ name: 'dev', command: 'vite' });
    mockSpawnDevServer.mockReturnValue(mockDevServer as any);
    mockExtractPortFromOutput.mockReturnValue(3000);
    mockWaitForPort.mockResolvedValue(undefined);
    mockSpawnClaudeSession.mockResolvedValue({ sendMessage: vi.fn(), close: vi.fn() });

    setTimeout(() => {
      mockDevServer.stdout.emit('data', Buffer.from('http://localhost:3000'));
    }, 10);

    await startCommand({});

    // Reset exit mock call count after startCommand completes (should be 0)
    mockExit.mockClear();

    // Simulate dev server crash
    mockDevServer.emit('exit', 1, null);

    // process.exit should NOT have been called after dev server exit (per D-13)
    expect(mockExit).not.toHaveBeenCalled();
  });
});
