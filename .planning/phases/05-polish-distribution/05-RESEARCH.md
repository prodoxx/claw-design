# Phase 5: Polish & Distribution - Research

**Researched:** 2026-04-06
**Domain:** Electron viewport management, in-window notifications, npm packaging, pre-release polish
**Confidence:** HIGH

## Summary

Phase 5 transforms claw-design from a working prototype into a shippable npm package. The work spans four domains: (1) viewport switching with Electron-level bounds animation, (2) in-window toast/banner notification system, (3) npm packaging for global install, and (4) visual polish including splash screen, tooltips, and consistency audit.

The technical risk is low. All viewport work uses existing Electron APIs (`View.setBounds`, `View.setBackgroundColor`) already proven in Phases 2-4. The toast system is a self-contained UI addition to the overlay renderer. npm packaging requires restructuring `package.json` metadata and moving `electron` to production dependencies. No new external libraries are needed -- all Phase 5 work uses built-in Electron APIs and vanilla HTML/CSS/TS.

The main complexity lies in the viewport bounds animation (requestAnimationFrame-driven `setBounds()` interpolation) and the coordination between viewport state and the existing overlay bounds toggle system. The inactive overlay dimensions must grow to accommodate the new viewport buttons, and `syncBounds()` must be viewport-aware.

**Primary recommendation:** Implement viewport switching first (it touches the most files and changes core bounds management), then layer toast notifications and splash screen on top, and finish with npm packaging/polish as a final wave.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Viewport preset buttons live in the existing overlay toolbar -- extend the vertical pill with 3 new icons (desktop, tablet, mobile) separated visually from the selection controls.
- **D-02:** Switching viewports resizes the site view only, not the window. Window stays full size. Site view is constrained to the preset dimensions, centered, with dark background fill on the surrounding area (like Chrome DevTools responsive mode).
- **D-03:** Three presets: Desktop (1280x800), Tablet (768x1024), Mobile (375x812).
- **D-04:** Active viewport icon gets a brighter/accent color to indicate current selection. No dimensions label.
- **D-05:** Smooth resize animation (200-300ms ease) when switching between viewport sizes.
- **D-06:** Dark background (#1a1a1a or similar) for the area surrounding the constrained site view. Matches the overall dark overlay aesthetic.
- **D-07:** Overlay continues to cover the full window area regardless of viewport size -- selection/toolbar/sidebar work normally over the dark background.
- **D-08:** Errors surface in both CLI terminal and in-window. Startup/process errors print to terminal. Runtime errors (dev server crash, connection lost) also show as overlay notifications.
- **D-09:** Non-critical errors show as auto-dismissing toast notifications. Critical errors (dev server crashed) show as persistent banners that stay until the issue is resolved or user dismisses.
- **D-10:** In-window error notifications use the dark overlay aesthetic: same dark bg, white text, rounded corners, with red/orange accent color for error state.
- **D-11:** Priority error scenario: dev server crash mid-session must trigger an in-window notification (currently only notifies in terminal per Phase 1 D-13).
- **D-12:** electron moves from devDependencies to dependencies. When users run `npm install -g claw-design`, electron's postinstall downloads the platform binary automatically.
- **D-13:** Full OSS metadata: `files` whitelist (dist/, LICENSE), `repository`, `keywords`, `homepage`, `author` fields added to package.json.
- **D-14:** Pre-flight checks at startup: verify electron binary exists, Claude Code CLI in PATH, Node version >= 20. Fast checks that catch common install issues before confusing errors.
- **D-15:** Full README.md: installation, usage, how it works, requirements. First thing users see on npm/GitHub.
- **D-16:** MIT license (LICENSE file).
- **D-17:** `clawdesign --version` shows just the version number (e.g., "0.1.0").
- **D-18:** Unified build: `npm run build` runs CLI build + electron-vite build. `prepublishOnly` hook calls build automatically.
- **D-19:** Package name: unscoped `claw-design`.
- **D-20:** No separate `clawdesign doctor` command -- pre-flight checks at startup are sufficient for v1.
- **D-21:** Branded splash screen while site loads: claw-design name centered on dark background with loading indicator and localhost URL. Transitions to site once ready.
- **D-22:** Toolbar icons have simple tooltips on hover showing what each button does. Helps discoverability.
- **D-23:** No first-run onboarding or tooltip tour. Users ran `clawdesign start` from terminal -- they know what they're doing.

### Claude's Discretion
- Error message style (structured vs conversational -- pick the right tone for each context)
- Visual consistency audit across all UI surfaces (toolbar, input bar, sidebar, notifications, splash) -- fix spacing, colors, opacity, border-radius inconsistencies
- Animation timing and easing details for viewport transitions and toast notifications
- Splash screen exact visual design (typography, spinner style, layout)
- Tooltip implementation approach and timing
- Toast notification position (top vs bottom), auto-dismiss duration
- Persistent error banner position and dismiss interaction
- How viewport constraint is implemented (siteView.setBounds vs CSS transform vs other)
- README content structure and depth

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ELEC-03 | User can switch between desktop, tablet, and mobile viewport sizes | Viewport switching via `View.setBounds()` on siteView, IPC channels `viewport:set`/`viewport:changed`, toolbar extension with 3 new buttons. Dark surround via `contentView.setBackgroundColor('#1a1a1a')`. Animation via requestAnimationFrame-driven bounds interpolation. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Platform:** Electron (BaseWindow + WebContentsView architecture)
- **Claude integration:** Spawns Claude Code CLI as subprocess
- **Distribution:** npm global install (`npm install -g claw-design`)
- **CLI spawns Electron** -- not the other way around
- **Security:** contextIsolation + sandbox + contextBridge (no nodeIntegration)
- **No .env.backup files ever** (global user directive)
- **GSD Workflow:** All edits through GSD commands
- **No Co-Authored-By lines in git commits** (from user memory)

## Standard Stack

### Core (No New Dependencies)

Phase 5 introduces zero new npm dependencies. All work uses existing stack:

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Electron `View.setBounds()` | ^36.x (built-in) | Viewport constraint | Already used for overlay/sidebar bounds. Same API for siteView constraint. |
| Electron `View.setBackgroundColor()` | ^36.x (built-in) | Dark surround | Set on `win.contentView` to fill area outside constrained siteView. |
| Electron IPC | ^36.x (built-in) | Viewport + toast channels | Extends existing ipcMain.handle/ipcRenderer.invoke pattern. |
| commander `.version()` | ^14.0.0 (existing) | --version flag | Already in dependencies, just need to wire `.version()` call. |
| picocolors | ^1.1.0 (existing) | CLI error formatting | Already used in `output.ts`. |

[VERIFIED: codebase inspection -- all APIs already in use in Phases 2-4]

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `setBounds()` animation via rAF | CSS transform on a wrapper div | Would require wrapping siteView content, doesn't actually resize the WebContentsView (DOM layout wouldn't change). setBounds is the correct Electron API. |
| Inline data URL for splash | Separate splash HTML file | Data URL avoids a file in the build output but limits CSS/HTML complexity. Separate file is cleaner for the splash content. |
| Custom toast system | electron-notification (npm) | External dependency for simple positioned HTML elements is overkill. Overlay renderer already renders positioned elements (input bar, selection rect). |

