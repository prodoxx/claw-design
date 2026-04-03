import { app } from 'electron';
import { createMainWindow, setOverlayInactive } from './window.js';
import { setupNavigation } from './navigation.js';
import { registerIpcHandlers } from './ipc-handlers.js';

const url = process.env.CLAW_URL ?? 'http://localhost:3000';
const projectName = process.env.CLAW_PROJECT_NAME ?? 'unknown';
const port = parseInt(url.match(/:(\d+)/)?.[1] ?? '3000', 10);

app.whenReady().then(() => {
  const components = createMainWindow(url, projectName, port);

  // Setup navigation restriction (D-05, D-06)
  const allowedOrigin = new URL(url).origin;
  setupNavigation(components.siteView, allowedOrigin);

  // Register IPC handlers for overlay communication
  registerIpcHandlers(components);

  // Start with overlay in inactive state (D-12)
  setOverlayInactive(components.overlayView, components.window);

  // Handle window close
  components.window.on('closed', () => {
    app.quit();
  });
});

// Quit when all windows are closed (macOS included)
app.on('window-all-closed', () => {
  app.quit();
});
