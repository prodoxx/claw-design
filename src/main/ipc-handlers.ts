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
}
