---
phase: 06-wire-retry-prefill-cleanup
verified: 2026-04-07T14:01:30Z
status: human_needed
score: 3/4 must-haves verified
human_verification:
  - test: "Launch app, submit a task that errors, click Retry in sidebar"
    expected: "Overlay activates with the original instruction prefilled in the textarea at a centered position (50% horizontal, 60% height). User can immediately edit the text and draw a new selection to re-submit."
    why_human: "Requires running Electron with a real dev server and triggering a task error. State machine visual state (rect-idle crosshair cursor, overlay surface active) cannot be confirmed programmatically."
  - test: "After prefill, draw a selection, edit the instruction, click Submit"
    expected: "A new task is created with the modified instruction. The original error task is gone from the sidebar."
    why_human: "End-to-end submit path requires a running Claude Code subprocess and real IPC roundtrip."
  - test: "After prefill, press Escape"
    expected: "Overlay deactivates. Prefilled instruction is discarded (this is the documented acceptable behavior for v1.0)."
    why_human: "Requires visual confirmation that the overlay surface deactivates and sidebar is restored correctly."
---

# Phase 6: Wire Retry-Prefill + Cleanup Verification Report

**Phase Goal:** Complete the retry-prefill-resubmit UX path and remove accumulated dead code from earlier phases
**Verified:** 2026-04-07T14:01:30Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Sidebar retry action sends `overlay:prefill-instruction` IPC to populate the overlay textarea with the previous instruction | VERIFIED | `ipc-handlers.ts` line 181: `components.overlayView.webContents.send('overlay:prefill-instruction', { instruction })` inside `sidebar:task-retry` handler. `retryTask()` not called (0 grep matches). |
| 2 | User can edit the prefilled instruction before re-submitting | VERIFIED (partial — human needed for UX) | `overlay.ts` lines 691-694: `ta.value = data.instruction`, then `ta.dispatchEvent(new Event('input'))` enables submit button. `ta.focus()` at line 715 gives keyboard focus. State machine enters `rect-idle` (line 700) so user must draw a new selection before submit fires. Programmatic correctness confirmed; full UX requires human. |
| 3 | Dead code removed: `buildElectron` export, `CLAW_CWD` env var, stub `preload/index.ts`, placeholder `renderer/index.html` | VERIFIED | All four items confirmed absent: 0 matches for `buildElectron` in `src/` and `tests/`; 0 matches for `CLAW_CWD` in `src/` and `tests/`; `src/preload/index.ts` does not exist; `src/renderer/index.html` does not exist. |
| 4 | Retry-prefill-resubmit full UX path works end-to-end | NEEDS HUMAN | Code is wired correctly. Manual test required: error task -> Retry -> overlay activates with prefilled text -> edit -> new selection -> submit creates new task. |

**Score:** 3/4 truths verified (4th requires human testing)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/main/ipc-handlers.ts` | Modified retry handler sends prefill IPC instead of auto-resubmitting | VERIFIED | Lines 165-190: reads `task.instruction`, dismisses task, sends `overlay:prefill-instruction`, calls `setOverlayActive`, sends `overlay:mode-change`. No `retryTask()` call. |
| `src/renderer/overlay.ts` | Enhanced prefill handler activates overlay, enters rect-idle, shows input bar | VERIFIED | Lines 684-718: calls `activateOverlaySurface()` (line 697), dispatches `{ type: 'ACTIVATE_RECT' }` (line 700), shows input bar at 60% height (lines 703-711), focuses textarea (line 715). |
| `src/cli/utils/electron.ts` | Only `spawnElectron` export (buildElectron removed, CLAW_CWD removed) | VERIFIED | File is 41 lines. Only import is `spawn` from `node:child_process`. `export function spawnElectron` present. `CLAW_PROJECT_DIR` present. No `buildElectron`, no `CLAW_CWD`, no `execFileSync`. |
| `electron.vite.config.ts` | Preload input has only overlay and sidebar entries (index removed) | VERIFIED | Lines 15-18: `{ overlay: ..., sidebar: ... }`. No `index:` entry. Build produces `out/preload/overlay.cjs` and `out/preload/sidebar.cjs` only. |
| `tests/cli/electron.test.ts` | Updated tests without buildElectron block and CLAW_CWD assertion | VERIFIED | File imports only `spawnElectron`. Single `describe('spawnElectron')` block. `CLAW_PROJECT_DIR` assertion at line 67-71. No `buildElectron`, no `CLAW_CWD`, no `mockExecFileSync`. |
| `src/preload/index.ts` | File deleted | VERIFIED | `test -f src/preload/index.ts` returns false. |
| `src/renderer/index.html` | File deleted | VERIFIED | `test -f src/renderer/index.html` returns false. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/main/ipc-handlers.ts` | `overlay:prefill-instruction` IPC channel | `components.overlayView.webContents.send` | WIRED | Line 181: `components.overlayView.webContents.send('overlay:prefill-instruction', { instruction })` |
| `src/main/ipc-handlers.ts` | `setOverlayActive` | import from `window.js` | WIRED | Imported at line 3; called at line 186 inside the retry handler |
| `src/renderer/overlay.ts` | state machine dispatch | `dispatch({ type: 'ACTIVATE_RECT' })` | WIRED | Line 700 inside `onPrefillInstruction` callback |
| `electron.vite.config.ts` | `out/preload/overlay.cjs` and `out/preload/sidebar.cjs` | electron-vite build | WIRED | Build confirmed: only `overlay.cjs` and `sidebar.cjs` in `out/preload/` |
| `tests/cli/electron.test.ts` | `src/cli/utils/electron.ts` | `import { spawnElectron }` | WIRED | Line 21: `import { spawnElectron } from '../../src/cli/utils/electron.js'` |

