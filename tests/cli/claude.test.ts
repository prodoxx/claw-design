import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock child_process before importing the module under test
vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(),
}));

// Mock the Agent SDK
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(),
}));

import { execFileSync } from 'node:child_process';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { isClaudeInstalled, spawnClaudeSession } from '../../src/cli/utils/claude.js';

const mockExecFileSync = vi.mocked(execFileSync);
const mockQuery = vi.mocked(query);

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

describe('spawnClaudeSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls query() from Agent SDK with correct options', async () => {
    const mockClose = vi.fn();
    const mockAbort = vi.fn();
    // Create a minimal async generator that the query mock returns
    const fakeQuery = {
      close: mockClose,
      abort: mockAbort,
      [Symbol.asyncIterator]: async function* () {
        // empty generator
      },
    };
    mockQuery.mockReturnValue(fakeQuery as any);

    await spawnClaudeSession('/test/project');

    expect(mockQuery).toHaveBeenCalledTimes(1);
    const callArgs = mockQuery.mock.calls[0][0];

    // Verify cwd is set
    expect(callArgs.options?.cwd).toBe('/test/project');

    // Verify systemPrompt preset
    expect(callArgs.options?.systemPrompt).toMatchObject({
      type: 'preset',
      preset: 'claude_code',
    });

    // Verify systemPrompt has append text mentioning claw-design
    expect((callArgs.options?.systemPrompt as any)?.append).toContain('claw-design');

    // Verify allowedTools contains Read, Write, Edit
    expect(callArgs.options?.allowedTools).toEqual(
      expect.arrayContaining(['Read', 'Write', 'Edit'])
    );
  });

  it('returned object has sendMessage and close functions', async () => {
    const mockClose = vi.fn();
    const fakeQuery = {
      close: mockClose,
      [Symbol.asyncIterator]: async function* () {},
    };
    mockQuery.mockReturnValue(fakeQuery as any);

    const session = await spawnClaudeSession('/test/project');

    expect(typeof session.sendMessage).toBe('function');
    expect(typeof session.close).toBe('function');
  });

  it('close() calls query.close() on the Agent SDK query object', async () => {
    const mockClose = vi.fn();
    const fakeQuery = {
      close: mockClose,
      [Symbol.asyncIterator]: async function* () {},
    };
    mockQuery.mockReturnValue(fakeQuery as any);

    const session = await spawnClaudeSession('/test/project');
    session.close();

    expect(mockClose).toHaveBeenCalledTimes(1);
  });
});
