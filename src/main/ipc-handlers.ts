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
import { type AgentManager } from './agent-manager.js';

/**
 * Register IPC handlers for overlay and sidebar communication.
 *
 * Phase 2 establishes the activation/deactivation scaffold.
 * Phase 3 adds selection capture and DOM extraction handlers.
 * Phase 4 wires submit to AgentManager and adds sidebar IPC channels.
 */
export function registerIpcHandlers(
  components: WindowComponents,
  agentManager: AgentManager,
): void {
  // Activate selection mode: expand overlay to full window, notify renderer
  // D-08: auto-minimize sidebar when entering selection mode
  ipcMain.handle('overlay:activate-selection', async () => {
    if (components.getSidebarState() === 'expanded') {
      components.setSidebarState('minimized');
    }
    setOverlayActive(components.overlayView, components.window, components);
    components.overlayView.webContents.send(
      'overlay:mode-change',
      'selection',
    );
  });

  // Deactivate selection mode: shrink overlay to indicator, notify renderer
  ipcMain.handle('overlay:deactivate-selection', async () => {
    setOverlayInactive(components.overlayView, components.window, components);
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

  // Submit instruction with screenshot + DOM context (CLAUD-01, CLAUD-02)
  // Routes to AgentManager which spawns a Claude agent for this task.
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
      // Pitfall 1: Buffer may arrive as Uint8Array via IPC structured cloning
      const screenshotBuffer = Buffer.from(data.screenshot);

      const taskId = await agentManager.submitTask({
        instruction: data.instruction,
        screenshot: screenshotBuffer,
        dom: data.dom,
        bounds: data.bounds,
      });

      // Shrink overlay back to inactive (user submitted, selection done)
      setOverlayInactive(components.overlayView, components.window, components);
      components.overlayView.webContents.send('overlay:mode-change', 'inactive');

      return taskId;
    },
  );

  // --- Sidebar IPC handlers ---

  // Sidebar expand (renderer -> main)
  ipcMain.handle('sidebar:expand', async () => {
    components.setSidebarState('expanded');
  });

  // Sidebar collapse (renderer -> main)
  ipcMain.handle('sidebar:collapse', async () => {
    components.setSidebarState('minimized');
  });

  // Sidebar task dismiss (renderer -> main)
  ipcMain.handle('sidebar:task-dismiss', async (_event, data: { id: string }) => {
    agentManager.dismissTask(data.id);
    // If no tasks remain, hide sidebar
    if (agentManager.getAllTasks().length === 0) {
      components.setSidebarState('hidden');
    }
  });

  // Sidebar task logs (renderer -> main)
  ipcMain.handle('sidebar:task-logs', async (_event, data: { id: string }) => {
    return agentManager.getTaskLogs(data.id);
  });

  // Sidebar task retry -- re-submit with original context (no re-selection needed)
  ipcMain.handle('sidebar:task-retry', async (_event, data: { id: string }) => {
    await agentManager.retryTask(data.id);
  });

  // Sidebar task undo -- submit a new task asking Claude to revert the change
  ipcMain.handle('sidebar:task-undo', async (_event, data: { id: string }) => {
    await agentManager.undoTask(data.id);
  });

  // --- Sidebar drag IPC handlers ---

  // Apply drag delta to sidebar view position (returns clamped new position)
  ipcMain.handle('sidebar:drag-delta', async (_event, data: { dx: number; dy: number }) => {
    const current = components.sidebarView.getBounds();
    const { width: winW, height: winH } = components.window.getContentBounds();
    const newX = Math.max(0, Math.min(winW - current.width, current.x + data.dx));
    const newY = Math.max(0, Math.min(winH - current.height, current.y + data.dy));
    components.sidebarView.setBounds({ ...current, x: newX, y: newY });
    components.setSidebarUserPosition(newX, newY);
    return { x: newX, y: newY };
  });

  // Set absolute sidebar position (used to restore saved position on startup)
  ipcMain.handle('sidebar:set-position', async (_event, data: { x: number; y: number }) => {
    const current = components.sidebarView.getBounds();
    const { width: winW, height: winH } = components.window.getContentBounds();
    const x = Math.max(0, Math.min(winW - current.width, data.x));
    const y = Math.max(0, Math.min(winH - current.height, data.y));
    components.sidebarView.setBounds({ ...current, x, y });
    components.setSidebarUserPosition(x, y);
  });

  // --- Toolbar drag IPC handlers ---

  // Apply drag delta to overlay (toolbar) view position (returns clamped new position)
  ipcMain.handle('overlay:drag-toolbar', async (_event, data: { dx: number; dy: number }) => {
    const current = components.overlayView.getBounds();
    const { width: winW, height: winH } = components.window.getContentBounds();
    const newX = Math.max(0, Math.min(winW - current.width, current.x + data.dx));
    const newY = Math.max(0, Math.min(winH - current.height, current.y + data.dy));
    components.overlayView.setBounds({ ...current, x: newX, y: newY });
    components.setToolbarPosition(newX, newY);
    return { x: newX, y: newY };
  });

  // Set absolute toolbar position (used to restore saved position on startup)
  ipcMain.handle('overlay:set-toolbar-position', async (_event, data: { x: number; y: number }) => {
    const current = components.overlayView.getBounds();
    const { width: winW, height: winH } = components.window.getContentBounds();
    const x = Math.max(0, Math.min(winW - current.width, data.x));
    const y = Math.max(0, Math.min(winH - current.height, data.y));
    components.overlayView.setBounds({ ...current, x, y });
    components.setToolbarPosition(x, y);
  });
}
