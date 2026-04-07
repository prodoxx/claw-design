# Phase 6: Wire Retry Prefill & Tech Debt Cleanup - Research

**Researched:** 2026-04-07
**Domain:** Electron IPC wiring, dead code removal
**Confidence:** HIGH

## Summary

Phase 6 is a small, well-scoped gap closure phase with two concerns: (1) wiring the missing IPC send in the retry flow so the overlay textarea gets prefilled with the previous instruction, and (2) removing four identified dead code items. All changes are to existing files with established patterns -- no new libraries, no new architecture.

The retry-prefill gap is precisely diagnosed in the milestone audit: `sidebar:task-retry` in `ipc-handlers.ts` (line 166) calls `agentManager.retryTask()` which silently re-submits. The fix requires the handler to also send `overlay:prefill-instruction` IPC to the overlay renderer INSTEAD of auto-resubmitting, so the user can edit the instruction before re-submitting. The receiver side is already wired: `preload/overlay.ts` exposes `onPrefillInstruction`, and `renderer/overlay.ts` (lines 687-695) handles it by populating the textarea and triggering auto-expand.

The dead code items are confirmed by codebase grep: `buildElectron` is defined but only imported by its own test file, `CLAW_CWD` is set but never read, `preload/index.ts` is a no-op stub, and `renderer/index.html` is unreferenced.

**Primary recommendation:** Two plans -- Plan 1 wires the retry-prefill flow (modify `ipc-handlers.ts` to send prefill IPC, then activate overlay for re-selection/re-submission), Plan 2 removes dead code and updates tests.

## Project Constraints (from CLAUDE.md)

- Electron IPC with `contextBridge` + `contextIsolation` (security boundary enforced)
- Agent SDK for Claude Code (not raw child_process)
- Pure state machine pattern in overlay.ts and sidebar-state.ts (transition functions separated from DOM wiring)
- Safe SVG construction using createElementNS (no innerHTML)
- electron-vite for build tooling
- No `.env.backup` files ever

## Architecture Patterns

### Current Retry Flow (BROKEN)

```
Sidebar "Retry" button click
  -> window.clawSidebar.retryTask(id)
  -> ipcRenderer.invoke('sidebar:task-retry', { id })
  -> ipcMain handler calls agentManager.retryTask(id)
  -> retryTask() dismisses old task, creates new one, auto-submits
  -> [MISSING] overlay is never notified to prefill textarea
```

### Target Retry Flow (FIXED)

```
Sidebar "Retry" button click
  -> window.clawSidebar.retryTask(id)
  -> ipcRenderer.invoke('sidebar:task-retry', { id })
  -> ipcMain handler:
     1. Reads original task instruction from agentManager.getTask(id)
     2. Sends overlay:prefill-instruction IPC to overlay renderer
     3. Activates overlay selection mode (expand bounds)
     4. Does NOT call agentManager.retryTask() -- user re-submits manually
  -> Overlay renderer receives prefill:
     - textarea.value = instruction
     - textarea.dispatchEvent(new Event('input')) -- triggers auto-expand + submit enable
  -> User edits instruction (or leaves as-is)
  -> User makes new selection (or reuses current area)
  -> User clicks Submit -> normal submit flow with new/edited instruction
```

### Key Design Decision: Prefill + Re-select vs. Auto-resubmit

The current `retryTask()` auto-resubmits with the original screenshot, DOM, and instruction. The success criteria say "User can edit the prefilled instruction before re-submitting." This means the retry flow should:
1. Prefill the textarea with the original instruction text
2. Activate overlay so user can make a new selection
3. Let the user modify the instruction and submit normally
4. The original task should be dismissed from the sidebar

This is NOT a simple "resend the same data" -- it gives the user control to adjust both the instruction AND the selection. [VERIFIED: ROADMAP.md success criteria 1 and 2]

### Overlay Activation on Prefill

