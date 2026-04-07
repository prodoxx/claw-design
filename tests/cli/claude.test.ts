import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock child_process before importing the module under test
vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(),
}));

import { execFileSync } from 'node:child_process';
import { isClaudeInstalled, getClaudeAuthStatus } from '../../src/cli/utils/claude.js';

const mockExecFileSync = vi.mocked(execFileSync);

describe('isClaudeInstalled', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns true when execFileSync succeeds (claude found in PATH)', () => {
    mockExecFileSync.mockReturnValue('');
    expect(isClaudeInstalled()).toBe(true);
  });

  it('returns false when execFileSync throws (claude not found)', () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error('ENOENT');
    });
    expect(isClaudeInstalled()).toBe(false);
  });

  it('calls execFileSync with "which" and ["claude"]', () => {
    mockExecFileSync.mockReturnValue('');
    isClaudeInstalled();
    expect(mockExecFileSync).toHaveBeenCalledWith('which', ['claude'], { stdio: 'ignore' });
  });
});

describe('getClaudeAuthStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns loggedIn: true when claude auth status reports loggedIn', () => {
    mockExecFileSync.mockReturnValue(JSON.stringify({
      loggedIn: true,
      authMethod: 'claude.ai',
      apiProvider: 'firstParty',
      apiKeySource: 'oauth',
      email: 'user@example.com',
    }));

    const status = getClaudeAuthStatus();
    expect(status.loggedIn).toBe(true);
    expect(status.authMethod).toBe('claude.ai');
    expect(status.email).toBe('user@example.com');
  });

  it('returns loggedIn: false when claude auth status reports not logged in', () => {
    mockExecFileSync.mockReturnValue(JSON.stringify({
      loggedIn: false,
    }));

    const status = getClaudeAuthStatus();
    expect(status.loggedIn).toBe(false);
  });

  it('returns loggedIn: false when the command throws', () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error('ENOENT');
    });

    const status = getClaudeAuthStatus();
    expect(status.loggedIn).toBe(false);
  });

  it('returns loggedIn: false when output is not valid JSON', () => {
    mockExecFileSync.mockReturnValue('not json');

    const status = getClaudeAuthStatus();
    expect(status.loggedIn).toBe(false);
  });

  it('calls claude auth status --json with correct options', () => {
    mockExecFileSync.mockReturnValue(JSON.stringify({ loggedIn: true }));
    getClaudeAuthStatus();

    expect(mockExecFileSync).toHaveBeenCalledWith(
      'claude',
      ['auth', 'status', '--json'],
      expect.objectContaining({
        encoding: 'utf-8',
        timeout: 10_000,
      }),
    );
  });
});

// Note: spawnClaudeSession tests removed.
// Claude session management moved to AgentManager in Electron main process.
// See tests/main/agent-manager.test.ts for coverage.
