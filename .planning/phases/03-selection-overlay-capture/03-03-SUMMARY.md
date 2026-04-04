---
phase: 03-selection-overlay-capture
plan: 03
subsystem: ui
tags: [electron, ipc, overlay, textarea, capture]

requires:
  - phase: 03-01
    provides: Selection state machine, toolbar buttons, preload API, element detection IPC
  - phase: 03-02
    provides: captureRegion, buildDomExtractionScript, capture/extract IPC handlers
provides:
  - Instruction input bar with smart positioning near selection
  - Submit flow: parallel screenshot capture + DOM extraction + IPC to main
  - Post-submit cleanup returning overlay to inactive
  - Complete Phase 3 interaction loop (select → type → submit → reset)
affects: [04-claude-code-integration]

tech-stack:
  added: []
  patterns:
    - "Preload CJS format for Electron compatibility"
    - "Overlay active state tracking for resize-safe bounds"
    - "Near-invisible background for transparent view hit-testing"

key-files:
  created: []
  modified:
    - src/renderer/overlay.ts
    - src/renderer/overlay.html
    - src/renderer/overlay.css
    - src/preload/overlay.ts
    - src/main/ipc-handlers.ts
    - src/main/window.ts
    - src/cli/utils/electron.ts
    - electron.vite.config.ts

key-decisions:
  - "Preload must build as CJS (not ESM) — Electron preload rejects import statements"
  - "Overlay active state flag tracked in window.ts so resize handler preserves expanded bounds"
  - "rgba(0,0,0,0.01) background on active overlay — Chromium skips hit-testing on fully transparent surfaces"
  - "Await activateSelection() IPC before dispatching state change — prevents drawing before overlay expands"
  - "Forward Electron stdout/stderr to CLI terminal for log visibility"

patterns-established:
  - "Preload CJS output: electron-vite preload config must use format: 'cjs'"
  - "Overlay state tracking: setOverlayIsActive(bool) syncs bounds intent with resize handler"

requirements-completed: [INST-01, INST-02, INST-03]

duration: 45min
completed: 2026-04-04
---

# Plan 03-03: Instruction Input Bar Summary

**Smart-positioned instruction input bar with parallel capture+DOM submit flow, verified end-to-end with preload CJS fix**

## Performance

- **Duration:** ~45 min (including verification debugging)
- **Tasks:** 2 (1 auto + 1 human-verify checkpoint)
- **Files modified:** 8

## Accomplishments
- Instruction input bar appears near selection with smart positioning (below preferred, above if <80px space)
- Auto-expanding textarea (up to 160px), Enter submits, Shift+Enter newline
- Submit triggers parallel screenshot capture + DOM extraction via IPC, sends to main process
- Post-submit cleanup: input bar hides, selection clears, overlay returns to inactive
- Fixed critical preload loading issue (ESM→CJS) that prevented all overlay IPC from working
- Fixed overlay bounds tracking so selection covers full window
- Added toolbar button tooltips

## Task Commits

1. **Task 1: Input bar HTML, CSS, preload API, and submit flow** - `ffa41c3` (feat)
2. **Task 2: Visual verification** - `2aea988` (fix — preload CJS, overlay bounds, toolbar sizing, tooltips)

## Files Created/Modified
- `src/renderer/overlay.ts` — Input bar show/hide/position, auto-expand textarea, submit handler
- `src/renderer/overlay.html` — Input bar structure (textarea + submit button + keyboard hint)
- `src/renderer/overlay.css` — Input bar styles + active overlay hit-testing background
- `src/preload/overlay.ts` — captureScreenshot, extractDom, submitInstruction IPC methods
- `src/main/ipc-handlers.ts` — overlay:submit-instruction handler
- `src/main/window.ts` — Overlay active state tracking, toolbar height fix (96→136px)
- `src/cli/utils/electron.ts` — Forward Electron stdout/stderr to CLI terminal
- `electron.vite.config.ts` — Preload output format: CJS

## Decisions Made
- Preload scripts must use CJS format — Electron rejects ESM import statements in preload context
- Overlay needs active state flag — resize handler was unconditionally shrinking overlay
- Near-invisible background (0.01 alpha) needed for Chromium hit-testing on transparent views
- Must await IPC activation before state dispatch to prevent drawing in unexpanded overlay

## Deviations from Plan

### Auto-fixed Issues

**1. Preload ESM→CJS format**
- **Found during:** Task 2 (human verification)
- **Issue:** Preload built as .mjs with import statements; Electron preload requires CommonJS
- **Fix:** Added `output: { format: 'cjs' }` to electron-vite preload config, updated path reference
- **Files modified:** electron.vite.config.ts, src/main/window.ts
- **Verification:** Preload loads successfully, IPC handlers fire

**2. Overlay bounds not expanding**
- **Found during:** Task 2 (human verification)
- **Issue:** Overlay view stayed at inactive bounds because: (a) preload wasn't loading so IPC never fired, (b) resize handler unconditionally called setOverlayInactive
- **Fix:** Fixed preload loading (above), added overlayIsActive state tracking
- **Files modified:** src/main/window.ts, src/main/ipc-handlers.ts

**3. Toolbar clipped at top**
- **Found during:** Task 2 (human verification)
- **Issue:** toolbarHeight=96 but toolbar needs 136px (3×36 items + 2×4 gaps + 20 padding)
- **Fix:** Updated toolbarHeight to 136
- **Files modified:** src/main/window.ts

**4. Electron logs invisible**
- **Found during:** Task 2 (human verification)
- **Issue:** Electron process stdio piped but never forwarded to CLI terminal
- **Fix:** Forward stdout/stderr from Electron child process
- **Files modified:** src/cli/utils/electron.ts

---

**Total deviations:** 4 auto-fixed (1 blocking build config, 1 blocking bounds, 1 visual, 1 DX)
**Impact on plan:** All fixes necessary for correct functionality. No scope creep.

## Issues Encountered
- Preload ESM incompatibility was the root cause of all IPC failures — took 3 debugging rounds to identify

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Complete selection → instruction → capture pipeline ready for Phase 4
- Phase 4 will receive: instruction text, PNG screenshot buffer, DOM extraction JSON, selection bounds
- overlay:submit-instruction IPC handler currently logs payload — Phase 4 replaces with Claude Code integration

---
*Phase: 03-selection-overlay-capture*
*Completed: 2026-04-04*
