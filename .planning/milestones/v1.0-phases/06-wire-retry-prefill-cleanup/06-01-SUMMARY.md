---
phase: 06-wire-retry-prefill-cleanup
plan: 01
subsystem: ipc
tags: [electron-ipc, overlay, retry-prefill, state-machine]

# Dependency graph
requires:
  - phase: 04-agent-sidebar
    provides: sidebar:task-retry IPC channel, AgentManager.getTask/dismissTask, overlay:prefill-instruction preload bridge
provides:
  - Retry-prefill IPC flow that sends original instruction to overlay textarea
  - Overlay prefill handler that activates surface, enters rect-idle, shows input bar
affects: [06-02-dead-code-cleanup]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Prefill handler inlines input bar positioning instead of calling showInputBar() to avoid textarea value reset"

key-files:
  created: []
  modified:
    - src/main/ipc-handlers.ts
    - src/renderer/overlay.ts

key-decisions:
  - "Dismiss error task immediately on retry (instruction preserved in prefilled textarea)"
  - "Enter rect-idle mode as default after prefill (more general than elem-idle)"
  - "Inline input bar positioning in prefill handler to avoid showInputBar() which resets textarea.value"

patterns-established:
  - "Prefill-then-activate pattern: set textarea value before activating overlay surface and dispatching state machine events"

requirements-completed: []

# Metrics
duration: 2min
completed: 2026-04-07
---

# Phase 6 Plan 01: Retry-Prefill Flow Summary

**Rewired sidebar retry to prefill overlay textarea with original instruction and activate selection mode instead of silently auto-resubmitting**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-07T06:55:07Z
- **Completed:** 2026-04-07T06:57:06Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Replaced sidebar:task-retry handler to read original instruction, dismiss error task, send prefill IPC, and activate overlay for re-selection
- Enhanced overlay prefill handler to activate surface (body class + toolbar pin), enter rect-idle via state machine, show input bar at default centered position, and focus textarea
- Removed agentManager.retryTask() usage from IPC handlers (user now re-submits manually through normal overlay flow)

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite sidebar:task-retry IPC handler** - `c702270` (feat)
2. **Task 2: Enhance overlay prefill handler** - `f291c90` (feat)

## Files Created/Modified
- `src/main/ipc-handlers.ts` - Rewrote sidebar:task-retry handler to send overlay:prefill-instruction IPC and activate overlay instead of calling agentManager.retryTask()
- `src/renderer/overlay.ts` - Enhanced onPrefillInstruction handler to call activateOverlaySurface(), dispatch ACTIVATE_RECT, show input bar at default position (centered at 60% height), and focus textarea

## Decisions Made
- Dismiss error task immediately on retry click -- the instruction text is preserved in the prefilled textarea, so the user can see and edit it. If they cancel (Escape), the task is gone but this is acceptable for v1.0.
- Enter rect-idle mode (not elem-idle) as the default after prefill -- rect-idle is the more general selection mode and the user can switch to element mode via the toolbar.
- Inline input bar positioning in the prefill handler rather than calling showInputBar(bounds) -- showInputBar() resets textarea.value to empty string (line 513), which would destroy the prefilled instruction.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Retry-prefill flow is fully wired end-to-end
- Plan 02 (dead code cleanup) can proceed independently
- All 234 existing tests pass, build succeeds

## Self-Check: PASSED

- [x] src/main/ipc-handlers.ts exists
- [x] src/renderer/overlay.ts exists
- [x] 06-01-SUMMARY.md exists
- [x] Commit c702270 exists (Task 1)
- [x] Commit f291c90 exists (Task 2)
- [x] All 234 tests pass
- [x] Build succeeds

---
*Phase: 06-wire-retry-prefill-cleanup*
*Completed: 2026-04-07*
