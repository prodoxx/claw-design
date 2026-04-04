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

  // Setup navigation restriction (D-05, D-06)
  const allowedOrigin = new URL(url).origin;
  setupNavigation(components.siteView, allowedOrigin);

  // Initialize AgentManager for Claude Code integration (Phase 4)
  const projectDir = process.env.CLAW_PROJECT_DIR ?? process.cwd();
  const agentManager = new AgentManager(projectDir);

  // Wire AgentManager status updates to sidebar view
  agentManager.setOnTaskUpdate((update) => {
    components.sidebarView.webContents.send('sidebar:task-update', update);
    // First task: transition sidebar from hidden to minimized
    if (components.getSidebarState() === 'hidden') {
      components.setSidebarState('minimized');
    }
  });

  // Register IPC handlers for overlay and sidebar communication
  registerIpcHandlers(components, agentManager);

  // Start with overlay in inactive state (D-12)
  setOverlayInactive(components.overlayView, components.window);

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
