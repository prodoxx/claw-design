import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// computeSiteViewBounds and animateBounds are pure-ish functions that
// don't require Electron mocks, so we import them directly.
const { computeSiteViewBounds, animateBounds, VIEWPORT_PRESETS } = await import(
  '../../src/main/window.js'
);

describe('VIEWPORT_PRESETS', () => {
  it('has desktop, tablet, and mobile entries', () => {
    expect(VIEWPORT_PRESETS).toHaveProperty('desktop');
    expect(VIEWPORT_PRESETS).toHaveProperty('tablet');
    expect(VIEWPORT_PRESETS).toHaveProperty('mobile');
  });

  it('desktop is 1280x800', () => {
    expect(VIEWPORT_PRESETS.desktop).toEqual({ width: 1280, height: 800 });
  });

  it('tablet is 768x1024', () => {
    expect(VIEWPORT_PRESETS.tablet).toEqual({ width: 768, height: 1024 });
  });

  it('mobile is 375x812', () => {
    expect(VIEWPORT_PRESETS.mobile).toEqual({ width: 375, height: 812 });
  });
});

describe('computeSiteViewBounds', () => {
  it('desktop preset fills entire window', () => {
    const result = computeSiteViewBounds('desktop', 1280, 800);
    expect(result).toEqual({ x: 0, y: 0, width: 1280, height: 800 });
  });

  it('tablet preset centers within 1280x800 window', () => {
    const result = computeSiteViewBounds('tablet', 1280, 800);
    // 768 width centered: x = (1280 - 768) / 2 = 256
    // height clamped to 800 (preset height 1024 > window height 800)
    expect(result).toEqual({ x: 256, y: 0, width: 768, height: 800 });
  });

  it('mobile preset centers within 1280x800 window', () => {
    const result = computeSiteViewBounds('mobile', 1280, 800);
    // 375 width centered: x = Math.round((1280 - 375) / 2) = 453 (452.5 rounded)
    // height clamped to 800
    expect(result).toEqual({ x: 453, y: 0, width: 375, height: 800 });
  });

  it('window smaller than tablet preset fills window', () => {
    const result = computeSiteViewBounds('tablet', 600, 400);
    expect(result).toEqual({ x: 0, y: 0, width: 600, height: 400 });
  });

  it('window exactly matching mobile preset fills window', () => {
    const result = computeSiteViewBounds('mobile', 375, 812);
    expect(result).toEqual({ x: 0, y: 0, width: 375, height: 812 });
  });

  it('invalid preset name falls back to desktop (fills window)', () => {
    const result = computeSiteViewBounds('nonexistent', 1280, 800);
    expect(result).toEqual({ x: 0, y: 0, width: 1280, height: 800 });
  });

  it('tablet in a wide short window constrains width, clamps height', () => {
    const result = computeSiteViewBounds('tablet', 1920, 600);
    // width 768, centered: x = Math.round((1920 - 768) / 2) = 576
    // height clamped to 600 (preset 1024 > window 600)
    expect(result).toEqual({ x: 576, y: 0, width: 768, height: 600 });
  });
});

describe('animateBounds', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calls view.setBounds multiple times over duration', async () => {
    const mockView = { setBounds: vi.fn() };
    const from = { x: 0, y: 0, width: 1280, height: 800 };
    const to = { x: 256, y: 0, width: 768, height: 800 };

    const promise = animateBounds(mockView, from, to, 250);

    // Advance enough time to complete animation (16ms frames over 250ms)
    for (let i = 0; i < 20; i++) {
      await vi.advanceTimersByTimeAsync(16);
    }

    await promise;

    // Should have been called multiple times during animation
    expect(mockView.setBounds.mock.calls.length).toBeGreaterThan(1);
  });

  it('final setBounds call matches target bounds', async () => {
    const mockView = { setBounds: vi.fn() };
    const from = { x: 0, y: 0, width: 1280, height: 800 };
    const to = { x: 256, y: 0, width: 768, height: 800 };

    const promise = animateBounds(mockView, from, to, 250);

    // Advance enough time to complete animation
    for (let i = 0; i < 25; i++) {
      await vi.advanceTimersByTimeAsync(16);
    }

    await promise;

    // Last call should match target bounds
    const lastCall = mockView.setBounds.mock.calls[mockView.setBounds.mock.calls.length - 1][0];
    expect(lastCall).toEqual(to);
  });

  it('resolves after duration elapses', async () => {
    const mockView = { setBounds: vi.fn() };
    const from = { x: 0, y: 0, width: 1280, height: 800 };
    const to = { x: 0, y: 0, width: 375, height: 800 };

    let resolved = false;
    const promise = animateBounds(mockView, from, to, 250).then(() => { resolved = true; });

    // Not resolved yet
    expect(resolved).toBe(false);

    // Advance past duration
    for (let i = 0; i < 25; i++) {
      await vi.advanceTimersByTimeAsync(16);
    }

    await promise;
    expect(resolved).toBe(true);
  });
});