## Architecture Patterns

### Viewport Switching Architecture

**What:** siteView bounds are constrained to preset dimensions while window stays full size. Dark surround fills the gap.

**Implementation strategy:**

1. **State:** Track active viewport preset in `window.ts` closure (`'desktop' | 'tablet' | 'mobile'`).
2. **Bounds calculation:** In `syncBounds()`, when viewport is not desktop, compute centered siteView bounds within window content area. If window is smaller than preset, fill window (no constraint).
3. **Dark surround:** `win.contentView.setBackgroundColor('#1a1a1a')` -- set once at window creation. Visible when siteView doesn't fill the full contentView area. [VERIFIED: Electron docs -- `View.setBackgroundColor()` on contentView]
4. **Overlay stays full window:** overlayView bounds are always `{0, 0, winWidth, winHeight}` regardless of viewport preset. Only siteView shrinks. [VERIFIED: codebase -- `syncBounds()` already sets overlay to full window]
5. **Animation:** 250ms requestAnimationFrame interpolation from current to target siteView bounds. Not CSS -- this is Electron-level bounds animation since `setBounds()` is the mechanism.

**Key insight:** The dark surround is "free" -- it's just the contentView background color showing through where siteView doesn't cover. No extra View needed.

[VERIFIED: Electron docs -- BaseWindow.contentView is a View instance with `setBackgroundColor()`]

### Inactive Overlay Bounds Update

**Critical change:** The toolbar currently has 3 items (handle + 2 buttons). Phase 5 adds a divider + 3 viewport buttons = 6 items + divider.

