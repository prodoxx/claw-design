import { app } from 'electron';
import { createMainWindow, setOverlayInactive } from './window.js';
import { setupNavigation } from './navigation.js';
import { registerIpcHandlers } from './ipc-handlers.js';
import { AgentManager } from './agent-manager.js';

const url = process.env.CLAW_URL ?? 'http://localhost:3000';
const projectName = process.env.CLAW_PROJECT_NAME ?? 'unknown';
const port = parseInt(url.match(/:(\d+)/)?.[1] ?? '3000', 10);

app.whenReady().then(() => {
  const components = createMainWindow(url, projectName, port);

  // Navigate from splash to actual site URL (D-21)
  // The splash shows immediately while the site loads.
  // No minimum display time -- if site loads instantly, splash is replaced.
  components.navigateToSite();

  // Setup navigation restriction (D-05, D-06)
  const allowedOrigin = new URL(url).origin;
  setupNavigation(components.siteView, allowedOrigin);

  // Initialize AgentManager for Claude Code integration (Phase 4)
  const projectDir = process.env.CLAW_PROJECT_DIR ?? process.cwd();
  const agentManager = new AgentManager(projectDir);

  // Wire AgentManager status updates to sidebar view
  agentManager.setOnTaskUpdate((update) => {
    components.sidebarView.webContents.send('sidebar:task-update', update);
    // First task: show sidebar expanded
    if (components.getSidebarState() === 'hidden') {
      components.setSidebarState('expanded');
    }
  });

  // Register IPC handlers for overlay and sidebar communication
  registerIpcHandlers(components, agentManager);

  // Start with overlay in inactive state (D-12)
  setOverlayInactive(components.overlayView, components.window);

  // ============================================================
  // Dev server crash detection (D-11): monitor siteView for load failures.
  // When the dev server dies, the siteView fails to load/navigate.
  // Trigger an in-window toast notification so the user knows.
  // ============================================================

  let devServerCrashNotified = false;

  components.siteView.webContents.on('did-fail-load', (_event, _errorCode, _errorDescription, validatedURL) => {
    // Only notify for the localhost URL (not other resources)
    if (!validatedURL.includes('localhost') && !validatedURL.includes('127.0.0.1')) return;
    // Only notify once per crash (avoid spam on auto-retry) -- T-05-06
    if (devServerCrashNotified) return;
    devServerCrashNotified = true;

    // Send toast to overlay renderer
    components.overlayView.webContents.send('toast:show', {
      id: 'dev-server-crash',
      severity: 'error' as const,
      title: 'Dev server disconnected',
      message: 'The dev server process exited unexpectedly. Restart clawdesign to continue.',
      persistent: true,
    });
  });

  // Also detect when site page crashes or becomes unresponsive
  components.siteView.webContents.on('render-process-gone', (_event, _details) => {
    if (devServerCrashNotified) return;
    devServerCrashNotified = true;

    components.overlayView.webContents.send('toast:show', {
      id: 'dev-server-crash',
      severity: 'error' as const,
      title: 'Connection lost',
      message: `Cannot reach localhost:${port}. Check if the dev server is still running.`,
      persistent: true,
    });
  });

  // Handle window close
  components.window.on('closed', () => {
    app.quit();
  });

  // Clean up AgentManager on quit (shutdown all agents)
  app.on('before-quit', () => {
    agentManager.shutdown();
  });
});

// Quit when all windows are closed (macOS included)
app.on('window-all-closed', () => {
  app.quit();
});