When the prefill IPC arrives, the overlay needs to be in a state where the user can interact. Currently the `onPrefillInstruction` handler just sets the textarea value but does NOT activate the overlay or show the input bar. The fix needs to:
1. Send `overlay:prefill-instruction` with the instruction text
2. Activate overlay (expand bounds, switch to selection mode)
3. The overlay renderer must show the input bar with the prefilled text

This means the prefill handler in `overlay.ts` (lines 687-695) needs enhancement: it currently only sets the textarea value, but the input bar may be hidden and the overlay may be inactive. [VERIFIED: codebase inspection of overlay.ts]

### Dead Code Items

| Item | Location | Why Dead | Safe to Remove |
|------|----------|----------|----------------|
| `buildElectron()` export | `src/cli/utils/electron.ts:14-21` | Was called by `start.ts` until Phase 5 removed the runtime build. Only imported by its own test. | YES -- remove function + test. `spawnElectron` stays. |
| `CLAW_CWD` env var | `src/cli/utils/electron.ts:42` | Set when spawning Electron but never read anywhere. `CLAW_PROJECT_DIR` is used instead (line 29 of `main/index.ts`). | YES -- remove the line. Update test that asserts on it. |
| `preload/index.ts` stub | `src/preload/index.ts` | Contains only `export {}`. Built by electron-vite (config line 16) but never loaded by any WebContentsView (overlay uses `overlay.cjs`, sidebar uses `sidebar.cjs`). | YES -- remove file + config entry. |
| `renderer/index.html` placeholder | `src/renderer/index.html` | Minimal HTML placeholder from Phase 1. Not in electron-vite renderer input config (only `overlay.html` and `sidebar.html` are). | YES -- delete file. |

[VERIFIED: grep confirms `buildElectron` has no imports in production code; `CLAW_CWD` appears only in `electron.ts`; `preload/index.ts` is not referenced by any WebContentsView preload path; `renderer/index.html` is not in electron-vite config input]

### electron-vite Config Change Required

Removing `preload/index.ts` requires updating `electron.vite.config.ts` line 16:

**Before:**
```typescript
input: {
  index: resolve(__dirname, 'src/preload/index.ts'),
  overlay: resolve(__dirname, 'src/preload/overlay.ts'),
  sidebar: resolve(__dirname, 'src/preload/sidebar.ts'),
},
```

**After:**
```typescript
input: {
  overlay: resolve(__dirname, 'src/preload/overlay.ts'),
  sidebar: resolve(__dirname, 'src/preload/sidebar.ts'),
},
```

[VERIFIED: electron.vite.config.ts lines 15-19]

### Test Impact

| File | Current Tests | Impact |
|------|---------------|--------|
| `tests/cli/electron.test.ts` | Tests `buildElectron` (lines 26-49) and `CLAW_CWD` assertion (line 94-98) | Remove `buildElectron` describe block. Remove `CLAW_CWD` assertion. Add `CLAW_PROJECT_DIR` assertion if not already present. |
| No existing test for retry-prefill IPC | -- | Could add a unit test for the IPC handler behavior, but this is IPC wiring that requires Electron mocks. Manual/visual verification is more practical. |

[VERIFIED: tests/cli/electron.test.ts inspection]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| IPC message routing | Custom event bus | Electron `ipcMain.handle` / `webContents.send` | Already used throughout the codebase, established pattern |
| Overlay state management | Ad-hoc DOM manipulation | Existing state machine pattern + `dispatch()` | Pure state machine pattern (Phase 3 decision) |

## Common Pitfalls

### Pitfall 1: Prefill Without Overlay Activation
**What goes wrong:** The overlay receives the prefill instruction, sets the textarea value, but the overlay is in inactive mode (shrunk to toolbar area). The user never sees the prefilled text.
**Why it happens:** The `onPrefillInstruction` handler in overlay.ts only sets textarea value -- it does not activate the overlay or show the input bar.
**How to avoid:** The IPC handler in main process must also activate the overlay (call `setOverlayActive`), and the overlay renderer's prefill handler must call `showInputBar` or equivalent to make the input bar visible.
**Warning signs:** Retry button appears to do nothing (overlay stays as toolbar).