Current inactive overlay calculation in `setOverlayInactive()`:
```
// 3 items * 36px + 2 gaps * 4px + padding 20px = 136px
const toolbarHeight = 136;
```

New calculation needed:
```
// handle(36) + btn(36) + btn(36) + divider(1 + 8 margin) + btn(36) + btn(36) + btn(36) + 5 gaps(4px each) + padding(20px)
// = 36*6 + 9 + 20 + 20 = 265px approximately
```

This affects `setOverlayInactive()` in `window.ts` and must be updated when viewport buttons are added.

[VERIFIED: codebase `window.ts` line 205 -- current hardcoded toolbarHeight = 136]

### Toast Notification Architecture

**What:** Toast notifications render as absolutely positioned HTML elements in the overlay renderer. Not a separate WebContentsView -- they live in the overlay alongside toolbar, selection rect, and input bar.

**Pattern:**
1. **Main process sends IPC** (`toast:show`, `toast:dismiss`) to overlay renderer when events occur (dev server crash, connection lost).
2. **Overlay renderer** creates/removes toast DOM elements, manages auto-dismiss timers, handles stacking.
3. **z-index 300** -- above input bar (200) and selection (100), below toolbar (9999) and tooltips (10000).

**Integration point for dev server crash (D-11):** Currently in `start.ts` line 209-212, the dev server exit handler logs to terminal. Phase 5 adds IPC to forward this event to the Electron main process, which then sends `toast:show` to the overlay.

