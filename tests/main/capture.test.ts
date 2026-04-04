import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computeDeviceRect, type CSSRect } from '../../src/main/capture.js';

// --- Pure function tests (no Electron mocks needed) ---

describe('computeDeviceRect', () => {
  it('passes rect unchanged at scaleFactor 1', () => {
    const cssRect: CSSRect = { x: 10, y: 20, width: 100, height: 50 };
    const result = computeDeviceRect(cssRect, 1);
    expect(result).toEqual({ x: 10, y: 20, width: 100, height: 50 });
  });

  it('doubles coordinates at scaleFactor 2', () => {
    const cssRect: CSSRect = { x: 10, y: 20, width: 100, height: 50 };
    const result = computeDeviceRect(cssRect, 2);
    expect(result).toEqual({ x: 20, y: 40, width: 200, height: 100 });
  });

  it('applies fractional scale with Math.round at scaleFactor 1.5', () => {
    const cssRect: CSSRect = { x: 10, y: 10, width: 100, height: 100 };
    const result = computeDeviceRect(cssRect, 1.5);
    expect(result).toEqual({ x: 15, y: 15, width: 150, height: 150 });
  });

  it('handles zero-size rect', () => {
    const cssRect: CSSRect = { x: 0, y: 0, width: 0, height: 0 };
    const result = computeDeviceRect(cssRect, 2);
    expect(result).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });

  it('handles large rect values', () => {
    const cssRect: CSSRect = { x: 5000, y: 3000, width: 10000, height: 8000 };
    const result = computeDeviceRect(cssRect, 2);
    expect(result).toEqual({ x: 10000, y: 6000, width: 20000, height: 16000 });
  });

  it('rounds correctly for non-integer results at scaleFactor 1.5', () => {
    const cssRect: CSSRect = { x: 7, y: 3, width: 11, height: 9 };
    const result = computeDeviceRect(cssRect, 1.5);
    // 7*1.5=10.5 -> 11, 3*1.5=4.5 -> 5 (Math.round rounds .5 up), 11*1.5=16.5 -> 17, 9*1.5=13.5 -> 14
    expect(result).toEqual({
      x: Math.round(7 * 1.5),
      y: Math.round(3 * 1.5),
      width: Math.round(11 * 1.5),
      height: Math.round(9 * 1.5),
    });
  });
});

// --- captureRegion integration tests (mocked Electron) ---

const mockToPNG = vi.fn().mockReturnValue(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
const mockCapturePage = vi.fn().mockResolvedValue({ toPNG: mockToPNG });

vi.mock('electron', () => ({
  screen: {
    getPrimaryDisplay: vi.fn().mockReturnValue({ scaleFactor: 1 }),
  },
}));

const { screen } = await import('electron');
const { captureRegion } = await import('../../src/main/capture.js');

describe('captureRegion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCapturePage.mockResolvedValue({ toPNG: mockToPNG });
    mockToPNG.mockReturnValue(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  });

  function createMockSiteView(scaleFactor: number = 1) {
    vi.mocked(screen.getPrimaryDisplay).mockReturnValue({ scaleFactor } as never);
    return {
      webContents: {
        capturePage: mockCapturePage,
      },
    } as never;
  }

  it('passes CSS rect directly to capturePage (DIP coordinates)', async () => {
    const siteView = createMockSiteView(1);
    await captureRegion(siteView, { x: 10, y: 20, width: 100, height: 50 });
    expect(mockCapturePage).toHaveBeenCalledWith({
      x: 10,
      y: 20,
      width: 100,
      height: 50,
    });
  });

  it('does not scale by display factor (capturePage takes DIP)', async () => {
    const siteView = createMockSiteView(2);
    await captureRegion(siteView, { x: 10, y: 20, width: 100, height: 50 });
    // Should NOT double — capturePage expects CSS/DIP pixels
    expect(mockCapturePage).toHaveBeenCalledWith({
      x: 10,
      y: 20,
      width: 100,
      height: 50,
    });
  });

  it('clamps negative values and enforces minimum 1x1 size', async () => {
    const siteView = createMockSiteView(1);
    await captureRegion(siteView, { x: -5, y: -10, width: 0, height: 0 });
    expect(mockCapturePage).toHaveBeenCalledWith({
      x: 0,
      y: 0,
      width: 1,
      height: 1,
    });
  });

  it('returns Buffer from NativeImage.toPNG()', async () => {
    const siteView = createMockSiteView(1);
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
    mockToPNG.mockReturnValue(pngBuffer);
    const result = await captureRegion(siteView, { x: 0, y: 0, width: 100, height: 100 });
    expect(result).toBe(pngBuffer);
    expect(mockToPNG).toHaveBeenCalled();
  });
});