### Pitfall 2: Selection State Confusion After Prefill
**What goes wrong:** The overlay activates with prefilled text but the selection state machine is in `inactive` mode. The user sees the input bar but has no selection highlighted, so submission fails (no `selectionBounds`).
**Why it happens:** The prefill flow activates the overlay but doesn't trigger a selection state transition.
**How to avoid:** After prefill, the overlay should enter selection mode (`rect-idle` or `elem-idle`) so the user can draw a new selection. The input bar should be visible but submission should require a selection first (same as normal flow).
**Warning signs:** User types instruction but submit does nothing because `state.selectionBounds` is null.

### Pitfall 3: Removing electron-vite Config Entry Breaks Build
**What goes wrong:** Removing `preload/index.ts` from `electron.vite.config.ts` without verifying the build still works.
**Why it happens:** Vite/Rollup config changes can have cascading effects.
**How to avoid:** Run `npm run build` (or `npx electron-vite build`) after removing the config entry and verify `out/` still contains `preload/overlay.cjs` and `preload/sidebar.cjs`.
**Warning signs:** Build errors, missing preload scripts.

### Pitfall 4: Task Dismissed Too Early on Retry
**What goes wrong:** The retry handler dismisses the original task immediately, but the user might cancel the retry. The original error task disappears from the sidebar with no way to get it back.
**Why it happens:** Current `retryTask()` calls `dismissTask()` then `submitTask()`. If we change to prefill-only (no auto-submit), dismissing prematurely loses the task.
**How to avoid:** Only dismiss the original task when the new submission actually goes through. Or: keep the original task visible in the sidebar until the new task replaces it. Simplest approach: dismiss when the new task is successfully submitted through the normal overlay submit flow.

## Code Examples

### Current Retry Handler (to modify)
```typescript
// src/main/ipc-handlers.ts:166-168
ipcMain.handle('sidebar:task-retry', async (_event, data: { id: string }) => {
  await agentManager.retryTask(data.id);
});
```
[VERIFIED: ipc-handlers.ts lines 166-168]

### Target Retry Handler Pattern
```typescript
// src/main/ipc-handlers.ts -- modified retry handler
ipcMain.handle('sidebar:task-retry', async (_event, data: { id: string }) => {
  const task = agentManager.getTask(data.id);
  if (!task) return;

  // Prefill the overlay textarea with the original instruction
  components.overlayView.webContents.send('overlay:prefill-instruction', {
    instruction: task.instruction,
  });

  // Activate overlay for new selection
  setOverlayActive(components.overlayView, components.window, components);
  components.overlayView.webContents.send('overlay:mode-change', 'selection');

  // Dismiss the old task (user will re-submit through normal flow)
  agentManager.dismissTask(data.id);
});
```

### Existing Prefill Receiver (needs enhancement)
```typescript
// src/renderer/overlay.ts:687-695
if (window.claw?.onPrefillInstruction) {
  window.claw.onPrefillInstruction((data: { instruction: string }) => {
    const ta = document.getElementById('claw-input-textarea') as HTMLTextAreaElement;
    if (ta) {
      ta.value = data.instruction;
      ta.dispatchEvent(new Event('input'));
    }
  });
}
```
[VERIFIED: renderer/overlay.ts lines 687-695]

