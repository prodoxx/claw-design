import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock child_process before importing the module under test
vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(),
  spawn: vi.fn(),
}));

// Mock node:module's createRequire to control the electron path resolution
vi.mock('node:module', () => ({
  createRequire: vi.fn(() => {
    // Return a mock require function that resolves 'electron' to a path string
    return (id: string) => {
      if (id === 'electron') return '/mock/electron/binary';
      throw new Error(`Unexpected require: ${id}`);
    };
  }),
}));

import { execFileSync, spawn } from 'node:child_process';
import { buildElectron, spawnElectron } from '../../src/cli/utils/electron.js';

const mockExecFileSync = vi.mocked(execFileSync);
const mockSpawn = vi.mocked(spawn);

describe('buildElectron', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls execFileSync with npx and electron-vite build args', () => {
    buildElectron();
    expect(mockExecFileSync).toHaveBeenCalledWith(
      'npx',
      ['electron-vite', 'build'],
      expect.any(Object),
    );
  });

  it('uses cwd option pointing to the project root', () => {
    buildElectron();
    const callArgs = mockExecFileSync.mock.calls[0];
    const options = callArgs[2] as { cwd: string };
    // The cwd should be an absolute path (the project root)
    expect(options.cwd).toBeDefined();
    expect(typeof options.cwd).toBe('string');
    // The project root should NOT end with src/cli/utils
    expect(options.cwd).not.toContain('src/cli/utils');
  });
});

describe('spawnElectron', () => {
  const mockChildProcess = {
    pid: 99999,
    stdout: null,
    stderr: null,
    stdin: null,
    on: vi.fn(),
    kill: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSpawn.mockReturnValue(mockChildProcess as any);
  });

  it('calls spawn with the electron binary path', () => {
    spawnElectron('http://localhost:3000', 'my-app');
    expect(mockSpawn).toHaveBeenCalledWith(
      '/mock/electron/binary',
      expect.any(Array),
      expect.any(Object),
    );
  });

  it('passes the built main script as first argument to electron', () => {
    spawnElectron('http://localhost:3000', 'my-app');
    const args = mockSpawn.mock.calls[0][1] as string[];
    expect(args[0]).toContain('out/main/index.js');
  });

  it('sets CLAW_URL env var to the provided url', () => {
    spawnElectron('http://localhost:3000', 'my-app');
    const options = mockSpawn.mock.calls[0][2] as { env: Record<string, string> };
    expect(options.env.CLAW_URL).toBe('http://localhost:3000');
  });

  it('sets CLAW_PROJECT_NAME env var to the provided projectName', () => {
    spawnElectron('http://localhost:3000', 'my-app');
    const options = mockSpawn.mock.calls[0][2] as { env: Record<string, string> };
    expect(options.env.CLAW_PROJECT_NAME).toBe('my-app');
  });

  it('sets CLAW_CWD env var to process.cwd()', () => {
    spawnElectron('http://localhost:3000', 'my-app');
    const options = mockSpawn.mock.calls[0][2] as { env: Record<string, string> };
    expect(options.env.CLAW_CWD).toBe(process.cwd());
  });

  it('returns the spawned ChildProcess', () => {
    const result = spawnElectron('http://localhost:3000', 'my-app');
    expect(result).toBe(mockChildProcess);
  });

  it('uses stdio: [pipe, pipe, pipe]', () => {
    spawnElectron('http://localhost:3000', 'my-app');
    const options = mockSpawn.mock.calls[0][2] as { stdio: string[] };
    expect(options.stdio).toEqual(['pipe', 'pipe', 'pipe']);
  });
});
