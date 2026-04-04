import { BaseWindow, WebContentsView } from 'electron';
import path from 'node:path';

export interface WindowComponents {
  window: BaseWindow;
  siteView: WebContentsView;
  overlayView: WebContentsView;
  sidebarView: WebContentsView;
  setOverlayIsActive: (active: boolean) => void;
  setSidebarState: (state: 'hidden' | 'minimized' | 'expanded') => void;
  getSidebarState: () => 'hidden' | 'minimized' | 'expanded';
  /** Store user-chosen toolbar position (persists across overlay active/inactive toggle) */
  setToolbarPosition: (x: number, y: number) => void;
  getToolbarPosition: () => { x: number; y: number } | null;
  /** Store user-chosen sidebar position (persists across state changes) */
  setSidebarUserPosition: (x: number, y: number) => void;
  getSidebarUserPosition: () => { x: number; y: number } | null;
}

/**
 * Create the main Electron window with dual WebContentsViews:
 * - Site view (bottom): loads the user's localhost URL with full security isolation
 * - Overlay view (top): transparent layer for selection UI (Phase 3)
 *
 * Per D-09: Two stacked WebContentsViews inside a BaseWindow.
 */
export function createMainWindow(
  url: string,
  projectName: string,
  port: number,
): WindowComponents {
  // D-01: Standard OS frame (frame defaults to true, not set explicitly)
  // D-02: 1280x800, centered
  // D-03: Title format
  const win = new BaseWindow({
    width: 1280,
    height: 800,
    center: true,
    title: `claw-design \u2014 ${projectName} \u2014 localhost:${port}`,
  });

  // Site view (bottom layer) -- ELEC-01: secure webPreferences
  const siteView = new WebContentsView({
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });
  win.contentView.addChildView(siteView);
  siteView.webContents.loadURL(url);

  // Overlay view (top layer) -- ELEC-02: transparent overlay
  const overlayView = new WebContentsView({
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      preload: path.join(__dirname, '../preload/overlay.cjs'),
    },
  });

  // Pitfall 4: Must set transparent background BEFORE loading content
  // setBackgroundColor is on WebContentsView (inherits from View), not on webContents
  overlayView.setBackgroundColor('#00000000');

  win.contentView.addChildView(overlayView);

  // Load overlay HTML from electron-vite renderer build output
  overlayView.webContents.loadFile(
    path.join(__dirname, '../renderer/overlay.html'),
  );

  // Sidebar view (topmost layer) -- separate WebContentsView for persistence across overlay bounds toggle
  const sidebarView = new WebContentsView({
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      preload: path.join(__dirname, '../preload/sidebar.cjs'),
    },
  });
  sidebarView.setBackgroundColor('#00000000');
  win.contentView.addChildView(sidebarView); // Added LAST = topmost z-order
  sidebarView.webContents.loadFile(
    path.join(__dirname, '../renderer/sidebar.html'),
  );
  // Start hidden (D-03: zero-size bounds)
  sidebarView.setBounds({ x: 0, y: 0, width: 0, height: 0 });

  // Track overlay state so resize handler preserves it
  let overlayIsActive = false;

  // Track sidebar state for bounds management
  let sidebarState: 'hidden' | 'minimized' | 'expanded' = 'hidden';

  // User-set positions (via dragging) -- null means use default layout
  let toolbarPosition: { x: number; y: number } | null = null;
  let sidebarUserPosition: { x: number; y: number } | null = null;

  function applySidebarBounds(): void {
    const { width, height } = win.getContentBounds();
    const SIDEBAR_WIDTH = 300;
    const SIDEBAR_MAX_HEIGHT = 480;
    const MARGIN = 16;

    switch (sidebarState) {
      case 'hidden':
        sidebarView.setBounds({ x: 0, y: 0, width: 0, height: 0 });
        break;
      case 'minimized': {
        const mW = 52;
        const mH = 80;
        if (sidebarUserPosition) {
          const x = Math.max(0, Math.min(width - mW, sidebarUserPosition.x));
          const y = Math.max(0, Math.min(height - mH, sidebarUserPosition.y));
          sidebarView.setBounds({ x, y, width: mW, height: mH });
        } else {
          sidebarView.setBounds({
            x: width - mW,
            y: Math.round(height / 2) - 18,
            width: mW,
            height: mH,
          });
        }
        break;
      }
      case 'expanded': {
        // Floating overlay: doesn't shrink site or overlay views
        const panelHeight = Math.min(SIDEBAR_MAX_HEIGHT, height - MARGIN * 2);
        if (sidebarUserPosition) {
          const x = Math.max(0, Math.min(width - SIDEBAR_WIDTH, sidebarUserPosition.x));
          const y = Math.max(0, Math.min(height - panelHeight, sidebarUserPosition.y));
          sidebarView.setBounds({ x, y, width: SIDEBAR_WIDTH, height: panelHeight });
        } else {
          sidebarView.setBounds({
            x: width - SIDEBAR_WIDTH - MARGIN,
            y: MARGIN,
            width: SIDEBAR_WIDTH,
            height: panelHeight,
          });
        }
        break;
      }
    }
  }

  function setSidebarState(state: 'hidden' | 'minimized' | 'expanded'): void {
    sidebarState = state;
    applySidebarBounds();
    // Sync visual state to sidebar renderer so it shows the right UI
    sidebarView.webContents.send('sidebar:state-change', state);
  }

  // D-13: Auto-sync all views to window content area on resize
  // Sidebar floats on top — site and overlay always use full width
  function syncBounds(): void {
    const { width, height } = win.getContentBounds();
    siteView.setBounds({ x: 0, y: 0, width, height });
    if (overlayIsActive) {
      overlayView.setBounds({ x: 0, y: 0, width, height });
    } else {
      setOverlayInactive(overlayView, win);
    }
    applySidebarBounds();
  }

  win.on('resize', syncBounds);
  syncBounds();

  return {
    window: win,
    siteView,
    overlayView,
    sidebarView,
    setOverlayIsActive: (active: boolean) => { overlayIsActive = active; },
    setSidebarState,
    getSidebarState: () => sidebarState,
    setToolbarPosition: (x: number, y: number) => { toolbarPosition = { x, y }; },
    getToolbarPosition: () => toolbarPosition,
    setSidebarUserPosition: (x: number, y: number) => { sidebarUserPosition = { x, y }; },
    getSidebarUserPosition: () => sidebarUserPosition,
  };
}

