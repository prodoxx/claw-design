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

  // Sidebar task retry (renderer -> main) -- per D-19
  ipcMain.handle('sidebar:task-retry', async (_event, data: { id: string }) => {
    const task = agentManager.getTask(data.id);
    if (!task) return;

    // Prefill the overlay instruction input with original text
    components.overlayView.webContents.send('overlay:prefill-instruction', {
      instruction: task.instruction,
    });

    // Activate overlay for new selection + instruction
    setOverlayActive(components.overlayView, components.window, components);
    components.overlayView.webContents.send('overlay:mode-change', 'selection');

    // Dismiss the errored task (it will be replaced by the new submission)
    agentManager.dismissTask(data.id);
  });
}
