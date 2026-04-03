import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Electron mock ---

const mockOpenExternal = vi.fn();

vi.mock('electron', () => ({
  BaseWindow: vi.fn(),
  WebContentsView: vi.fn(),
  app: {
    whenReady: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    quit: vi.fn(),
  },
  ipcMain: { handle: vi.fn() },
  shell: { openExternal: mockOpenExternal },
}));

const { setupNavigation } = await import('../../src/main/navigation.js');

function createMockSiteView() {
  const willNavigateListeners: Array<(event: { preventDefault: () => void }, url: string) => void> = [];
  let windowOpenHandler: ((details: { url: string }) => { action: string }) | null = null;

  return {
    webContents: {
      on: vi.fn().mockImplementation((event: string, listener: (...args: unknown[]) => void) => {
        if (event === 'will-navigate') {
          willNavigateListeners.push(listener as (event: { preventDefault: () => void }, url: string) => void);
        }
      }),
      setWindowOpenHandler: vi.fn().mockImplementation((handler: (details: { url: string }) => { action: string }) => {
        windowOpenHandler = handler;
      }),
      loadURL: vi.fn(),
      loadFile: vi.fn(),
      setBackgroundColor: vi.fn(),
      send: vi.fn(),
    },
    setBounds: vi.fn(),
    // Test helpers
    _fireWillNavigate(url: string) {
      const event = { preventDefault: vi.fn() };
      for (const listener of willNavigateListeners) {
        listener(event, url);
      }
      return event;
    },
    _callWindowOpenHandler(url: string) {
      return windowOpenHandler?.({ url });
    },
  };
}

describe('setupNavigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers will-navigate listener', () => {
    const siteView = createMockSiteView();
    setupNavigation(siteView as unknown as Parameters<typeof setupNavigation>[0], 'http://localhost:3000');
    expect(siteView.webContents.on).toHaveBeenCalledWith('will-navigate', expect.any(Function));
  });

  it('allows localhost navigation (does not call preventDefault)', () => {
    const siteView = createMockSiteView();
    setupNavigation(siteView as unknown as Parameters<typeof setupNavigation>[0], 'http://localhost:3000');

    const event = siteView._fireWillNavigate('http://localhost:3000/about');
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it('prevents external URL navigation and opens in system browser', () => {
    const siteView = createMockSiteView();
    setupNavigation(siteView as unknown as Parameters<typeof setupNavigation>[0], 'http://localhost:3000');

    const event = siteView._fireWillNavigate('https://example.com');
    expect(event.preventDefault).toHaveBeenCalled();
    expect(mockOpenExternal).toHaveBeenCalledWith('https://example.com');
  });

  it('returns action: deny for all window.open calls', () => {
    const siteView = createMockSiteView();
    setupNavigation(siteView as unknown as Parameters<typeof setupNavigation>[0], 'http://localhost:3000');

    const result = siteView._callWindowOpenHandler('https://example.com');
    expect(result).toEqual({ action: 'deny' });
  });

  it('opens external URL in system browser from window.open', () => {
    const siteView = createMockSiteView();
    setupNavigation(siteView as unknown as Parameters<typeof setupNavigation>[0], 'http://localhost:3000');

    siteView._callWindowOpenHandler('https://example.com');
    expect(mockOpenExternal).toHaveBeenCalledWith('https://example.com');
  });

  it('does not call openExternal for localhost window.open', () => {
    const siteView = createMockSiteView();
    setupNavigation(siteView as unknown as Parameters<typeof setupNavigation>[0], 'http://localhost:3000');

    siteView._callWindowOpenHandler('http://localhost:3000/page');
    expect(mockOpenExternal).not.toHaveBeenCalled();
  });

  it('returns action: deny for localhost window.open too', () => {
    const siteView = createMockSiteView();
    setupNavigation(siteView as unknown as Parameters<typeof setupNavigation>[0], 'http://localhost:3000');

    const result = siteView._callWindowOpenHandler('http://localhost:3000/page');
    expect(result).toEqual({ action: 'deny' });
  });

  it('handles malformed URL without throwing (prevents navigation)', () => {
    const siteView = createMockSiteView();
    setupNavigation(siteView as unknown as Parameters<typeof setupNavigation>[0], 'http://localhost:3000');

    // Suppress console.warn during this test
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const event = siteView._fireWillNavigate('not-a-valid-url');
    expect(event.preventDefault).toHaveBeenCalled();

    warnSpy.mockRestore();
  });
});
