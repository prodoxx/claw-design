---
phase: 03-selection-overlay-capture
plan: 02
subsystem: capture
tags: [electron, capturePage, NativeImage, DPI, executeJavaScript, DOM, screenshot, IPC]

# Dependency graph
requires:
  - phase: 03-01
    provides: overlay selection state machine, IPC handler scaffold, get-element-at-point handler
  - phase: 02-electron-shell
    provides: WindowComponents (BaseWindow + siteView + overlayView), overlay preload, IPC handler registration
provides:
  - captureRegion function for DPI-aware screenshot capture via capturePage + NativeImage.toPNG
  - buildDomExtractionScript function for extracting visible DOM elements as serialized JSON
  - CSSRect, ExtractedElement, DomExtractionResult type definitions
  - overlay:capture-screenshot IPC handler
  - overlay:extract-dom IPC handler
affects: [04-claude-integration, 03-03]

# Tech tracking
tech-stack:
  added: []
  patterns: [pure-function-extraction for testability, IIFE-injected-scripts for executeJavaScript, var-style JS for max site compatibility]

key-files:
  created:
    - src/main/capture.ts
    - src/main/dom-extract.ts
    - tests/main/capture.test.ts
    - tests/main/dom-extract.test.ts
  modified:
    - src/main/ipc-handlers.ts

key-decisions:
  - "computeDeviceRect extracted as pure function for testable DPI math without Electron mocks"
  - "DOM extraction script uses var and old-style functions (not const/let/arrow) for maximum site compatibility"
  - "IIFE pattern wraps injected JS to prevent variable leaks into user site scope"

patterns-established:
  - "Pure function extraction: isolate DPI scaling logic into computeDeviceRect for testing without Electron"
  - "IIFE injection pattern: executeJavaScript scripts wrapped in (function(){...})() to avoid polluting user site scope"
  - "Script builder pattern: buildDomExtractionScript returns a string, not a function, enabling script-content unit tests without a browser environment"

requirements-completed: [CAP-01, CAP-02, CAP-03]

# Metrics
duration: 4min
completed: 2026-04-04
---

# Phase 3 Plan 2: Capture Pipeline Summary

**DPI-aware screenshot capture and DOM extraction modules with IPC handlers -- PNG buffer via capturePage and structured JSON via executeJavaScript IIFE injection**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-04T04:52:15Z
- **Completed:** 2026-04-04T04:56:20Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- captureRegion applies screen.getPrimaryDisplay().scaleFactor to CSS pixel coordinates before capturePage, returns PNG Buffer per Key Decision #3
- buildDomExtractionScript generates a self-contained IIFE that queries visible elements overlapping the selection rect, serializes to JSON with tag/classes/id/text/bounds/path per Key Decision #4
- Two new IPC handlers (overlay:capture-screenshot, overlay:extract-dom) wired into registerIpcHandlers
- 23 new tests (11 capture + 12 DOM extraction) all passing, full suite at 133 total tests with zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Screenshot capture module with DPI scaling** - `ad8b5cd` (feat)
2. **Task 2: DOM extraction module and capture IPC handlers** - `69ae1a4` (feat)

_Both tasks followed TDD: RED (failing tests) -> GREEN (implementation passes) -> commit_

## Files Created/Modified
- `src/main/capture.ts` - CSSRect type, computeDeviceRect pure function, captureRegion async function
- `src/main/dom-extract.ts` - ExtractedElement/DomExtractionResult types, buildDomExtractionScript function
- `src/main/ipc-handlers.ts` - Added overlay:capture-screenshot and overlay:extract-dom handlers with imports
- `tests/main/capture.test.ts` - 11 tests covering computeDeviceRect (scaleFactor 1/2/1.5, zero, large) and captureRegion integration
- `tests/main/dom-extract.test.ts` - 12 tests covering script output structure, content assertions, and edge cases

## Decisions Made
- computeDeviceRect extracted as a pure function separate from captureRegion, enabling scaleFactor math testing without any Electron mocks
- DOM extraction script uses `var` and `function(){}` syntax (not const/let/arrow functions) to maximize compatibility with any user site's JavaScript engine mode
- IIFE pattern ensures no variable leaks into user site scope from injected scripts
- Script builder returns a string (not a function), enabling content-based unit tests that verify the script contains expected patterns (querySelectorAll, getComputedStyle, getElementPath, etc.) without needing a browser runtime

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all functions are fully implemented with real logic, no placeholders.

## Next Phase Readiness
- Capture pipeline complete: captureRegion and buildDomExtractionScript ready for Phase 4 Claude integration
- IPC channels registered: renderer can invoke overlay:capture-screenshot and overlay:extract-dom
- Plan 03-03 (instruction input UI) can proceed -- it will use these IPC channels after user submits instruction text

## Self-Check: PASSED

All 5 created/modified files verified on disk. Both task commits (ad8b5cd, 69ae1a4) verified in git log.

---
*Phase: 03-selection-overlay-capture*
*Completed: 2026-04-04*