**Challenge:** The CLI process (`start.ts`) detects the dev server crash, but the toast IPC goes from main process to overlay renderer. The CLI needs to communicate the crash to the Electron main process. Two approaches:
- **Option A:** Forward the crash event from CLI to Electron via IPC socket or environment variable.
- **Option B:** Monitor the dev server from within the Electron main process instead (more complex, duplicates CLI's job).
- **Option C (recommended):** The CLI's Electron child process's stdin/stdout pipe. CLI writes a JSON message to electron's stdin. Main process reads stdin for crash events.

Actually, a simpler approach: the Electron main process can detect the dev server crash by monitoring the site URL's availability (periodic fetch or `webContents` load failure events). When the siteView URL stops responding, the main process sends the toast. This is independent of the CLI process.

[ASSUMED: The specific CLI-to-Electron communication approach for dev server crash -- multiple valid approaches exist]

### Splash Screen Architecture

**What:** siteView shows a branded loading page before the user's localhost URL loads.

**Implementation (per UI-SPEC):** Load a local HTML file (or data URL) in siteView first. When the dev server URL is ready, navigate siteView to it. Transition: fade out splash via opacity, then `siteView.webContents.loadURL(url)`.

**Timing:**
1. Window opens -> siteView loads splash HTML (instant, local file)
2. Dev server becomes available (already detected by CLI before Electron spawns)
3. siteView navigates to localhost URL
4. `did-finish-load` event fires -> splash is replaced

**Simplification:** Since the CLI already waits for the dev server to be ready before spawning Electron (see `start.ts` Step 5 `waitForPort`), the splash screen duration is actually just the time Electron takes to load the localhost page. The splash may flash briefly or not at all if the site loads fast. Per D-21: "No minimum display time."

**electron-vite integration:** The splash HTML file needs to be part of the renderer build. Either:
- Add it as another entry in `electron.vite.config.ts` renderer rollupOptions input
- Or load it as a data URL via `siteView.webContents.loadURL('data:text/html,<html>...')` (avoids build config changes)

Data URL approach is simpler for a static splash with no external assets. [ASSUMED: data URL approach -- either approach works]

### Tooltip Architecture

**What:** Simple tooltips appear on hover over toolbar buttons, positioned to the left of the button.

**Implementation:** Pure CSS + minimal JS in the overlay renderer:
- Each toolbar button gets a `data-tooltip` attribute with the label text
- A single tooltip element is positioned absolutely on mouseenter, hidden on mouseleave
- 400ms hover delay via `setTimeout`, cancelled on mouseleave
- Hidden during active selection modes (check state machine mode)
- z-index 10000 (above toolbar at 9999)

No library needed. This is a ~40 line implementation.

[VERIFIED: UI-SPEC -- exact positioning, timing, and content specified]

### Pre-Flight Check Architecture

**What:** Run fast checks at startup before any async work.

**Implementation:** New `src/cli/utils/preflight.ts` module with three checks:
1. **Node version:** `process.version` >= 20 (semver compare)
2. **Electron binary:** `require('electron')` resolves to a valid path + file exists
3. **Claude Code:** Already exists in `claude.ts:isClaudeInstalled()`

These run synchronously at the top of `startCommand()`, before the existing Claude check.

[VERIFIED: codebase -- `start.ts` already has Claude check pattern at lines 23-30]

### npm Packaging Architecture

**What:** Restructure package.json for `npm install -g claw-design`.

**Changes needed:**
1. Move `electron` from `devDependencies` to `dependencies` (D-12)
2. Add `files` array: `["dist/", "out/", "LICENSE"]` (D-13) -- `dist/` for CLI, `out/` for electron-vite build output
3. Add metadata: `repository`, `keywords`, `homepage`, `author`
4. Add `prepublishOnly` script: `"npm run build"` (D-18)
5. Unified build script: `"build": "tsc -p tsconfig.cli.json && electron-vite build"` (D-18)

**Critical path for global install:**
```
npm install -g claw-design
-> electron postinstall downloads binary (~180MB)
-> bin field maps `clawdesign` -> `dist/cli/index.js`
-> user runs: clawdesign start
-> CLI runs electron-vite build then spawns electron
```

**Important:** The current `buildElectron()` in `electron.ts` calls `npx electron-vite build` at runtime (every `clawdesign start`). This is fine for development but for global install, the electron-vite build output should be included in the published package. Two approaches:
- **A (current):** Keep runtime build. Requires `electron-vite` as a production dependency. Adds startup latency.
- **B (recommended):** Pre-build via `prepublishOnly`. Include `out/` in `files`. Remove runtime `buildElectron()` call. electron-vite stays as devDependency.

Option B is cleaner: `prepublishOnly` ensures the package is always published with built output, and users don't pay the build cost at startup.

[VERIFIED: codebase -- `electron.ts:buildElectron()` currently runs `npx electron-vite build` at each startup]
[VERIFIED: npm docs -- `prepublishOnly` runs before `npm publish` and on `npm pack`]

### Recommended Project Structure Changes

```
src/
  cli/
    utils/
      preflight.ts        # NEW: Node version + Electron binary checks
      output.ts           # EXTEND: (minimal -- already has printError)
    commands/
      start.ts            # EXTEND: pre-flight checks, remove runtime buildElectron
    index.ts              # EXTEND: .version() already wired
  main/
    window.ts             # EXTEND: viewport state, setViewport(), animated bounds, dark surround
    ipc-handlers.ts       # EXTEND: viewport:set, toast:show, toast:dismiss channels
    index.ts              # EXTEND: dev server crash detection -> toast IPC
  preload/
    overlay.ts            # EXTEND: viewport + toast APIs
  renderer/
    overlay.html          # EXTEND: viewport buttons, divider in toolbar; tooltip container
    overlay.css           # EXTEND: viewport button styles, divider, toast styles, tooltip styles
    overlay.ts            # EXTEND: viewport button handlers, toast rendering, tooltip logic
    splash.html           # NEW: (or inline data URL -- no separate file)
LICENSE                   # NEW
README.md                 # NEW
```

### Anti-Patterns to Avoid

- **Do NOT create a new WebContentsView for toasts.** They belong in the overlay renderer. Adding a view increases IPC complexity and z-index management overhead.
- **Do NOT use CSS transforms for viewport constraint.** This would visually scale the site but not change DOM layout. The site needs to actually reflow at the target viewport width, which requires changing siteView's actual bounds.
- **Do NOT keep `electron-vite` as a production dependency.** Pre-build with `prepublishOnly` and include `out/` in the npm package.
- **Do NOT animate viewport with `win.setBounds(bounds, true)`.** The macOS `animate` parameter animates the window frame, not a child view's bounds. View-level animation must be done manually with requestAnimationFrame + `view.setBounds()`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Viewport bounds animation | Custom animation library | `requestAnimationFrame` + linear interpolation | Standard pattern, ~20 lines. No npm dep needed. |
| Toast auto-dismiss | Custom timer management | `setTimeout` + `clearTimeout` | Built-in, trivial. |
| Version output | Custom version reading | Commander `.version()` | Already wired, one line addition. |
| Electron binary path | Manual binary resolution | `require('electron')` returns the binary path | This is the official pattern -- electron npm package exports the path string. |
| Node version check | Manual semver parsing | `parseInt(process.versions.node.split('.')[0]) >= 20` | Major version check is sufficient; no semver library needed. |

## Common Pitfalls

### Pitfall 1: Viewport Bounds When Window Is Smaller Than Preset
**What goes wrong:** Setting siteView bounds larger than the window content area causes the view to extend outside visible area or causes layout issues.
**Why it happens:** Tablet (768x1024) and mobile (375x812) are portrait -- height exceeds typical window height. Desktop (1280x800) width exceeds most laptop window widths when not maximized.
**How to avoid:** Clamp viewport bounds to fit within window content area. If window is smaller than preset in either dimension, scale proportionally or just fill the window (per UI-SPEC: "When window is smaller than the viewport preset, siteView fills the window").
**Warning signs:** siteView content not visible, scroll bars appearing in the base window.

[VERIFIED: UI-SPEC section "Viewport Constraint Behavior" point 5]

### Pitfall 2: Overlay Inactive Bounds Not Updated for New Toolbar Size
**What goes wrong:** After adding viewport buttons, the inactive overlay (pill size) doesn't show all buttons because the hardcoded dimensions are still for the 3-item toolbar.
**Why it happens:** `setOverlayInactive()` in `window.ts` has hardcoded `toolbarWidth = 52` and `toolbarHeight = 136`. The new toolbar has 6 items + divider.
**How to avoid:** Update the dimension constants when adding viewport buttons. Calculate from: `items * 36px + gaps * 4px + divider(1+8) + padding(20px)`.
**Warning signs:** Viewport buttons cut off or not visible when overlay is inactive.

[VERIFIED: codebase `window.ts` lines 202-206]

### Pitfall 3: Dev Server Crash IPC Timing
**What goes wrong:** Dev server crashes but the in-window notification never appears because the IPC path isn't wired.
**Why it happens:** Currently dev server crash is only handled in the CLI process (`start.ts` line 209). The Electron main process doesn't know about it.
**How to avoid:** Wire the crash event from CLI to Electron main process. Simplest: have the main process detect the crash independently by listening for `siteView.webContents` navigation failures or implementing a periodic health check.
**Warning signs:** Dev server dies, user sees nothing in the Electron window, only terminal shows the message.

### Pitfall 4: Electron as Production Dependency Size
**What goes wrong:** Users are surprised by the ~180MB download when installing globally.
**Why it happens:** `electron` npm package downloads the platform-specific binary via postinstall script.
**How to avoid:** This is by design (per D-12). Document the size requirement clearly in README. Consider adding `engines` field to be explicit about platform support.
**Warning signs:** Users reporting slow install times. This is expected behavior.

### Pitfall 5: `files` Whitelist Missing Build Output
**What goes wrong:** `npm install -g claw-design` installs but `clawdesign start` fails because built files are missing.
**Why it happens:** `files` array in package.json doesn't include all necessary directories (e.g., missing `out/` for electron-vite output, missing `dist/` for CLI).
**How to avoid:** Test with `npm pack --dry-run` to verify included files, then test actual global install from the tarball: `npm install -g ./claw-design-0.1.0.tgz`.
**Warning signs:** "Cannot find module" errors after global install.

[CITED: npm docs -- `files` field determines what's included in the published tarball]

### Pitfall 6: requestAnimationFrame Not Available in Main Process
**What goes wrong:** Viewport animation code using `requestAnimationFrame` throws because it's a browser/renderer API, not available in Electron's main process (Node.js).
**Why it happens:** `requestAnimationFrame` is a DOM API. The main process runs Node.js, not Chromium.
**How to avoid:** Use `setInterval` or `setTimeout` with 16ms intervals (60fps) in the main process for bounds animation. Or use a manual timestamp loop: `const start = Date.now(); function step() { ... setTimeout(step, 16); }`.
**Warning signs:** `ReferenceError: requestAnimationFrame is not defined` at runtime.

[VERIFIED: Node.js does not have `requestAnimationFrame` -- it's a Web API only available in renderer processes]

### Pitfall 7: Splash Screen Blocks Site Load
**What goes wrong:** siteView shows splash but never transitions to the actual site because the navigation to localhost URL is never triggered or gets blocked.
**Why it happens:** Race condition between splash display and site readiness, or CSP blocking navigation.
**How to avoid:** Listen for `did-finish-load` or use a simple timeout-based approach. The CLI already ensures the dev server is ready before spawning Electron, so the site URL should be immediately loadable. Navigate directly after a brief splash display.
**Warning signs:** Splash screen stays visible indefinitely.

## Code Examples

### Viewport Bounds Calculation (Main Process)

```typescript
// Source: derived from existing syncBounds() pattern in window.ts
interface ViewportPreset {
  width: number;
  height: number;
}

const VIEWPORT_PRESETS: Record<string, ViewportPreset> = {
  desktop: { width: 1280, height: 800 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 375, height: 812 },
};

function computeSiteViewBounds(
  preset: string,
  windowWidth: number,
  windowHeight: number,
): { x: number; y: number; width: number; height: number } {
  if (preset === 'desktop') {
    // Desktop: fill window
    return { x: 0, y: 0, width: windowWidth, height: windowHeight };
  }

  const vp = VIEWPORT_PRESETS[preset];
  if (!vp) return { x: 0, y: 0, width: windowWidth, height: windowHeight };

  // If window is smaller than preset, fill window
  if (windowWidth <= vp.width && windowHeight <= vp.height) {
    return { x: 0, y: 0, width: windowWidth, height: windowHeight };
  }

  // Constrain and center
  const w = Math.min(vp.width, windowWidth);
  const h = Math.min(vp.height, windowHeight);
  const x = Math.round((windowWidth - w) / 2);
  const y = Math.round((windowHeight - h) / 2);

  return { x, y, width: w, height: h };
}
```

[VERIFIED: pattern matches existing `syncBounds()` in codebase]

### Animated setBounds (Main Process -- No rAF)

```typescript
// Source: custom implementation for Electron main process (no requestAnimationFrame)
function animateBounds(
  view: WebContentsView,
  from: Rectangle,
  to: Rectangle,
  durationMs: number,
): Promise<void> {
  return new Promise((resolve) => {
    const start = Date.now();

    function step(): void {
      const elapsed = Date.now() - start;
      const t = Math.min(elapsed / durationMs, 1);
      // ease-in-out
      const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

      const x = Math.round(from.x + (to.x - from.x) * ease);
      const y = Math.round(from.y + (to.y - from.y) * ease);
      const width = Math.round(from.width + (to.width - from.width) * ease);
      const height = Math.round(from.height + (to.height - from.height) * ease);

      view.setBounds({ x, y, width, height });

      if (t < 1) {
        setTimeout(step, 16); // ~60fps
      } else {
        resolve();
      }
    }

    step();
  });
}
```

[ASSUMED: ease-in-out curve formula -- standard CSS ease-in-out equivalent]

### Toast Rendering (Overlay Renderer)

```typescript
// Source: pattern derived from existing overlay.ts DOM construction
function showToast(data: {
  id: string;
  severity: 'info' | 'warning' | 'error';
  title?: string;
  message: string;
  persistent: boolean;
}): void {
  const container = document.getElementById('claw-toast-container')!;

  const toast = document.createElement('div');
  toast.className = `claw-toast claw-toast--${data.severity}`;
  toast.dataset.toastId = data.id;
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', data.persistent ? 'assertive' : 'polite');

  // Icon + content layout
  const icon = createToastIcon(data.severity); // inline SVG
  toast.appendChild(icon);

  const content = document.createElement('div');
  content.className = 'claw-toast__content';
  if (data.title) {
    const title = document.createElement('div');
    title.className = 'claw-toast__title';
    title.textContent = data.title;
    content.appendChild(title);
  }
  const msg = document.createElement('div');
  msg.className = 'claw-toast__message';
  msg.textContent = data.message;
  content.appendChild(msg);
  toast.appendChild(content);

  // Dismiss button for persistent
  if (data.persistent) {
    const dismissBtn = document.createElement('button');
    dismissBtn.className = 'claw-toast__dismiss';
    dismissBtn.textContent = 'Dismiss';
    dismissBtn.setAttribute('aria-label', 'Dismiss notification');
    dismissBtn.addEventListener('click', () => dismissToast(data.id));
    toast.appendChild(dismissBtn);
  }

  container.prepend(toast);

  // Entrance animation
  requestAnimationFrame(() => {
    toast.classList.add('claw-toast--visible');
  });

  // Auto-dismiss for non-persistent
  if (!data.persistent) {
    setTimeout(() => dismissToast(data.id), 5000);
    toast.addEventListener('click', () => dismissToast(data.id));
  }
}
```

[VERIFIED: pattern consistent with existing overlay.ts DOM construction and sidebar.ts task row creation]

### Pre-Flight Check

```typescript
// Source: extends existing pattern from claude.ts
export function checkNodeVersion(): { ok: boolean; version: string } {
  const major = parseInt(process.versions.node.split('.')[0], 10);
  return { ok: major >= 20, version: process.versions.node };
}

export function checkElectronBinary(): boolean {
  try {
    const { createRequire } = await import('node:module');
    const require = createRequire(import.meta.url);
    const electronPath = require('electron') as unknown as string;
    const { existsSync } = await import('node:fs');
    return existsSync(electronPath);
  } catch {
    return false;
  }
}
```

[VERIFIED: pattern matches existing `isClaudeInstalled()` in claude.ts and `spawnElectron()` in electron.ts]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| BrowserView for multi-view | WebContentsView (BaseWindow) | Electron v30+ (2024) | Already using correct API |
| `BrowserView.setBounds()` | `View.setBounds()` (inherited) | Electron v30+ | Same API, just different class hierarchy |
| `win.setBackgroundColor()` | `win.contentView.setBackgroundColor()` | BaseWindow pattern | contentView is the View that shows through gaps |
| Electron Forge for packaging | npm `bin` field (no native packaging) | Project decision | Simpler distribution for dev tools |

**Deprecated/outdated:**
- BrowserView: Deprecated since Electron v30. claw-design correctly uses WebContentsView. [VERIFIED: Electron docs]
- `nodeIntegration: true`: Security anti-pattern since Electron 12+. claw-design correctly uses contextBridge. [VERIFIED: codebase]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Data URL approach for splash screen is sufficient (vs separate HTML file) | Splash Screen Architecture | LOW -- either approach works, just different build config |
| A2 | CLI-to-Electron dev server crash communication via main process site monitoring | Toast Notification Architecture | MEDIUM -- if main process can't detect crash independently, need CLI->Electron IPC path |
| A3 | Pre-built output in `out/` should be published (vs runtime build) | npm Packaging Architecture | MEDIUM -- if runtime build is kept, electron-vite becomes a production dep and adds startup latency |
| A4 | Ease-in-out CSS equivalent curve formula is correct | Code Examples | LOW -- standard math, visual only |

## Open Questions (RESOLVED)

1. **How does the Electron main process learn about dev server crash?** (RESOLVED -- Plan 05-03, Task 2)
   - What we know: CLI detects it via `devServer.on('exit')`. Electron main process is a separate process.
   - What's unclear: Best IPC path from CLI to Electron for this event.
   - Recommendation: Have the main process independently detect site unavailability by listening to `siteView.webContents` events (`did-fail-load`, `-did-navigate-to-error-page`) or periodic polling. This decouples from CLI.
   - **Resolution:** Plan 05-03 Task 2 implements main process detection via `siteView.webContents.on('did-fail-load')` and `render-process-gone` events. No CLI-to-Electron IPC needed -- main process detects independently.

2. **Should electron-vite output be pre-built or built at runtime?** (RESOLVED -- Plan 05-05, Task 1)
   - What we know: Currently `buildElectron()` runs at every `clawdesign start`. For global install, this requires `electron-vite` as prod dep.
   - What's unclear: Whether pre-built output in the npm tarball works correctly across platforms.
   - Recommendation: Pre-build with `prepublishOnly`. electron-vite config is deterministic (no platform-specific output). Test with `npm pack` + install from tarball.
   - **Resolution:** Plan 05-05 Task 1 removes runtime `buildElectron()` from `start.ts`, adds `prepublishOnly: "npm run build"` to package.json, and includes pre-built `out/` in the `files` whitelist.

3. **What files should be in the `files` whitelist?** (RESOLVED -- Plan 05-05, Task 1)
   - What we know: Need `dist/cli/` (CLI entry), `out/` (electron-vite output), `LICENSE`.
   - What's unclear: Whether `package.json` `bin` resolution works correctly from global install path with these directories.
   - Recommendation: Test with `npm pack --dry-run` to verify, then `npm install -g` from tarball.
   - **Resolution:** Plan 05-05 Task 1 sets `"files": ["dist/", "out/", "LICENSE"]` in package.json. Validation via `tests/cli/package.test.ts` confirms the whitelist structure.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.0.0 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ELEC-03a | computeSiteViewBounds returns correct centered bounds for each preset | unit | `npx vitest run tests/main/viewport.test.ts -t "bounds"` | Wave 0 |
| ELEC-03b | Desktop preset fills window (no constraint) | unit | `npx vitest run tests/main/viewport.test.ts -t "desktop"` | Wave 0 |
| ELEC-03c | Window smaller than preset fills window | unit | `npx vitest run tests/main/viewport.test.ts -t "smaller"` | Wave 0 |
| ELEC-03d | animateBounds interpolates from start to end over duration | unit | `npx vitest run tests/main/viewport.test.ts -t "animate"` | Wave 0 |
| D-14a | checkNodeVersion returns correct ok/version | unit | `npx vitest run tests/cli/preflight.test.ts -t "node"` | Wave 0 |
| D-14b | checkElectronBinary detects missing binary | unit | `npx vitest run tests/cli/preflight.test.ts -t "electron"` | Wave 0 |
| D-09a | Toast auto-dismiss fires after 5000ms | unit | `npx vitest run tests/renderer/toast.test.ts -t "auto-dismiss"` | Wave 0 |
| D-17 | --version flag outputs version string | unit | `npx vitest run tests/cli/start.test.ts -t "version"` | Wave 0 |
| D-12/D-13 | package.json has correct files, deps, metadata | unit | `npx vitest run tests/cli/package.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/main/viewport.test.ts` -- covers ELEC-03 viewport bounds calculation and animation
- [ ] `tests/cli/preflight.test.ts` -- covers D-14 pre-flight checks
- [ ] `tests/renderer/toast.test.ts` -- covers D-09 toast rendering and auto-dismiss logic (if state machine extracted)
- [ ] `tests/cli/package.test.ts` -- covers D-12/D-13 package.json structure validation

*(Existing test infrastructure: 14 test files, 185 tests, all passing. Vitest config and patterns well established.)*

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | N/A (defers to Claude Code's auth) |
| V3 Session Management | no | N/A (local tool, no sessions) |
| V4 Access Control | no | N/A (single-user local tool) |
| V5 Input Validation | yes | Validate viewport preset values (whitelist: 'desktop', 'tablet', 'mobile'). Validate toast data from IPC (sanitize message text, prevent HTML injection in toast content). |
| V6 Cryptography | no | N/A |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Toast message injection | Tampering | Use `textContent` not `innerHTML` for all toast text. Already established pattern in sidebar.ts (safe SVG construction). |
| Viewport preset spoofing | Tampering | Whitelist validation in IPC handler -- only accept known preset strings. |
| Malicious preload API access | Spoofing | contextBridge already limits API surface. New viewport/toast APIs follow same pattern. |

## Sources

### Primary (HIGH confidence)
- Codebase inspection -- `src/main/window.ts`, `src/renderer/overlay.ts`, `src/renderer/overlay.css`, `src/main/ipc-handlers.ts`, `src/preload/overlay.ts`, `src/cli/commands/start.ts`, `src/cli/utils/output.ts`, `src/cli/index.ts`, `package.json`, `electron.vite.config.ts`
- [Electron BaseWindow API](https://www.electronjs.org/docs/latest/api/base-window) -- contentView property, setBounds with animate parameter, getContentBounds
- [Electron View API](https://www.electronjs.org/docs/latest/api/view) -- setBounds, setBackgroundColor, getBounds signatures
- [Electron WebContentsView API](https://www.electronjs.org/docs/latest/api/web-contents-view) -- inherits from View
- [npm package.json docs](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/) -- files field, bin field, prepublishOnly lifecycle

### Secondary (MEDIUM confidence)
- [Electron WebContentsView transparency issue #45104](https://github.com/electron/electron/issues/45104) -- confirmed setBackgroundColor on contentView for surround color
- Phase 5 UI-SPEC (`05-UI-SPEC.md`) -- complete visual and interaction contract

### Tertiary (LOW confidence)
- None -- all claims verified against codebase or official docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- zero new dependencies, all APIs already proven in codebase
- Architecture: HIGH -- extends existing patterns (syncBounds, IPC handlers, overlay rendering)
- Pitfalls: HIGH -- identified from codebase inspection (hardcoded dimensions, missing rAF in main process, IPC path gaps)
- npm packaging: MEDIUM -- `prepublishOnly` + `files` approach needs validation with actual `npm pack`

**Research date:** 2026-04-06
**Valid until:** 2026-05-06 (stable -- Electron 36 is current, no API changes expected)
