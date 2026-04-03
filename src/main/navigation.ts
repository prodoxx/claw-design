import { shell, type WebContentsView } from 'electron';

/**
 * Setup navigation restriction for the site view.
 *
 * D-05: All in-site localhost navigation allowed.
 * D-06: External URLs open in the user's default system browser.
 *        Never open new Electron windows, even for localhost.
 */
export function setupNavigation(
  siteView: WebContentsView,
  allowedOrigin: string,
): void {
  // Intercept same-window navigation (D-05, D-06)
  siteView.webContents.on('will-navigate', (event, navigationUrl) => {
    try {
      const parsed = new URL(navigationUrl);
      if (parsed.origin !== allowedOrigin) {
        event.preventDefault();
        shell.openExternal(navigationUrl);
      }
    } catch {
      // Malformed URL -- prevent navigation, log warning
      event.preventDefault();
      console.warn(
        `[claw-design] Blocked navigation to malformed URL: ${navigationUrl}`,
      );
    }
  });

  // Intercept window.open / target="_blank" (D-06)
  siteView.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsed = new URL(url);
      if (parsed.origin !== allowedOrigin) {
        shell.openExternal(url);
      }
    } catch {
      console.warn(
        `[claw-design] Blocked window.open for malformed URL: ${url}`,
      );
    }
    // Never open new Electron windows, even for localhost (D-06)
    return { action: 'deny' as const };
  });
}