/**
 * Shrink overlay bounds to only cover the bottom-right indicator area (48x48 px).
 * Per D-12: when overlay is inactive, mouse events pass through to site view
 * because the overlay's bounds no longer cover the site area.
 */
export function setOverlayInactive(
  overlayView: WebContentsView,
  win: BaseWindow,
  components?: WindowComponents,
): void {
  const { width, height } = win.getContentBounds();
  // Toolbar pill dimensions + margin from window edge
  // 3 items * 36px + 2 gaps * 4px + padding 20px = 136px
  const toolbarWidth = 52;
  const toolbarHeight = 136;
  const margin = 16;
  const viewW = toolbarWidth + margin;
  const viewH = toolbarHeight + margin;

  const userPos = components?.getToolbarPosition?.();
  if (userPos) {
    const x = Math.max(0, Math.min(width - viewW, userPos.x));
    const y = Math.max(0, Math.min(height - viewH, userPos.y));
    overlayView.setBounds({ x, y, width: viewW, height: viewH });
  } else {
    overlayView.setBounds({
      x: width - toolbarWidth - margin,
      y: height - toolbarHeight - margin,
      width: viewW,
      height: viewH,
    });
  }
  components?.setOverlayIsActive(false);
}

/**
 * Expand overlay to full window size for selection mode (Phase 3 triggers this).
 * D-08: auto-minimize sidebar when entering selection mode.
 */
export function setOverlayActive(
  overlayView: WebContentsView,
  win: BaseWindow,
  components?: WindowComponents,
): void {
  const { width, height } = win.getContentBounds();
  // D-08: auto-minimize sidebar when entering selection mode
  if (components?.getSidebarState && components.getSidebarState() === 'expanded') {
    components.setSidebarState('minimized');
  }
  overlayView.setBounds({ x: 0, y: 0, width, height });
  components?.setOverlayIsActive(true);
}
