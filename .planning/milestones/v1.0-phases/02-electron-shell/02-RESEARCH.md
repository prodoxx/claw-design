# Phase 2: Electron Shell - Research

**Researched:** 2026-04-04
**Domain:** Electron window management, WebContentsView compositing, overlay architecture, IPC security
**Confidence:** HIGH

## Summary

Phase 2 implements the Electron shell that displays the user's running localhost site with a transparent overlay layer. The core architecture uses BaseWindow + two stacked WebContentsViews (site view and overlay view) per decision D-09. Research confirms that Electron 36.9.5 (installed) has resolved the transparent WebContentsView compositing bug (#42335, fixed in PRs #43078 and #44628) and the multi-view rendering regression (#46203, fixed in PR #46353). However, a critical finding is that **mouse event passthrough between stacked WebContentsViews is NOT natively supported** -- `setIgnoreMouseEvents` operates only at the BaseWindow level, not on individual WebContentsView instances (confirmed via issue #23863, still open as of February 2025, and issue #45027, closed as "not planned"). CSS `pointer-events: none` within a WebContentsView's web content does NOT propagate clicks to a WebContentsView underneath.

The recommended architecture to satisfy both D-09 (two-view separation) and D-12 (mouse passthrough when overlay inactive) is a **visibility toggle pattern**: when the overlay is inactive, hide it or set its bounds to zero so all events reach the site view naturally. When the overlay is active (Phase 3), it captures all mouse events for selection drawing. The small always-visible indicator (D-14) can use a third narrow WebContentsView in the bottom-right corner, or can be implemented in the overlay view that stays visible with minimal bounds covering only the indicator area. This avoids the impossible requirement of partial click-through on a stacked WebContentsView.

