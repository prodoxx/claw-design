import { ipcMain } from 'electron';
import {
  setOverlayActive,
  setOverlayInactive,
  type WindowComponents,
} from './window.js';
import { captureRegion, type CSSRect } from './capture.js';
import {
  buildDomExtractionScript,
  type DomExtractionResult,
} from './dom-extract.js';

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

  // Capture screenshot of selected region (CAP-01, CAP-03)
  ipcMain.handle(
    'overlay:capture-screenshot',
    async (_event, cssRect: CSSRect): Promise<Buffer> => {
      return captureRegion(components.siteView, cssRect);
    },
  );

  // Extract DOM elements within selected region (CAP-02)
  ipcMain.handle(
    'overlay:extract-dom',
    async (_event, cssRect: CSSRect): Promise<DomExtractionResult> => {
      const script = buildDomExtractionScript(cssRect);
      const result = await components.siteView.webContents.executeJavaScript(
        script,
      );
      return result;
    },
  );

  // Submit instruction with screenshot + DOM context (INST-02)
  // Phase 3 stores it; Phase 4 sends to Claude Code
  ipcMain.handle(
    'overlay:submit-instruction',
    async (
      _event,
      data: {
        instruction: string;
        screenshot: Buffer;
        dom: DomExtractionResult;
        bounds: CSSRect;
      },
    ) => {
      // Phase 4 will implement the Claude Code integration here.
      // For now, log the submission so we can verify the pipeline works end-to-end.
      console.log('[claw] Instruction submitted:', {
        instruction: data.instruction,
        screenshotSize: data.screenshot?.length ?? 0,
        domElements: data.dom?.elements?.length ?? 0,
        bounds: data.bounds,
      });
      // Shrink overlay back to inactive
      setOverlayInactive(components.overlayView, components.window);
      components.overlayView.webContents.send('overlay:mode-change', 'inactive');
    },
  );
}
