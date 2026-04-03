import { BaseWindow, WebContentsView } from 'electron';
import path from 'node:path';

export interface WindowComponents {
  window: BaseWindow;
  siteView: WebContentsView;
  overlayView: WebContentsView;
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
      preload: path.join(__dirname, '../preload/overlay.mjs'),
    },
  });

  // Pitfall 4: Must set transparent background BEFORE loading content
  overlayView.webContents.setBackgroundColor('#00000000');

  win.contentView.addChildView(overlayView);

  // Load overlay HTML from electron-vite renderer build output
  overlayView.webContents.loadFile(
    path.join(__dirname, '../renderer/overlay.html'),
  );

  // D-13: Auto-sync both views to window content area on resize
  function syncBounds(): void {
    const { width, height } = win.getContentBounds();
    siteView.setBounds({ x: 0, y: 0, width, height });
    // Start overlay in inactive state (only indicator area)
    setOverlayInactive(overlayView, win);
  }

  win.on('resize', syncBounds);
  syncBounds();

  return { window: win, siteView, overlayView };
}

/**
 * Shrink overlay bounds to only cover the bottom-right indicator area (48x48 px).
 * Per D-12: when overlay is inactive, mouse events pass through to site view
 * because the overlay's bounds no longer cover the site area.
 */
export function setOverlayInactive(
  overlayView: WebContentsView,
  win: BaseWindow,
): void {
  const { width, height } = win.getContentBounds();
  const indicatorSize = 48;
  overlayView.setBounds({
    x: width - indicatorSize,
    y: height - indicatorSize,
    width: indicatorSize,
    height: indicatorSize,
  });
}

/**
 * Expand overlay to full window size for selection mode (Phase 3 triggers this).
 */
export function setOverlayActive(
  overlayView: WebContentsView,
  win: BaseWindow,
): void {
  const { width, height } = win.getContentBounds();
  overlayView.setBounds({ x: 0, y: 0, width, height });
}