### Data-Flow Trace (Level 4)

The modified artifacts relay IPC messages and DOM mutations — they do not independently fetch or render database data. The retry handler reads from `AgentManager.getTask()` (in-memory store populated when tasks are submitted), not from a DB or static value. No hollow prop pattern applies.

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `ipc-handlers.ts` retry handler | `task.instruction` | `agentManager.getTask(data.id)` — in-memory task store | Yes — populated at task submission time | FLOWING |
| `overlay.ts` prefill handler | `data.instruction` | IPC payload from main process | Yes — value originates from real task | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All 234 tests pass | `npx vitest run` | 18 test files, 234 tests passed | PASS |
| Build produces only overlay.cjs and sidebar.cjs in out/preload | `npx electron-vite build && ls out/preload/` | `overlay.cjs  sidebar.cjs` | PASS |
| `retryTask` not called in ipc-handlers.ts | `grep -c retryTask src/main/ipc-handlers.ts` | 0 matches | PASS |
| `buildElectron` absent from src/ and tests/ | grep across both dirs | 0 matches | PASS |
| `CLAW_CWD` absent from src/ and tests/ | grep across both dirs | 0 matches | PASS |
| `src/preload/index.ts` deleted | `test -f src/preload/index.ts` | false | PASS |
| `src/renderer/index.html` deleted | `test -f src/renderer/index.html` | false | PASS |

### Requirements Coverage

Both plans declare `requirements: []` (gap-closure phase with no REQUIREMENTS.md IDs). No orphaned requirements to check.

### Anti-Patterns Found

No TODO, FIXME, placeholder comments, or empty implementations found in any of the modified files (`src/main/ipc-handlers.ts`, `src/renderer/overlay.ts`, `src/cli/utils/electron.ts`, `electron.vite.config.ts`, `tests/cli/electron.test.ts`).

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | None found | — | — |

One minor note: `tests/cli/electron.test.ts` line 5 still mocks `execFileSync` in the `vi.mock('node:child_process')` block even though it is no longer imported. This is harmless (Vitest ignores unused mock exports) and was an intentional deviation documented in the 06-02 SUMMARY.

### Human Verification Required

**1. Retry-Prefill UI Flow**

**Test:** Launch the app pointing at a local dev server. Submit a task that causes a Claude error (e.g. malformed instruction or network issue). When the error task appears in the sidebar, click the Retry button.
**Expected:** The overlay activates immediately. The textarea contains the original instruction text. The toolbar is visible. The cursor is in crosshair/rect-idle mode indicating the user must draw a new selection. The sidebar is minimized or hidden.
**Why human:** Requires a running Electron window with a real dev server URL and an actual task error. The state machine visual mode (crosshair cursor on the overlay surface, `body.claw-overlay--active` class applied) cannot be verified programmatically without rendering.

**2. Edit-and-Resubmit After Prefill**

**Test:** After the prefill flow activates the overlay, draw a selection on the page, optionally edit the prefilled instruction, and click Submit.
**Expected:** A new task is created and appears in the sidebar. The previously dismissed error task does not reappear. Claude receives the (possibly edited) instruction.
**Why human:** Requires a live Claude Code subprocess, real selection IPC roundtrip, and sidebar task rendering.

**3. Escape Cancels Prefill**

**Test:** After prefill activates the overlay, press Escape.
**Expected:** The overlay deactivates. The prefilled instruction is discarded (no partial task remains in the sidebar). This is documented acceptable behavior for v1.0.
**Why human:** Requires visual confirmation of overlay deactivation and sidebar state restoration.

### Gaps Summary

No automated gaps found. All code-level success criteria are met:

- The `sidebar:task-retry` handler was fully rewritten — it reads the original instruction, dismisses the error task, sends `overlay:prefill-instruction` IPC, calls `setOverlayActive`, and enters selection mode. `agentManager.retryTask()` is not called anywhere.
- The `onPrefillInstruction` handler in `overlay.ts` calls `activateOverlaySurface()`, dispatches `ACTIVATE_RECT`, positions the input bar at the default centered location, and focuses the textarea.
- All four dead code items are fully removed and confirmed absent.
- 234 tests pass. Build produces the correct two preload artifacts.

Status is `human_needed` because three manual UI scenarios (retry-prefill visual, edit-and-resubmit flow, escape-cancels flow) cannot be verified without running the Electron application.

---

_Verified: 2026-04-07T14:01:30Z_
_Verifier: Claude (gsd-verifier)_
