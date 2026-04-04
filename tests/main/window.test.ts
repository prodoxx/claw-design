import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Electron mock factories ---

function createMockWebContents() {
  return {
    loadURL: vi.fn().mockResolvedValue(undefined),
    loadFile: vi.fn().mockResolvedValue(undefined),
    setBackgroundColor: vi.fn(),
    on: vi.fn(),
    send: vi.fn(),
    setWindowOpenHandler: vi.fn(),
  };
}

function createMockContentView() {
  return {
    addChildView: vi.fn(),
  };
}

const mockBaseWindowInstances: Array<ReturnType<typeof createMockBaseWindow>> = [];
const mockWebContentsViewInstances: Array<ReturnType<typeof createMockWebContentsView>> = [];

function createMockBaseWindow() {
  const instance = {
    contentView: createMockContentView(),
    getContentBounds: vi.fn().mockReturnValue({ x: 0, y: 0, width: 1280, height: 800 }),
    on: vi.fn(),
    setBounds: vi.fn(),
  };
  return instance;
}

function createMockWebContentsView() {
  const instance = {
    webContents: createMockWebContents(),
    setBounds: vi.fn(),
    setBackgroundColor: vi.fn(),
  };
  return instance;
}

vi.mock('electron', () => {
  // Use function declarations so they are valid constructors (have [[Construct]])
  const MockBaseWindow = vi.fn(function (this: Record<string, unknown>) {
    const instance = createMockBaseWindow();
    mockBaseWindowInstances.push(instance);
    Object.assign(this, instance);
  });

  const MockWebContentsView = vi.fn(function (this: Record<string, unknown>) {
    const instance = createMockWebContentsView();
    mockWebContentsViewInstances.push(instance);
    Object.assign(this, instance);
  });

  return {
    BaseWindow: MockBaseWindow,
    WebContentsView: MockWebContentsView,
    app: {
      whenReady: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
      quit: vi.fn(),
    },
    ipcMain: { handle: vi.fn() },
    shell: { openExternal: vi.fn() },
  };
});

const { BaseWindow, WebContentsView } = await import('electron');
const { createMainWindow, setOverlayInactive, setOverlayActive } = await import(
  '../../src/main/window.js'
);

