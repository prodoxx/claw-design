import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock node:fs for checkElectronBinary
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
}));

// Mock node:module for checkElectronBinary (createRequire)
vi.mock('node:module', () => ({
  createRequire: vi.fn(),
}));

import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';

const mockExistsSync = vi.mocked(existsSync);
const mockCreateRequire = vi.mocked(createRequire);

describe('parseNodeMajor', () => {
  it('parses 18.19.0 to 18', async () => {
    const { parseNodeMajor } = await import('../../src/cli/utils/preflight.js');
    expect(parseNodeMajor('18.19.0')).toBe(18);
  });

  it('parses 20.0.0 to 20', async () => {
    const { parseNodeMajor } = await import('../../src/cli/utils/preflight.js');
    expect(parseNodeMajor('20.0.0')).toBe(20);
  });

  it('parses 22.14.0 to 22', async () => {
    const { parseNodeMajor } = await import('../../src/cli/utils/preflight.js');
    expect(parseNodeMajor('22.14.0')).toBe(22);
  });
});

describe('checkNodeVersion', () => {
  it('returns ok true for current Node (test runner requires >= 20)', async () => {
    const { checkNodeVersion } = await import('../../src/cli/utils/preflight.js');
    const result = checkNodeVersion();
    expect(result.ok).toBe(true);
    expect(result.version).toBe(process.versions.node);
  });
});

describe('checkElectronBinary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns true when electron resolves to existing file', async () => {
    const mockRequire = vi.fn().mockReturnValue('/path/to/electron');
    mockCreateRequire.mockReturnValue(mockRequire as any);
    mockExistsSync.mockReturnValue(true);

    const { checkElectronBinary } = await import('../../src/cli/utils/preflight.js');
    expect(checkElectronBinary()).toBe(true);
  });

  it('returns false when require("electron") throws (not installed)', async () => {
    const mockRequire = vi.fn().mockImplementation(() => {
      throw new Error('MODULE_NOT_FOUND');
    });
    mockCreateRequire.mockReturnValue(mockRequire as any);

    const { checkElectronBinary } = await import('../../src/cli/utils/preflight.js');
    expect(checkElectronBinary()).toBe(false);
  });

  it('returns false when resolved path does not exist on disk', async () => {
    const mockRequire = vi.fn().mockReturnValue('/path/to/missing/electron');
    mockCreateRequire.mockReturnValue(mockRequire as any);
    mockExistsSync.mockReturnValue(false);

    const { checkElectronBinary } = await import('../../src/cli/utils/preflight.js');
    expect(checkElectronBinary()).toBe(false);
  });
});
