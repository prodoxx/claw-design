import { ipcMain } from 'electron';
import {
  setOverlayActive,
  setOverlayInactive,
  type WindowComponents,
} from './window.js';

/**
 * Register IPC handlers for overlay communication.
 *
 * Phase 2 establishes the activation/deactivation scaffold.
 * Phase 3 adds selection capture and DOM extraction handlers.
 */
export function registerIpcHandlers(components: WindowComponents): void {
  // Activate selection mode: expand overlay to full window, notify renderer
  ipcMain.handle('overlay:activate-selection', async () => {
    setOverlayActive(components.overlayView, components.window);
    components.overlayView.webContents.send(
      'overlay:mode-change',
      'selection',
    );
  });

  // Deactivate selection mode: shrink overlay to indicator, notify renderer
  ipcMain.handle('overlay:deactivate-selection', async () => {
    setOverlayInactive(components.overlayView, components.window);
    components.overlayView.webContents.send('overlay:mode-change', 'inactive');
  });

  // Get element bounding rect at a point in the site view
  // Per D-04: top-level document only, no shadow DOM or iframe traversal
  ipcMain.handle(
    'overlay:get-element-at-point',
    async (_event, x: number, y: number) => {
      const result = await components.siteView.webContents.executeJavaScript(`
        (function() {
          const el = document.elementFromPoint(${x}, ${y});
          if (!el) return null;
          const rect = el.getBoundingClientRect();
          return {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height)
          };
        })()
      `);
      return result;
    },
  );
}
