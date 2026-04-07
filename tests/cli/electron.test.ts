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

import { spawn } from 'node:child_process';
import { spawnElectron } from '../../src/cli/utils/electron.js';

const mockSpawn = vi.mocked(spawn);

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

  it('sets CLAW_PROJECT_DIR env var to process.cwd()', () => {
    spawnElectron('http://localhost:3000', 'my-app');
    const options = mockSpawn.mock.calls[0][2] as { env: Record<string, string> };
    expect(options.env.CLAW_PROJECT_DIR).toBe(process.cwd());
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
