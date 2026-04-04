import { BaseWindow, WebContentsView } from 'electron';
import path from 'node:path';

export interface WindowComponents {
  window: BaseWindow;
  siteView: WebContentsView;
  overlayView: WebContentsView;
  setOverlayIsActive: (active: boolean) => void;
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

  // Track overlay state so resize handler preserves it
  let overlayIsActive = false;

  // D-13: Auto-sync both views to window content area on resize
  function syncBounds(): void {
    const { width, height } = win.getContentBounds();
    siteView.setBounds({ x: 0, y: 0, width, height });
    // Preserve overlay state across resizes
    if (overlayIsActive) {
      overlayView.setBounds({ x: 0, y: 0, width, height });
    } else {
      setOverlayInactive(overlayView, win);
    }
  }

  win.on('resize', syncBounds);
  syncBounds();

  return { window: win, siteView, overlayView, setOverlayIsActive: (active: boolean) => { overlayIsActive = active; } };
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
  // 3 items × 36px + 2 gaps × 4px + padding 20px = 136px
  const toolbarWidth = 52;
  const toolbarHeight = 136;
  const margin = 16;
  overlayView.setBounds({
    x: width - toolbarWidth - margin,
    y: height - toolbarHeight - margin,
    width: toolbarWidth + margin,
    height: toolbarHeight + margin,
  });
  components?.setOverlayIsActive(false);
}

/**
 * Expand overlay to full window size for selection mode (Phase 3 triggers this).
 */
export function setOverlayActive(
  overlayView: WebContentsView,
  win: BaseWindow,
  components?: WindowComponents,
): void {
  const { width, height } = win.getContentBounds();
  overlayView.setBounds({ x: 0, y: 0, width, height });
  components?.setOverlayIsActive(true);
}