**Primary recommendation:** Use BaseWindow with two WebContentsViews (site + overlay). Toggle overlay visibility/bounds to control mouse passthrough. Build the electron-vite config for dual renderer entry points (index.html for site chrome if needed, overlay.html for the overlay UI). Spawn Electron via `child_process.spawn` of the electron binary pointing at the built `out/main/index.js`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Standard OS frame with native title bar and traffic lights (macOS) / window controls (Windows). No frameless or custom chrome.
- **D-02:** Default window size: 1280x800, centered on screen.
- **D-03:** Window title format: `claw-design — PROJECT_NAME — localhost:PORT` (reads project name from package.json `name` field).
- **D-04:** Freely resizable by the user with no minimum size constraint. Phase 5 adds preset viewport buttons later.
- **D-05:** All in-site navigation allowed. User clicks links freely within their localhost site -- SPA routing and multi-page navigation both work normally.
- **D-06:** External URLs (non-localhost) open in the user's default system browser. Electron window stays on localhost.
- **D-07:** Chrome DevTools accessible via standard keyboard shortcut (Cmd+Opt+I / F12).
- **D-08:** Standard browser-like shortcuts supported: Cmd+R to refresh, Cmd+[ / Cmd+] for back/forward.
- **D-09:** Two stacked WebContentsViews inside a BaseWindow: site view (bottom) loads localhost, overlay view (top) is transparent. Clean separation -- overlay can't interfere with site JS/CSS.
- **D-10:** If the compositing artifact (electron/electron#42335) blocks the two-view approach during research, fall back to injecting the overlay into the site view via executeJavaScript.
- **D-11:** Overlay view loads a minimal HTML page from src/renderer/ (e.g., overlay.html) with its own CSS/JS entry point managed by electron-vite. Phase 3 builds selection UI here.
- **D-12:** When overlay is inactive (no selection mode), mouse events pass through completely to the site view. User interacts with their site normally.
- **D-13:** Both WebContentsViews auto-sync to fill the BaseWindow content area on resize. They stay perfectly aligned.
- **D-14:** Small indicator in the bottom-right corner of the overlay showing Claw is active. Always visible regardless of selection mode state.
- **D-15:** Bottom-right corner also hosts the activation button for selection mode (Phase 3 implements the behavior, Phase 2 establishes the placement).

### Claude's Discretion
- Exact indicator visual design (icon, size, opacity)
- Electron security configuration details (CSP headers, sandbox flags)
- IPC channel naming and preload script API surface
- How the CLI spawns the Electron process (child_process.spawn of electron binary vs electron-vite dev)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CLI-06 | CLI opens Electron window loading the dev server's localhost URL | Spawn Electron binary via child_process.spawn pointing at built main process. Pass URL and project metadata via command-line args or environment variables. |
| ELEC-01 | Electron window loads user's localhost URL with proper security isolation (sandbox, contextIsolation) | BaseWindow + WebContentsView with webPreferences: contextIsolation=true, sandbox=true, nodeIntegration=false. Preload script via contextBridge. CSP headers via session.webRequest. |
| ELEC-02 | Electron window renders selection overlay on top of the user's site content | Second WebContentsView with transparent background (#00000000) stacked on top of site view. Loads overlay.html from electron-vite renderer build. Toggle bounds for mouse passthrough. |
</phase_requirements>

## Standard Stack

### Core (all already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Electron | ^36.x (36.9.5 installed) | Desktop shell with BaseWindow + WebContentsView | Only viable approach for the overlay architecture. #42335 compositing bug fixed in this version. |
| electron-vite | ^5.0 (5.0.0 installed) | Build tooling for main/preload/renderer | Handles multi-entry renderer builds. Supports separate overlay.html and preload entries. |
| TypeScript | ~5.7 | Type-safe IPC channels | Critical for typed preload API and IPC message contracts. |

### Supporting (already in project)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tree-kill | ^1.2.2 | Kill Electron process tree | Shutdown handler already has `electronProcess` slot |
| picocolors | ^1.1.0 | CLI output during Electron launch | Spinner messages for "Opening Electron..." |
| ora | ^9.0.0 | Spinner for Electron launch step | Brief spinner while Electron window opens |

### No new dependencies needed
This phase adds zero new npm packages. Everything uses Electron built-ins and existing project dependencies.

## Architecture Patterns

### Recommended Project Structure
```
src/
  main/
    index.ts              # Electron main process entry (BaseWindow, WebContentsView setup)
    window.ts             # Window creation and management (BaseWindow factory)
    navigation.ts         # will-navigate + setWindowOpenHandler (D-05, D-06)
    ipc-handlers.ts       # ipcMain.handle() registrations
  preload/
    index.ts              # Site view preload (minimal -- no overlay APIs needed for site)
    overlay.ts            # Overlay view preload (contextBridge API for Phase 3)
  renderer/
    index.html            # Existing placeholder (not loaded by site view -- site loads localhost)
    overlay.html          # Overlay UI entry (transparent page with indicator)
    overlay.css           # Overlay styles (pointer-events, positioning)
    overlay.ts            # Overlay renderer script (indicator, future selection UI)
  cli/
    commands/start.ts     # Updated: spawns Electron after Step 6
    utils/electron.ts     # NEW: Electron process spawning utility
```

### Pattern 1: BaseWindow + Dual WebContentsView
**What:** Create a BaseWindow (standard frame per D-01) with two child WebContentsViews. The site view loads the user's localhost URL. The overlay view loads overlay.html with a transparent background.
**When to use:** Always -- this is the core window architecture.
**Example:**
```typescript
// Source: Electron docs (BaseWindow, WebContentsView)
import { BaseWindow, WebContentsView, app } from 'electron';
import path from 'node:path';

function createMainWindow(url: string, projectName: string, port: number): BaseWindow {
  const win = new BaseWindow({
    width: 1280,    // D-02
    height: 800,    // D-02
    center: true,   // D-02
    title: `claw-design \u2014 ${projectName} \u2014 localhost:${port}`, // D-03
    // D-01: standard frame (frame defaults to true)
  });

  // Site view (bottom layer)
  const siteView = new WebContentsView({
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      // No preload needed for site view in Phase 2
    },
  });
  win.contentView.addChildView(siteView);
  siteView.webContents.loadURL(url);

  // Overlay view (top layer)
  const overlayView = new WebContentsView({
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      preload: path.join(__dirname, '../preload/overlay.mjs'),
    },
  });
  overlayView.webContents.setBackgroundColor('#00000000'); // Transparent
  win.contentView.addChildView(overlayView);

  // Load overlay HTML from electron-vite build output
  overlayView.webContents.loadFile(
    path.join(__dirname, '../renderer/overlay.html')
  );

  // Sync both views to window content area on resize (D-13)
  function syncBounds() {
    const { width, height } = win.getContentBounds();
    siteView.setBounds({ x: 0, y: 0, width, height });
    // When overlay inactive, only show indicator area (D-12, D-14)
    overlayView.setBounds({ x: 0, y: 0, width, height });
  }
  win.on('resize', syncBounds);
  syncBounds();

  return win;
}
```

### Pattern 2: Mouse Passthrough via Overlay Bounds Toggle
**What:** Since `setIgnoreMouseEvents` does not exist on WebContentsView (only on BaseWindow), control mouse passthrough by toggling the overlay view's bounds. When inactive, shrink overlay to cover only the indicator area in the bottom-right corner. When active (Phase 3), expand to full window size.
**When to use:** Toggle between selection mode (overlay captures all input) and browse mode (user interacts with site).
**Critical insight:** This is the ONLY viable approach for D-12. CSS `pointer-events: none` within the overlay's web content does NOT pass clicks to the WebContentsView underneath -- pointer events operate within a single WebContentsView's Chromium instance, not across native view boundaries.
**Example:**
```typescript
// Overlay states
function setOverlayInactive(overlayView: WebContentsView, win: BaseWindow) {
  const { width, height } = win.getContentBounds();
  // Only cover bottom-right corner for indicator (D-14)
  const indicatorWidth = 48;
  const indicatorHeight = 48;
  overlayView.setBounds({
    x: width - indicatorWidth,
    y: height - indicatorHeight,
    width: indicatorWidth,
    height: indicatorHeight,
  });
}

function setOverlayActive(overlayView: WebContentsView, win: BaseWindow) {
  const { width, height } = win.getContentBounds();
  overlayView.setBounds({ x: 0, y: 0, width, height });
}
```

### Pattern 3: Navigation Restriction (D-05, D-06)
**What:** Allow in-site localhost navigation, but open external URLs in the system browser.
**When to use:** On the site WebContentsView.
**Example:**
```typescript
// Source: Electron Security docs - navigation restriction
import { shell } from 'electron';

function setupNavigation(siteView: WebContentsView, allowedOrigin: string) {
  // Intercept same-window navigation (D-05, D-06)
  siteView.webContents.on('will-navigate', (event, navigationUrl) => {
    const parsed = new URL(navigationUrl);
    if (parsed.origin !== allowedOrigin) {
      event.preventDefault();
      shell.openExternal(navigationUrl);
    }
  });

  // Intercept window.open / target="_blank" (D-06)
  siteView.webContents.setWindowOpenHandler(({ url }) => {
    const parsed = new URL(url);
    if (parsed.origin !== allowedOrigin) {
      shell.openExternal(url);
    }
    return { action: 'deny' }; // Never open new Electron windows
  });
}
```

### Pattern 4: CLI Spawns Electron Binary
**What:** The CLI spawns the Electron binary as a child process, passing the built main process script and the localhost URL.
**When to use:** In `start.ts` after the dev server is ready and Claude Code is launched.
**Recommendation (Claude's Discretion):** Use `child_process.spawn` with the electron binary path from the `electron` npm module. Do NOT use `electron-vite dev` -- that runs its own dev server which conflicts with the user's dev server. Build the electron-vite output during `npm run build`, then spawn the electron binary pointing at `out/main/index.js`.
**Example:**
```typescript
// src/cli/utils/electron.ts
import { spawn, type ChildProcess } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);

export function spawnElectron(url: string, projectName: string): ChildProcess {
  // Resolve electron binary path
  const electronPath = require('electron') as unknown as string;

  // Path to built main process
  const mainScript = path.resolve(__dirname, '../../out/main/index.js');

  const child = spawn(electronPath, [mainScript], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      CLAW_URL: url,
      CLAW_PROJECT_NAME: projectName,
    },
  });

  return child;
}
```

### Pattern 5: Preload Script with contextBridge
**What:** Typed preload API exposing specific functions to the overlay renderer.
**When to use:** The overlay preload establishes the bridge for Phase 3 IPC. Phase 2 exposes minimal API (overlay mode toggle).
**Example:**
```typescript
// src/preload/overlay.ts
import { contextBridge, ipcRenderer } from 'electron';

const overlayAPI = {
  /** Request activation of selection mode (Phase 3) */
  activateSelection: (): Promise<void> =>
    ipcRenderer.invoke('overlay:activate-selection'),

  /** Listen for overlay mode changes from main */
  onModeChange: (callback: (mode: 'inactive' | 'selection') => void): void => {
    ipcRenderer.on('overlay:mode-change', (_event, mode) => callback(mode));
  },
};

contextBridge.exposeInMainWorld('claw', overlayAPI);

// Type declaration for renderer
export type ClawOverlayAPI = typeof overlayAPI;
```

```typescript
// src/renderer/claw.d.ts (global type declaration)
import type { ClawOverlayAPI } from '../preload/overlay';

declare global {
  interface Window {
    claw: ClawOverlayAPI;
  }
}
```

### Anti-Patterns to Avoid
- **DO NOT use BrowserView:** Deprecated since Electron 30. Use WebContentsView.
- **DO NOT use BrowserWindow for the main window:** Use BaseWindow when stacking WebContentsViews. BrowserWindow is a convenience wrapper that creates its own WebContentsView, making multi-view composition awkward.
- **DO NOT set `nodeIntegration: true`:** Security violation. Always use contextBridge + preload.
- **DO NOT use `webContents.executeJavaScript()` for the overlay UI:** Decision D-09 explicitly requires separate WebContentsViews for clean isolation. The executeJavaScript fallback (D-10) is only for if compositing bugs block the approach, which research confirms they do NOT in Electron 36.
- **DO NOT rely on CSS `pointer-events: none` for cross-view click passthrough:** It only works within a single WebContentsView's DOM, not across native view boundaries.
- **DO NOT use `electron-vite dev` for the runtime:** The user's dev server is already running. Spawn the electron binary directly against the pre-built main process output.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Transparent overlay compositing | Custom off-screen rendering | WebContentsView.setBackgroundColor('#00000000') | Built-in, bug fixed in Electron 36 |
| External link handling | URL parsing + window management | will-navigate + setWindowOpenHandler + shell.openExternal | Electron's standard pattern, handles edge cases |
| Process tree cleanup | Manual PID tracking | tree-kill (already in project) | Handles nested process trees correctly |
| IPC type safety | Runtime message validation | TypeScript + contextBridge typed API | Compile-time safety, zero runtime cost |
| DevTools toggle | Custom shortcut handler | Electron default behavior with webContents.openDevTools() | D-07 just needs shortcuts working, which they do by default |

**Key insight:** Electron 36 provides all the primitives needed. The only non-trivial engineering is the overlay bounds toggle pattern for mouse passthrough, which is ~20 lines of code.

## Common Pitfalls

### Pitfall 1: Assuming CSS pointer-events passes clicks between WebContentsViews
**What goes wrong:** Developer sets `pointer-events: none` on the overlay's body expecting clicks to reach the site view underneath. Nothing happens -- site view receives zero events.
**Why it happens:** Each WebContentsView runs its own Chromium renderer process. CSS pointer-events operates within a single renderer. The native view compositor (Chromium's ui::Layer) delivers input to the topmost view regardless of CSS.
**How to avoid:** Use the bounds toggle pattern. When overlay is inactive, shrink its bounds so it doesn't cover the site view.
**Warning signs:** Site becomes completely unresponsive to clicks when overlay is added.

### Pitfall 2: Using BrowserWindow instead of BaseWindow
**What goes wrong:** Developer creates a BrowserWindow and tries to add WebContentsView children. BrowserWindow already has its own internal WebContentsView, leading to confusing layering.
**Why it happens:** BrowserWindow is the "default" in most Electron tutorials. BaseWindow is newer and less documented.
**How to avoid:** Always use BaseWindow when composing multiple WebContentsViews. Import from 'electron' explicitly.
**Warning signs:** Extra blank page appears, z-ordering is wrong, content loads twice.

### Pitfall 3: Not syncing view bounds on resize
**What goes wrong:** Window resizes but WebContentsViews stay at their original size, leaving white gaps or causing content overflow.
**Why it happens:** WebContentsView has no `setAutoResize()` (feature request #43802, still open). Manual resize handling is required.
**How to avoid:** Listen to BaseWindow `resize` event and call `setBounds()` on all child views. Also call `syncBounds()` immediately after creation.
**Warning signs:** White borders appear when window is resized larger. Content clips when resized smaller.

### Pitfall 4: Forgetting setBackgroundColor on overlay view
**What goes wrong:** Overlay view renders with a solid white background, completely hiding the site view underneath.
**Why it happens:** WebContentsView defaults to white background (unlike BrowserView which defaulted to transparent). This changed during the BrowserView -> WebContentsView migration.
**How to avoid:** Call `overlayView.webContents.setBackgroundColor('#00000000')` immediately after creation and before loading content.
**Warning signs:** Site content invisible, only overlay HTML visible.

### Pitfall 5: Loading the wrong content in the site view
**What goes wrong:** Site view loads a local HTML file instead of the user's localhost URL, or loads with wrong protocol prefix.
**Why it happens:** Using `loadFile()` instead of `loadURL()`, or forgetting the `http://` prefix.
**How to avoid:** Always use `siteView.webContents.loadURL('http://localhost:PORT')` with full protocol.
**Warning signs:** ERR_FILE_NOT_FOUND or blank page instead of user's site.

### Pitfall 6: Preload path wrong after electron-vite build
**What goes wrong:** Preload script not found at runtime, causing security errors or missing API.
**Why it happens:** electron-vite outputs preload scripts to `out/preload/` with `.mjs` extension. Path relative to the main process file must account for the build output structure.
**How to avoid:** Use `path.join(__dirname, '../preload/overlay.mjs')` from the main process. Verify the actual output filenames after `electron-vite build`.
**Warning signs:** Console error about preload script not found. `window.claw` is undefined in overlay renderer.

### Pitfall 7: Spawning Electron before build
**What goes wrong:** Electron starts but crashes immediately because `out/main/index.js` doesn't exist or is empty.
**Why it happens:** The build step (`electron-vite build`) must complete before spawning the Electron binary.
**How to avoid:** Either run build as part of the CLI start sequence, or ensure build is a prerequisite (npm script).
**Warning signs:** Electron window opens and immediately closes, or shows a white screen.

## Code Examples

### electron-vite Multi-Entry Config
```typescript
// electron.vite.config.ts - Updated for overlay entry
import { defineConfig } from 'electron-vite';
import { resolve } from 'node:path';

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        input: 'src/main/index.ts',
      },
    },
  },
  preload: {
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/preload/index.ts'),
          overlay: resolve(__dirname, 'src/preload/overlay.ts'),
        },
      },
    },
  },
  renderer: {
    root: 'src/renderer',
    build: {
      rollupOptions: {
        input: {
          overlay: resolve(__dirname, 'src/renderer/overlay.html'),
        },
      },
    },
  },
});
```

### Overlay HTML Template
```html
<!-- src/renderer/overlay.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self' 'unsafe-inline'">
  <title>claw-design overlay</title>
  <link rel="stylesheet" href="./overlay.css">
</head>
<body>
  <div id="claw-indicator" class="claw-indicator">
    <!-- Phase 2: small Claw indicator -->
    <!-- Phase 3: selection mode button added here -->
  </div>
  <script type="module" src="./overlay.ts"></script>
</body>
</html>
```

### Security Configuration
```typescript
// Secure webPreferences for site view (ELEC-01)
const siteWebPreferences: Electron.WebPreferences = {
  contextIsolation: true,       // Default in Electron 12+
  sandbox: true,                // Default in Electron 20+
  nodeIntegration: false,       // Default false
  webSecurity: true,            // Default true
  allowRunningInsecureContent: false,
  // No preload -- site view doesn't need Claw API
};

// Secure webPreferences for overlay view
const overlayWebPreferences: Electron.WebPreferences = {
  contextIsolation: true,
  sandbox: true,
  nodeIntegration: false,
  webSecurity: true,
  preload: path.join(__dirname, '../preload/overlay.mjs'),
};
```

### Window Title from package.json (D-03)
```typescript
// In main process
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function getProjectName(cwd: string): string {
  try {
    const pkg = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf-8'));
    return pkg.name || 'unknown';
  } catch {
    return 'unknown';
  }
}
```

### DevTools Shortcut (D-07)
```typescript
// DevTools are accessible by default via Cmd+Opt+I (macOS) / Ctrl+Shift+I (Windows/Linux)
// For the site view specifically:
siteView.webContents.on('before-input-event', (_event, input) => {
  // F12 shortcut (D-07)
  if (input.key === 'F12') {
    siteView.webContents.toggleDevTools();
  }
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| BrowserView | WebContentsView | Electron 30 (2024) | BrowserView deprecated. WebContentsView + BaseWindow is the replacement. |
| BrowserWindow for multi-view | BaseWindow + WebContentsView children | Electron 30 (2024) | BaseWindow gives clean control over child views. |
| setAutoResize on BrowserView | Manual resize listener + setBounds | Electron 30 (2024) | No auto-resize on WebContentsView yet (feature request #43802 open). |
| Transparent BrowserView (default) | Explicit setBackgroundColor('#00000000') | Electron 30 (2024) | WebContentsView defaults to white, must explicitly set transparent. |

**Deprecated/outdated:**
- BrowserView: Deprecated since Electron 30. Do not use.
- `nodeIntegration: true`: Considered a security vulnerability since 2020. Never enable for content loading external URLs.

## Compositing Bug Status (D-10 Evaluation)

**Issue #42335** (transparent WebContentsView rendering artifacts):
- **Status:** CLOSED, COMPLETED. Fixed in PRs #43078 and #44628.
- **Affected versions:** Electron 31.0.0-beta.7 through 32.x
- **Current version (36.9.5):** Fix is included. Two-view approach is safe.

**Issue #46203** (glitchy overlay with multiple WebContentsViews, regression since v34):
- **Status:** CLOSED, COMPLETED. Fixed in PR #46353.
- **Affected versions:** Electron 35.0.0 (working in 34.x)
- **Current version (36.9.5):** Fix is included.

**Conclusion:** D-10 fallback (executeJavaScript injection) is NOT needed. The two-view approach works correctly in Electron 36.9.5. Proceed with D-09.

## Open Questions

1. **Electron build timing in CLI flow**
   - What we know: electron-vite build must complete before spawning the Electron binary. The current `start.ts` orchestration runs Steps 1-6 sequentially.
   - What's unclear: Should `electron-vite build` run on every `clawdesign start`, or should it be a post-install hook / separate build step? Running on every start adds ~600ms latency. Running once on install risks stale builds during development.
   - Recommendation: Run `electron-vite build` as part of `clawdesign start` (Step 7, before spawning Electron). The ~600ms build time is negligible in a startup flow that already waits for dev server readiness. Cache invalidation is avoided entirely.

2. **Indicator size and overlay bounds precision**
   - What we know: D-14 requires a small indicator in the bottom-right corner. The bounds toggle approach needs exact pixel dimensions.
   - What's unclear: The exact indicator size hasn't been specified (Claude's discretion). This affects the "inactive" bounds calculation.
   - Recommendation: Start with a 48x48 indicator area. The overlay renderer positions the indicator via CSS within its available bounds. If the indicator needs to be larger (e.g., includes text), adjust bounds.

3. **Electron process communication with CLI**
   - What we know: CLI spawns Electron as child process. Electron needs to receive the URL and project metadata.
   - What's unclear: Whether to use environment variables, command-line args, or a more structured IPC mechanism (Node IPC channel).
   - Recommendation: Use environment variables (`CLAW_URL`, `CLAW_PROJECT_NAME`, `CLAW_CWD`) for the initial handshake. Simple, no serialization overhead, no protocol design. If bidirectional CLI-to-Electron communication is needed later (Phase 3+), add Node IPC channel then.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Electron | Window shell | Yes | 36.9.5 | -- |
| electron-vite | Build tooling | Yes | 5.0.0 | -- |
| Node.js | Runtime | Yes | >=20.x (required by project) | -- |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.0.0 |
| Config file | vitest.config.ts |
| Quick run command | `npx vitest run` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CLI-06 | CLI spawns Electron process after dev server ready | unit (mock spawn) | `npx vitest run tests/cli/electron.test.ts -t "spawn"` | No -- Wave 0 |
| CLI-06 | Electron PID registered in shutdown handlers | unit | `npx vitest run tests/cli/electron.test.ts -t "shutdown"` | No -- Wave 0 |
| ELEC-01 | Window created with secure webPreferences | unit (mock Electron) | `npx vitest run tests/main/window.test.ts -t "security"` | No -- Wave 0 |
| ELEC-01 | External URLs open in system browser | unit | `npx vitest run tests/main/navigation.test.ts -t "external"` | No -- Wave 0 |
| ELEC-02 | Overlay view created with transparent background | unit | `npx vitest run tests/main/window.test.ts -t "overlay"` | No -- Wave 0 |
| ELEC-02 | Overlay bounds toggle between inactive/active | unit | `npx vitest run tests/main/window.test.ts -t "bounds"` | No -- Wave 0 |

Note: Full E2E testing of Electron windows requires Playwright with `electron.launch()` which is Phase-level verification, not per-task unit testing. Unit tests mock Electron APIs to verify configuration and logic.

### Sampling Rate
- **Per task commit:** `npx vitest run`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/cli/electron.test.ts` -- covers CLI-06 (Electron spawn + shutdown integration)
- [ ] `tests/main/window.test.ts` -- covers ELEC-01, ELEC-02 (window creation, security, overlay)
- [ ] `tests/main/navigation.test.ts` -- covers ELEC-01 (navigation restriction, external links)
- [ ] Electron API mocking pattern (Vitest mocks for BaseWindow, WebContentsView, etc.)

## Project Constraints (from CLAUDE.md)

- **Platform:** Electron for browser window
- **CLI spawns Electron, not the other way around** (Key Technical Decision #1)
- **Renderer loads user's localhost directly** (Key Technical Decision #2)
- **electron-vite for build tooling** (not Electron Forge)
- **tree-kill for process cleanup**
- **contextBridge + contextIsolation for security** (mandatory pattern)
- **Never create .env.backup files**
- **GSD workflow enforcement** -- all changes through GSD commands

## Sources

### Primary (HIGH confidence)
- [Electron BaseWindow API](https://www.electronjs.org/docs/latest/api/base-window) - Constructor options, resize events, contentView, setTitle
- [Electron WebContentsView API](https://www.electronjs.org/docs/latest/api/web-contents-view) - Constructor, setBounds, addChildView, webPreferences
- [Electron webContents API](https://www.electronjs.org/docs/latest/api/web-contents) - loadURL, setBackgroundColor, will-navigate, setWindowOpenHandler, executeJavaScript, openDevTools
- [Electron Security Tutorial](https://www.electronjs.org/docs/latest/tutorial/security) - 20-point checklist, CSP, navigation restriction, IPC validation
- [Electron Context Isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation) - contextBridge pattern, typed API exposure
- [Electron BrowserView to WebContentsView Migration](https://www.electronjs.org/blog/migrate-to-webcontentsview) - Transparency default change, setBounds, addChildView
- [electron-vite Multi-Entry Config](https://electron-vite.org/guide/dev) - rollupOptions.input for multiple preloads and renderers
- [electron-vite Programmatic API](https://electron-vite.org/api/) - build() function for CLI integration

### Secondary (MEDIUM confidence)
- [Electron Issue #42335](https://github.com/electron/electron/issues/42335) - Transparent WebContentsView compositing bug, CLOSED/COMPLETED
- [Electron Issue #46203](https://github.com/electron/electron/issues/46203) - Multi-view rendering regression, CLOSED/COMPLETED
- [Electron Issue #45027](https://github.com/electron/electron/issues/45027) - Overlapped WebContentsView pointer events, CLOSED as not planned
- [Electron Issue #23863](https://github.com/electron/electron/issues/23863) - setIgnoreMouseEvents for BrowserView/WebContentsView, OPEN (not implemented)
- [Electron Issue #43802](https://github.com/electron/electron/issues/43802) - setAutoResize for WebContentsView, OPEN (not implemented)
- [Electron Custom Window Interactions](https://www.electronjs.org/docs/latest/tutorial/custom-window-interactions) - setIgnoreMouseEvents pattern (window-level only)

### Tertiary (LOW confidence)
- None -- all findings verified against official Electron docs and issue tracker.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All packages already in project, versions verified against installed node_modules
- Architecture: HIGH - BaseWindow + WebContentsView pattern verified working in Electron 36.9.5. Compositing bugs confirmed fixed. Mouse passthrough limitation confirmed and workaround designed.
- Pitfalls: HIGH - Each pitfall traced to official Electron issues or API documentation

**Research date:** 2026-04-04
**Valid until:** 2026-05-04 (Electron releases every 8 weeks but ^36.x pin means no breaking changes)
