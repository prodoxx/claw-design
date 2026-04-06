---
phase: 05-polish-distribution
plan: 01
subsystem: viewport-switching
tags: [electron, viewport, ipc, animation, toolbar]
dependency_graph:
  requires: []
  provides: [viewport-presets, viewport-ipc, viewport-toolbar-buttons]
  affects: [window-bounds, overlay-toolbar, toolbar-height]
tech_stack:
  added: []
  patterns: [setTimeout-animation, viewport-centering, ipc-whitelist-validation]
key_files:
  created:
    - tests/main/viewport.test.ts
  modified:
    - src/main/window.ts
    - src/main/ipc-handlers.ts
    - src/preload/overlay.ts
    - src/renderer/overlay.html
    - src/renderer/overlay.css
    - src/renderer/overlay.ts
    - tests/main/window.test.ts
decisions:
  - "Math.round for centering (453px not 452px for mobile at 1280w) -- correct rounding"
  - "setTimeout animation loop instead of requestAnimationFrame -- main process has no rAF (Pitfall 6)"
  - "Toolbar height 265px for 6-item toolbar (handle + 2 select + divider + 3 viewport)"
metrics:
  duration: 5min
  completed: "2026-04-06T04:51:00Z"
  tasks: 2
  files: 8
---

# Phase 05 Plan 01: Viewport Switching Summary

Viewport preset switching with desktop/tablet/mobile presets, bounds computation with centering, animation via setTimeout, IPC wiring with whitelist validation, and toolbar UI with active state management.

## What Was Built

### Task 1: Viewport bounds computation, animation, and IPC wiring (TDD)

**RED:** Created `tests/main/viewport.test.ts` with 14 test cases covering VIEWPORT_PRESETS structure, computeSiteViewBounds centering/clamping/fallback logic, and animateBounds multi-step/final-bounds/promise-resolution behavior.

**GREEN:** Implemented in `src/main/window.ts`:
- `VIEWPORT_PRESETS` constant with desktop (1280x800), tablet (768x1024), mobile (375x812)
- `computeSiteViewBounds()` -- pure function that centers preset within window, clamps to window bounds, falls back to desktop for unknown presets
- `animateBounds()` -- setTimeout-based animation with ease-in-out curve (no rAF in main process)
- `setViewport`/`getViewport` on WindowComponents interface
- Dark surround background (`#1a1a1a`) on `win.contentView`
- Viewport-aware `syncBounds()` using `computeSiteViewBounds(currentViewport, ...)`
- Updated toolbar height from 136px to 265px for 6-item toolbar

Wired IPC in `src/main/ipc-handlers.ts`:
- `viewport:set` handler with whitelist validation against `['desktop', 'tablet', 'mobile']` (T-05-02 mitigation)

Extended preload in `src/preload/overlay.ts`:
- `setViewport(preset)` and `onViewportChanged(callback)` APIs

### Task 2: Viewport toolbar buttons, styles, and active state

Extended `src/renderer/overlay.html`:
- 3 viewport buttons (desktop/tablet/mobile) with SVG icons
- Toolbar divider separating selection and viewport groups

Added to `src/renderer/overlay.css`:
- `.claw-toolbar-divider` (1px height, 24px width, rgba(255,255,255,0.1))

Added to `src/renderer/overlay.ts`:
- Viewport button click handlers calling `window.claw.setViewport(preset)`
- Active state management with `claw-toolbar-btn--active` class
- IPC listener for `viewport:changed` to sync state from main process

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated window.test.ts mock for contentView.setBackgroundColor**
- **Found during:** Task 1 GREEN phase
- **Issue:** Adding `win.contentView.setBackgroundColor('#1a1a1a')` broke existing window tests because the mock `contentView` object lacked this method
- **Fix:** Added `setBackgroundColor: vi.fn()` to `createMockContentView()` and `getBounds: vi.fn()` to `createMockWebContentsView()`
- **Files modified:** tests/main/window.test.ts
- **Commit:** f89ceab

**2. [Rule 1 - Bug] Corrected mobile centering calculation in test**
- **Found during:** Task 1 RED phase
- **Issue:** Plan specified x=452 for mobile at 1280w, but Math.round((1280-375)/2) = Math.round(452.5) = 453
- **Fix:** Used correct value 453 in test, matching the Math.round behavior specified in the implementation
- **Files modified:** tests/main/viewport.test.ts
- **Commit:** c459a7d

**3. [Rule 3 - Blocking] Updated setOverlayInactive test expectations for new toolbar height**
- **Found during:** Task 1 GREEN phase
- **Issue:** Changing toolbarHeight from 136 to 265 invalidated the setOverlayInactive test expectations
- **Fix:** Updated expected y from 648 to 519 and height from 152 to 281 in window.test.ts
- **Files modified:** tests/main/window.test.ts
- **Commit:** f89ceab

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 (RED) | c459a7d | test(05-01): add failing tests for viewport bounds computation and animation |
| 1 (GREEN) | f89ceab | feat(05-01): viewport bounds computation, animation, and IPC wiring |
| 2 | 25a7692 | feat(05-01): viewport toolbar buttons, styles, and active state in overlay renderer |

## Verification Results

1. `npx vitest run tests/main/viewport.test.ts` -- 14/14 passed
2. `npx vitest run` -- 185/185 passed (8 pre-existing failures in start.test.ts excluded)
3. `VIEWPORT_PRESETS` exported from window.ts -- confirmed
4. `viewport:set` IPC handler in ipc-handlers.ts -- confirmed
5. `claw-viewport-desktop-btn` in overlay.html -- confirmed
6. `claw-toolbar-divider` in overlay.css -- confirmed

## Known Stubs

None -- all viewport functionality is fully wired end-to-end.

## Threat Flags

None -- the viewport:set IPC handler validates preset against a whitelist per T-05-02.