describe('createMainWindow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBaseWindowInstances.length = 0;
    mockWebContentsViewInstances.length = 0;
  });

  it('returns object with window, siteView, overlayView properties', () => {
    const result = createMainWindow('http://localhost:3000', 'my-app', 3000);
    expect(result).toHaveProperty('window');
    expect(result).toHaveProperty('siteView');
    expect(result).toHaveProperty('overlayView');
  });

  it('creates BaseWindow with width=1280, height=800, center=true', () => {
    createMainWindow('http://localhost:3000', 'my-app', 3000);
    expect(BaseWindow).toHaveBeenCalledWith(
      expect.objectContaining({
        width: 1280,
        height: 800,
        center: true,
      }),
    );
  });

  it('sets window title containing claw-design, project name, and port', () => {
    createMainWindow('http://localhost:3000', 'my-app', 3000);
    expect(BaseWindow).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringContaining('claw-design'),
      }),
    );
    const callArgs = vi.mocked(BaseWindow).mock.calls[0][0] as { title: string };
    expect(callArgs.title).toContain('my-app');
    expect(callArgs.title).toContain('localhost:3000');
  });

  it('creates site view with secure webPreferences', () => {
    createMainWindow('http://localhost:3000', 'my-app', 3000);
    // First WebContentsView call is the site view
    const siteCallArgs = vi.mocked(WebContentsView).mock.calls[0][0] as {
      webPreferences: Record<string, unknown>;
    };
    expect(siteCallArgs.webPreferences.contextIsolation).toBe(true);
    expect(siteCallArgs.webPreferences.sandbox).toBe(true);
    expect(siteCallArgs.webPreferences.nodeIntegration).toBe(false);
  });

  it('creates overlay view with secure webPreferences', () => {
    createMainWindow('http://localhost:3000', 'my-app', 3000);
    // Second WebContentsView call is the overlay view
    const overlayCallArgs = vi.mocked(WebContentsView).mock.calls[1][0] as {
      webPreferences: Record<string, unknown>;
    };
    expect(overlayCallArgs.webPreferences.contextIsolation).toBe(true);
    expect(overlayCallArgs.webPreferences.sandbox).toBe(true);
    expect(overlayCallArgs.webPreferences.nodeIntegration).toBe(false);
  });

  it('sets overlay preload path ending in overlay.cjs', () => {
    createMainWindow('http://localhost:3000', 'my-app', 3000);
    const overlayCallArgs = vi.mocked(WebContentsView).mock.calls[1][0] as {
      webPreferences: { preload: string };
    };
    expect(overlayCallArgs.webPreferences.preload).toMatch(/overlay\.cjs$/);
  });

  it('calls setBackgroundColor with #00000000 on overlay view', () => {
    createMainWindow('http://localhost:3000', 'my-app', 3000);
    const overlayView = mockWebContentsViewInstances[1];
    expect(overlayView.setBackgroundColor).toHaveBeenCalledWith('#00000000');
  });

  it('calls loadURL on site view with the provided URL', () => {
    createMainWindow('http://localhost:3000', 'my-app', 3000);
    const siteView = mockWebContentsViewInstances[0];
    expect(siteView.webContents.loadURL).toHaveBeenCalledWith('http://localhost:3000');
  });

  it('calls loadFile on overlay view with path containing overlay.html', () => {
    createMainWindow('http://localhost:3000', 'my-app', 3000);
    const overlayView = mockWebContentsViewInstances[1];
    expect(overlayView.webContents.loadFile).toHaveBeenCalledWith(
      expect.stringContaining('overlay.html'),
    );
  });

  it('adds both views as children via addChildView', () => {
    createMainWindow('http://localhost:3000', 'my-app', 3000);
    const win = mockBaseWindowInstances[0];
    expect(win.contentView.addChildView).toHaveBeenCalledTimes(2);
  });

  it('registers resize event listener on window', () => {
    createMainWindow('http://localhost:3000', 'my-app', 3000);
    const win = mockBaseWindowInstances[0];
    expect(win.on).toHaveBeenCalledWith('resize', expect.any(Function));
  });

  it('calls syncBounds immediately (overlay setBounds called)', () => {
    createMainWindow('http://localhost:3000', 'my-app', 3000);
    // syncBounds calls setOverlayInactive which calls setBounds on overlay
    const overlayView = mockWebContentsViewInstances[1];
    expect(overlayView.setBounds).toHaveBeenCalled();
  });
});

describe('setOverlayInactive', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBaseWindowInstances.length = 0;
    mockWebContentsViewInstances.length = 0;
  });

  it('sets overlay bounds to bottom-right toolbar area', () => {
    const mockOverlay = createMockWebContentsView();
    const mockWin = createMockBaseWindow();
    mockWin.getContentBounds.mockReturnValue({ x: 0, y: 0, width: 1280, height: 800 });

    setOverlayInactive(mockOverlay as unknown as Parameters<typeof setOverlayInactive>[0], mockWin as unknown as Parameters<typeof setOverlayInactive>[1]);

    expect(mockOverlay.setBounds).toHaveBeenCalledWith({
      x: 1212, // 1280 - 52 - 16
      y: 648,  // 800 - 136 - 16
      width: 68,  // 52 + 16 margin
      height: 152, // 136 + 16 margin
    });
  });
});

describe('setOverlayActive', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBaseWindowInstances.length = 0;
    mockWebContentsViewInstances.length = 0;
  });

  it('sets overlay bounds to full window content area', () => {
    const mockOverlay = createMockWebContentsView();
    const mockWin = createMockBaseWindow();
    mockWin.getContentBounds.mockReturnValue({ x: 0, y: 0, width: 1280, height: 800 });

    setOverlayActive(mockOverlay as unknown as Parameters<typeof setOverlayActive>[0], mockWin as unknown as Parameters<typeof setOverlayActive>[1]);

    expect(mockOverlay.setBounds).toHaveBeenCalledWith({
      x: 0,
      y: 0,
      width: 1280,
      height: 800,
    });
  });
});
