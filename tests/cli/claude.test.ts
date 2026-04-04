import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock child_process before importing the module under test
vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(),
}));

import { execFileSync } from 'node:child_process';
import { isClaudeInstalled } from '../../src/cli/utils/claude.js';

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

// Note: spawnClaudeSession tests removed.
// Claude session management moved to AgentManager in Electron main process.
// See tests/main/agent-manager.test.ts for coverage.
