import { app, BaseWindow, WebContentsView } from 'electron';
import path from 'node:path';

// --- Viewport presets ---

export const VIEWPORT_PRESETS = {
  desktop: { width: 1280, height: 800 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 375, height: 812 },
} as const;

export type ViewportPreset = keyof typeof VIEWPORT_PRESETS;

/** Rectangle shape for bounds computation */
interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Compute the site view bounds for a given viewport preset and window size.
 * - Desktop (or unknown preset): fills the entire window.
 * - Non-desktop: centers the preset dimensions within the window, clamping to window size.
 * - If window is smaller than or equal to the preset, fills the window.
 */
export function computeSiteViewBounds(
  preset: string,
  windowWidth: number,
  windowHeight: number,
): Rectangle {
  if (preset === 'desktop' || !(preset in VIEWPORT_PRESETS)) {
    return { x: 0, y: 0, width: windowWidth, height: windowHeight };
  }

  const vp = VIEWPORT_PRESETS[preset as ViewportPreset];

  // If window is smaller than or equal to the preset in both dimensions, fill window
  if (windowWidth <= vp.width && windowHeight <= vp.height) {
    return { x: 0, y: 0, width: windowWidth, height: windowHeight };
  }

  const w = Math.min(vp.width, windowWidth);
  const h = Math.min(vp.height, windowHeight);
  const x = Math.round((windowWidth - w) / 2);
  const y = Math.round((windowHeight - h) / 2);

  return { x, y, width: w, height: h };
}

/**
 * Animate a view's bounds from `from` to `to` over `durationMs` milliseconds.
 * Uses setTimeout loop (main process has no requestAnimationFrame -- Pitfall 6).
 * Ease-in-out curve: t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t + 2, 2) / 2
 */
export function animateBounds(
  view: { setBounds: (r: Rectangle) => void },
  from: Rectangle,
  to: Rectangle,
  durationMs: number,
): Promise<void> {
  return new Promise<void>((resolve) => {
    const startTime = Date.now();

    function easeInOut(t: number): number {
      return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    }

    function lerp(a: number, b: number, t: number): number {
      return Math.round(a + (b - a) * t);
    }

    function step(): void {
      const elapsed = Date.now() - startTime;
      const rawT = Math.min(elapsed / durationMs, 1);
      const t = easeInOut(rawT);

      const bounds: Rectangle = {
        x: lerp(from.x, to.x, t),
        y: lerp(from.y, to.y, t),
        width: lerp(from.width, to.width, t),
        height: lerp(from.height, to.height, t),
      };

      view.setBounds(bounds);

      if (rawT >= 1) {
        resolve();
      } else {
        setTimeout(step, 16);
      }
    }

    step();
  });
}

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
  /** Switch viewport preset and animate site view bounds */
  setViewport: (preset: ViewportPreset) => Promise<void>;
  /** Get current viewport preset */
  getViewport: () => ViewportPreset;
  /** Navigate siteView from splash screen to actual site URL (D-21) */
  navigateToSite: () => void;
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
    title: `Claw Design \u2014 ${projectName} \u2014 localhost:${port}`,
  });

  // D-06: Dark surround background for viewport constraining
  // When siteView doesn't cover full area, this dark fill shows through
  win.contentView.setBackgroundColor('#1a1a1a');

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

  // Splash screen (D-21): show branded loading page before site loads
  const splashHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #1a1a1a;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    .splash {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
    }
    .splash__brand {
      font-size: 16px;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.9);
    }
    .splash__spinner {
      width: 24px;
      height: 24px;
      border: 2px solid transparent;
      border-top-color: rgba(138, 180, 248, 0.8);
      border-radius: 50%;
      animation: spin 800ms linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .splash__url {
      font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
      font-size: 12px;
      color: rgba(255, 255, 255, 0.4);
    }
    @media (prefers-reduced-motion: reduce) {
      .splash__spinner { animation: none; border-top-color: rgba(138, 180, 248, 0.5); }
    }
  </style>
</head>
<body>
  <div class="splash">
    <div class="splash__brand">Claw Design</div>
    <div class="splash__spinner" aria-label="Loading application"></div>
    <div class="splash__url">Loading localhost:${port}...</div>
  </div>
</body>
</html>`;

  siteView.webContents.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(splashHtml)}`);

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

  // Open DevTools for overlay in development
  if (!app.isPackaged) {
    overlayView.webContents.openDevTools({ mode: 'detach' });
  }

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

  // Track current viewport preset (ELEC-03)
  let currentViewport: ViewportPreset = 'desktop';

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
  // Sidebar floats on top -- overlay always full window, site view respects viewport preset
  function syncBounds(): void {
    const { width, height } = win.getContentBounds();
    const siteBounds = computeSiteViewBounds(currentViewport, width, height);
    siteView.setBounds(siteBounds);
    if (overlayIsActive) {
      overlayView.setBounds({ x: 0, y: 0, width, height });
    } else {
      setOverlayInactive(overlayView, win);
    }
    applySidebarBounds();
  }

  /** Switch viewport preset and animate site view bounds (ELEC-03) */
  async function setViewportImpl(preset: ViewportPreset): Promise<void> {
    if (!VIEWPORT_PRESETS[preset]) return;
    const { width, height } = win.getContentBounds();
    const from = siteView.getBounds();
    currentViewport = preset;
    const to = computeSiteViewBounds(preset, width, height);
    await animateBounds(siteView, from, to, 250);
    // Notify overlay renderer of the change
    overlayView.webContents.send('viewport:changed', { preset });
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
    setViewport: setViewportImpl,
    getViewport: () => currentViewport,
    navigateToSite: () => { siteView.webContents.loadURL(url); },
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
  // Must accommodate expanded viewport group (3 extra buttons when open):
  // 7 items * 36px = 252, 6 gaps * 4px = 24, divider 9px, padding 20px = 305px
  const toolbarWidth = 52;
  const toolbarHeight = 305;
  const margin = 16;
  // Extra width for tooltips that appear to the left of toolbar buttons
  // Longest tooltip "Desktop (1280 x 800)" ~140px + 8px gap = 148px
  const tooltipAllowance = 160;
  const viewW = toolbarWidth + margin + tooltipAllowance;
  const viewH = toolbarHeight + margin;

  const userPos = components?.getToolbarPosition?.();
  if (userPos) {
    const x = Math.max(0, Math.min(width - viewW, userPos.x - tooltipAllowance));
    const y = Math.max(0, Math.min(height - viewH, userPos.y));
    overlayView.setBounds({ x, y, width: viewW, height: viewH });
  } else {
    overlayView.setBounds({
      x: width - toolbarWidth - margin - tooltipAllowance,
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
