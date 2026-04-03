import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFile } from 'node:fs/promises';

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
}));

const mockedReadFile = vi.mocked(readFile);

// Import after mock setup
const { detectDevServerScript, DetectionError, SCRIPT_PRIORITY } = await import(
  '../../src/cli/utils/dev-server.js'
);

describe('detectDevServerScript', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('detects dev script in priority order', async () => {
    mockedReadFile.mockResolvedValue(
      JSON.stringify({
        scripts: {
          dev: 'vite',
          start: 'next start',
          serve: 'serve .',
        },
      })
    );

    const result = await detectDevServerScript('/project');
    expect(result).toEqual({ name: 'dev', command: 'vite' });
  });

  it('falls back to start when no dev script', async () => {
    mockedReadFile.mockResolvedValue(
      JSON.stringify({
        scripts: {
          start: 'next start',
          serve: 'serve .',
        },
      })
    );

    const result = await detectDevServerScript('/project');
    expect(result).toEqual({ name: 'start', command: 'next start' });
  });

  it('falls back to serve as last resort', async () => {
    mockedReadFile.mockResolvedValue(
      JSON.stringify({
        scripts: {
          serve: 'serve .',
        },
      })
    );

    const result = await detectDevServerScript('/project');
    expect(result).toEqual({ name: 'serve', command: 'serve .' });
  });

  it('throws DetectionError when no matching scripts', async () => {
    mockedReadFile.mockResolvedValue(
      JSON.stringify({
        scripts: {
          build: 'tsc',
          lint: 'eslint .',
        },
      })
    );

    await expect(detectDevServerScript('/project')).rejects.toThrow(DetectionError);
    await expect(detectDevServerScript('/project')).rejects.toThrow(
      'No dev server script found'
    );
    await expect(detectDevServerScript('/project')).rejects.toThrow('--cmd');
  });

  it('throws DetectionError when no scripts field', async () => {
    mockedReadFile.mockResolvedValue(
      JSON.stringify({
        name: 'some-project',
      })
    );

    await expect(detectDevServerScript('/project')).rejects.toThrow(DetectionError);
    await expect(detectDevServerScript('/project')).rejects.toThrow(
      'No "scripts" field'
    );
  });

  it('throws when package.json not found', async () => {
    const error = new Error('ENOENT: no such file or directory') as NodeJS.ErrnoException;
    error.code = 'ENOENT';
    mockedReadFile.mockRejectedValue(error);

    await expect(detectDevServerScript('/nonexistent')).rejects.toThrow('ENOENT');
  });

  it('SCRIPT_PRIORITY is dev, start, serve', () => {
    expect(SCRIPT_PRIORITY).toEqual(['dev', 'start', 'serve']);
  });
});