### Enhanced Prefill Receiver Pattern
```typescript
// The prefill handler needs to also show the input bar and activate selection
if (window.claw?.onPrefillInstruction) {
  window.claw.onPrefillInstruction((data: { instruction: string }) => {
    const ta = document.getElementById('claw-input-textarea') as HTMLTextAreaElement;
    if (ta) {
      ta.value = data.instruction;
      ta.dispatchEvent(new Event('input'));
    }
    // Activate overlay surface for interaction
    activateOverlaySurface();
    // Enter rect-idle so user can make a selection
    dispatch({ type: 'ACTIVATE_RECT' });
  });
}
```

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.x |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map
| Behavior | Test Type | Automated Command | File Exists? |
|----------|-----------|-------------------|-------------|
| Retry handler sends prefill IPC | integration (Electron IPC mock) | Manual verification -- IPC wiring requires Electron context | N/A |
| Prefilled textarea is editable | manual | Visual verification in running app | N/A |
| buildElectron removed from electron.ts | unit | `npx vitest run tests/cli/electron.test.ts -x` | YES (update needed) |
| CLAW_CWD removed from spawnElectron | unit | `npx vitest run tests/cli/electron.test.ts -x` | YES (update needed) |
| preload/index.ts removed | build verification | `npx electron-vite build` | Config change |
| renderer/index.html removed | build verification | `npx electron-vite build` | File deletion |
| Full test suite still passes | regression | `npx vitest run` | YES (18 files) |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/cli/electron.test.ts -x`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green + `npx electron-vite build` succeeds

### Wave 0 Gaps
None -- existing test infrastructure covers all phase requirements. The `tests/cli/electron.test.ts` file needs updating (remove dead tests, update assertions), not creation.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | -- |
| V3 Session Management | no | -- |
| V4 Access Control | no | -- |
| V5 Input Validation | yes | IPC message validation (existing pattern: whitelist validation on `viewport:set`) |
| V6 Cryptography | no | -- |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| IPC injection via untrusted data in prefill | Tampering | Prefill data comes from AgentManager (trusted internal state), not user input. contextBridge isolation prevents renderer from accessing raw IPC. Already mitigated by existing architecture. |

No new security surfaces introduced by this phase. All IPC channels use existing patterns.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Retry should enter rect-idle mode (not elem-idle) | Architecture Patterns | User gets wrong selection mode -- could use either; rect-idle is more general |
| A2 | Original task should be dismissed when retry activates prefill | Pitfall 4 | User loses error task before re-submission -- alternative is to keep it until new task succeeds |

## Open Questions

1. **Should retry prefill auto-select a mode or let user choose?**
   - What we know: The overlay has two selection modes (rect and element). Retry prefill could activate either one or just activate the overlay without choosing a mode.
   - What's unclear: Whether the original selection mode should be remembered and restored.
   - Recommendation: Activate `rect-idle` as the default -- it is the more general mode and the user can switch to element mode via the toolbar. This is the simplest approach and matches the normal flow.

2. **Should the original task be dismissed immediately or kept until re-submission?**
   - What we know: Current `retryTask()` dismisses then creates new. If we change to prefill-only, dismissing immediately loses the task if user cancels.
   - What's unclear: Whether users expect the error task to stay visible during retry.
   - Recommendation: Dismiss immediately for simplicity. The task instruction is preserved in the textarea. If the user presses Escape (cancels), they lose the task -- this is acceptable for v1.0 because the instruction text is visible and the user chose to retry.

## Sources

### Primary (HIGH confidence)
- Codebase inspection: `src/main/ipc-handlers.ts`, `src/renderer/overlay.ts`, `src/preload/overlay.ts`, `src/main/agent-manager.ts` -- verified exact line numbers and function signatures
- Codebase inspection: `src/cli/utils/electron.ts`, `electron.vite.config.ts`, `src/preload/index.ts`, `src/renderer/index.html` -- verified dead code status via grep
- Codebase inspection: `tests/cli/electron.test.ts` -- verified test structure and assertions to update

### Secondary (MEDIUM confidence)
- `.planning/v1.0-MILESTONE-AUDIT.md` -- gap descriptions and tech debt inventory

## Metadata

**Confidence breakdown:**
- Retry-prefill wiring: HIGH -- exact gap identified, receiver already implemented, sender location known
- Dead code removal: HIGH -- all items confirmed dead via grep, no hidden references
- Test updates: HIGH -- exact tests identified, changes straightforward
- Overlay UX after prefill: MEDIUM -- need to confirm overlay activation + input bar visibility work together (Pitfall 1 and 2)

**Research date:** 2026-04-07
**Valid until:** 2026-05-07 (stable -- no external dependencies changing)
