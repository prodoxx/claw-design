---
phase: 02-electron-shell
plan: 02
subsystem: electron
tags: [electron, basewindow, webcontentsview, ipc, navigation, security]

# Dependency graph
requires:
  - phase: 02-electron-shell/01
    provides: "Preload script, overlay HTML/CSS/JS, electron-vite multi-entry config"
provides:
  - "BaseWindow factory with dual WebContentsView (site + overlay)"
  - "Navigation restriction (external URLs to system browser)"
  - "IPC handler scaffold for overlay activation/deactivation"
  - "Main process entry point wiring all components"
  - "Overlay bounds toggle (inactive=48x48, active=full window)"
affects: [03-selection-overlay, 04-claude-integration]

# Tech tracking
tech-stack:
  added: []
  patterns: [BaseWindow + dual WebContentsView, overlay bounds toggle for mouse passthrough, vi.fn constructor mocking for Electron]

key-files:
  created:
    - src/main/window.ts
    - src/main/navigation.ts
    - src/main/ipc-handlers.ts
    - tests/main/window.test.ts
    - tests/main/navigation.test.ts
  modified:
    - src/main/index.ts

key-decisions:
  - "Overlay bounds toggle pattern for mouse passthrough (shrink to 48x48 when inactive, expand to full window when active)"
  - "Environment variables (CLAW_URL, CLAW_PROJECT_NAME) for CLI-to-Electron handshake"

patterns-established:
  - "Electron mock pattern: vi.fn with function body for constructors (BaseWindow, WebContentsView)"
  - "Overlay bounds toggle: setOverlayInactive/setOverlayActive via setBounds, not CSS pointer-events"

requirements-completed: [ELEC-01, ELEC-02]

# Metrics
duration: 3min
completed: 2026-04-04
---

# Phase 02 Plan 02: Electron Main Process Summary

**BaseWindow with dual WebContentsViews (secure site + transparent overlay), navigation restriction to localhost, and IPC overlay activation scaffold**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-03T17:06:29Z
- **Completed:** 2026-04-03T17:09:44Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- BaseWindow factory creates 1280x800 centered window with site view (sandbox, contextIsolation) and transparent overlay view stacked on top
- Navigation restriction redirects external URLs to system browser via will-navigate and setWindowOpenHandler
- Overlay bounds toggle: inactive mode shrinks to 48x48 indicator area, active mode expands to full window for selection
- IPC handlers scaffold overlay:activate-selection and overlay:deactivate-selection channels
- 22 unit tests covering window creation, security config, overlay transparency, bounds toggle, and navigation restriction

## Task Commits

Each task was committed atomically:

1. **Task 1: Window management module with dual WebContentsView** - `7f636ca` (feat)
2. **Task 2: Electron main process entry + unit tests** - `4cfd84b` (test)

## Files Created/Modified
- `src/main/window.ts` - BaseWindow factory with dual WebContentsView, setOverlayInactive/Active, WindowComponents type
- `src/main/navigation.ts` - will-navigate + setWindowOpenHandler, external URLs to shell.openExternal
- `src/main/ipc-handlers.ts` - ipcMain.handle for overlay:activate-selection and overlay:deactivate-selection
- `src/main/index.ts` - Main process entry: reads env vars, creates window, sets up navigation and IPC
- `tests/main/window.test.ts` - 14 tests: BaseWindow config, WebContentsView security, overlay transparency, bounds sync
- `tests/main/navigation.test.ts` - 8 tests: localhost allowed, external URLs redirected, deny window.open, malformed URL safety

## Decisions Made
- Used environment variables (CLAW_URL, CLAW_PROJECT_NAME) for CLI-to-Electron communication rather than command-line args or IPC socket -- simplest approach for initial handshake
- Overlay bounds toggle pattern: shrink overlay to 48x48 bottom-right when inactive, expand to full window when active -- only viable approach since setIgnoreMouseEvents does not exist on WebContentsView

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Electron constructor mocking in Vitest**
- **Found during:** Task 2 (unit tests)
- **Issue:** `vi.fn().mockImplementation(() => {...})` creates arrow functions which cannot be used as constructors with `new`. The source code uses `new BaseWindow(...)` and `new WebContentsView(...)`.
- **Fix:** Changed mock to `vi.fn(function (this) { ... })` which creates proper constructor functions with `[[Construct]]` internal method.
- **Files modified:** tests/main/window.test.ts
- **Verification:** All 22 tests pass
- **Committed in:** 4cfd84b (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary for tests to work with Electron's class-based API. No scope creep.

## Issues Encountered
None beyond the mock constructor fix documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Window architecture complete: BaseWindow + dual WebContentsView with security isolation
- Overlay activation/deactivation IPC channels ready for Phase 3 selection overlay
- Navigation restriction in place for safe browsing
- 78 total tests pass (Phase 1 + Phase 2)

## Self-Check: PASSED

All 6 created files verified on disk. Both commit hashes (7f636ca, 4cfd84b) found in git log.

---
*Phase: 02-electron-shell*
*Completed: 2026-04-04*
