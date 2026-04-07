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
    openDevTools: vi.fn(),
  };
}

function createMockContentView() {
  return {
    addChildView: vi.fn(),
    setBackgroundColor: vi.fn(),
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
    getBounds: vi.fn().mockReturnValue({ x: 0, y: 0, width: 1280, height: 800 }),
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
      isPackaged: false,
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

  it('returns object with window, siteView, overlayView, sidebarView properties', () => {
    const result = createMainWindow('http://localhost:3000', 'my-app', 3000);
    expect(result).toHaveProperty('window');
    expect(result).toHaveProperty('siteView');
    expect(result).toHaveProperty('overlayView');
    expect(result).toHaveProperty('sidebarView');
    expect(result).toHaveProperty('setSidebarState');
    expect(result).toHaveProperty('getSidebarState');
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

  it('calls loadURL on site view with splash data URL (D-21)', () => {
    createMainWindow('http://localhost:3000', 'my-app', 3000);
    const siteView = mockWebContentsViewInstances[0];
    // Initial load should be the splash screen data URL, not the site URL directly
    expect(siteView.webContents.loadURL).toHaveBeenCalledWith(
      expect.stringContaining('data:text/html'),
    );
    // Splash HTML should contain brand text and port
    const loadedUrl = siteView.webContents.loadURL.mock.calls[0][0] as string;
    const decoded = decodeURIComponent(loadedUrl);
    expect(decoded).toContain('claw-design');
    expect(decoded).toContain('localhost:3000');
    expect(decoded).toContain('splash__spinner');
  });

  it('navigateToSite loads the actual site URL', () => {
    const result = createMainWindow('http://localhost:3000', 'my-app', 3000);
    const siteView = mockWebContentsViewInstances[0];
    siteView.webContents.loadURL.mockClear();

    result.navigateToSite();

    expect(siteView.webContents.loadURL).toHaveBeenCalledWith('http://localhost:3000');
  });

  it('calls loadFile on overlay view with path containing overlay.html', () => {
    createMainWindow('http://localhost:3000', 'my-app', 3000);
    const overlayView = mockWebContentsViewInstances[1];
    expect(overlayView.webContents.loadFile).toHaveBeenCalledWith(
      expect.stringContaining('overlay.html'),
    );
  });

  it('adds all three views as children via addChildView', () => {
    createMainWindow('http://localhost:3000', 'my-app', 3000);
    const win = mockBaseWindowInstances[0];
    expect(win.contentView.addChildView).toHaveBeenCalledTimes(3);
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
      x: 1052, // 1280 - 52 - 16 - 160 (tooltip allowance)
      y: 479,  // 800 - 305 - 16
      width: 228,  // 52 + 16 margin + 160 tooltip allowance
      height: 321, // 305 + 16 margin
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

  it('auto-minimizes sidebar when it is expanded (D-08)', () => {
    const components = createMainWindow('http://localhost:3000', 'my-app', 3000);
    // Set sidebar to expanded
    components.setSidebarState('expanded');

    // Now activate overlay
    setOverlayActive(
      components.overlayView as any,
      components.window as any,
      components,
    );

    // Sidebar should be minimized
    expect(components.getSidebarState()).toBe('minimized');
  });
});

describe('sidebarView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBaseWindowInstances.length = 0;
    mockWebContentsViewInstances.length = 0;
  });

  it('creates sidebarView with secure webPreferences (contextIsolation, sandbox)', () => {
    createMainWindow('http://localhost:3000', 'my-app', 3000);
    // Third WebContentsView call is the sidebar view
    const sidebarCallArgs = vi.mocked(WebContentsView).mock.calls[2][0] as {
      webPreferences: Record<string, unknown>;
    };
    expect(sidebarCallArgs.webPreferences.contextIsolation).toBe(true);
    expect(sidebarCallArgs.webPreferences.sandbox).toBe(true);
    expect(sidebarCallArgs.webPreferences.nodeIntegration).toBe(false);
  });

  it('sets sidebar preload path ending in sidebar.cjs', () => {
    createMainWindow('http://localhost:3000', 'my-app', 3000);
    const sidebarCallArgs = vi.mocked(WebContentsView).mock.calls[2][0] as {
      webPreferences: { preload: string };
    };
    expect(sidebarCallArgs.webPreferences.preload).toMatch(/sidebar\.cjs$/);
  });

  it('calls loadFile on sidebar view with path containing sidebar.html', () => {
    createMainWindow('http://localhost:3000', 'my-app', 3000);
    const sidebarView = mockWebContentsViewInstances[2];
    expect(sidebarView.webContents.loadFile).toHaveBeenCalledWith(
      expect.stringContaining('sidebar.html'),
    );
  });

  it('starts sidebar with zero-size bounds (hidden state)', () => {
    const components = createMainWindow('http://localhost:3000', 'my-app', 3000);
    expect(components.getSidebarState()).toBe('hidden');
    const sidebarView = mockWebContentsViewInstances[2];
    // The initial setBounds call should include zero-size
    expect(sidebarView.setBounds).toHaveBeenCalledWith(
      expect.objectContaining({ x: 0, y: 0, width: 0, height: 0 }),
    );
  });

  it('setSidebarState("minimized") sets correct bounds', () => {
    const components = createMainWindow('http://localhost:3000', 'my-app', 3000);
    const sidebarView = mockWebContentsViewInstances[2];
    sidebarView.setBounds.mockClear();

    components.setSidebarState('minimized');

    expect(components.getSidebarState()).toBe('minimized');
    expect(sidebarView.setBounds).toHaveBeenCalledWith({
      x: 1280 - 52,
      y: Math.round(800 / 2) - 18,
      width: 52,
      height: 80,
    });
  });

  it('setSidebarState("expanded") sets floating sidebar bounds without shrinking site', () => {
    const components = createMainWindow('http://localhost:3000', 'my-app', 3000);
    const sidebarView = mockWebContentsViewInstances[2];
    const siteView = mockWebContentsViewInstances[0];
    sidebarView.setBounds.mockClear();
    siteView.setBounds.mockClear();

    components.setSidebarState('expanded');

    expect(components.getSidebarState()).toBe('expanded');
    // Sidebar should float as overlay (not full height, with margin)
    expect(sidebarView.setBounds).toHaveBeenCalledWith({
      x: 1280 - 300 - 16,
      y: 16,
      width: 300,
      height: Math.min(480, 800 - 32),
    });
    // Site view should NOT be narrowed (floating overlay)
    expect(siteView.setBounds).not.toHaveBeenCalled();
  });

  it('setSidebarState("hidden") from expanded zeroes sidebar bounds', () => {
    const components = createMainWindow('http://localhost:3000', 'my-app', 3000);
    const sidebarView = mockWebContentsViewInstances[2];

    // First expand
    components.setSidebarState('expanded');
    sidebarView.setBounds.mockClear();

    // Then hide
    components.setSidebarState('hidden');

    expect(components.getSidebarState()).toBe('hidden');
    expect(sidebarView.setBounds).toHaveBeenCalledWith({
      x: 0, y: 0, width: 0, height: 0,
    });
  });

  it('syncBounds repositions sidebar on resize', () => {
    const components = createMainWindow('http://localhost:3000', 'my-app', 3000);
    const win = mockBaseWindowInstances[0];
    const sidebarView = mockWebContentsViewInstances[2];

    components.setSidebarState('minimized');
    sidebarView.setBounds.mockClear();

    // Simulate resize
    win.getContentBounds.mockReturnValue({ x: 0, y: 0, width: 1920, height: 1080 });
    const resizeHandler = win.on.mock.calls.find(
      (call: unknown[]) => call[0] === 'resize',
    )?.[1] as () => void;
    resizeHandler();

    // Sidebar should be repositioned for new window size
    expect(sidebarView.setBounds).toHaveBeenCalledWith({
      x: 1920 - 52,
      y: Math.round(1080 / 2) - 18,
      width: 52,
      height: 80,
    });
  });
});
