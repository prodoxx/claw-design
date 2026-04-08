---
status: awaiting_human_verify
trigger: "toolbar-position-reset: Toolbar resets to default position when icon clicked then selection cancelled"
created: 2026-04-08T00:00:00Z
updated: 2026-04-08T00:05:00Z
---

## Current Focus

hypothesis: CONFIRMED -- coordinate system mismatch when overlay view expands from small to full window
test: Implemented fix: IPC returns pre-expansion bounds, renderer captures local rect before expansion, computes correct full-window coords
expecting: Toolbar stays at exact screen position through activate/deactivate cycles
next_action: Awaiting human verification

## Symptoms

expected: Toolbar remains at the position the user dragged it to, regardless of icon clicks or selection cancellations. Position should persist across all interactions.
actual: Toolbar snaps back to its original/default position when an icon selection is clicked and then cancelled. Also snaps when any icon is clicked.
errors: None -- behavioral/state bug, not a runtime error.
reproduction: 1. Start clawdesign, 2. Drag toolbar to a new position, 3. Click a selection icon on toolbar, 4. Cancel the selection (press Escape or similar), 5. Observe toolbar has moved back to default position.
started: Likely since toolbar drag was implemented. Position state is being reset by selection/cancellation flow.

## Eliminated

- hypothesis: Ordering of activateOverlaySurface/activateSelection calls is the root cause
  evidence: User verified NOT FIXED after swapping ordering in all code paths. The toolbar still jumps when a select icon is clicked. Ordering alone does not solve the problem because getBoundingClientRect() returns view-local coordinates which are in a different coordinate system after the overlay view expands from small to full window.
  timestamp: 2026-04-08T00:02:00Z

## Evidence

- timestamp: 2026-04-08T00:01:00Z
  checked: overlay.ts activateOverlaySurface() and deactivateOverlaySurface()
  found: activateOverlaySurface pins toolbar with fixed positioning using getBoundingClientRect(). deactivateOverlaySurface clears ALL inline styles (position, left, top, bottom, right = ''). This causes toolbar to revert to its CSS-defined position (absolute, bottom:12px, right:8px).
  implication: This is the renderer-side cause. The toolbar CSS `.claw-toolbar` uses `position: absolute; bottom: 12px; right: 8px;` as defaults. Clearing inline styles snaps it back.

- timestamp: 2026-04-08T00:02:00Z
  checked: Drag mechanism (overlay.ts lines 724-771)
  found: Dragging uses IPC (window.claw.dragToolbar) which moves the overlayView bounds in main process. It does NOT update toolbar CSS position -- the toolbar stays at same position relative to its overlay view, but the overlay view moves. On mouseup, position is saved to localStorage and main-process toolbarPosition.
  implication: The drag works by moving the entire overlay BrowserWindow view, not by changing CSS. So when overlay goes active (full window), toolbar CSS must be pinned. When overlay goes inactive, the overlay view is shrunk back. But the renderer toolbar CSS gets cleared to defaults.

- timestamp: 2026-04-08T00:03:00Z
  checked: setOverlayInactive in window.ts (lines 380-412)
  found: setOverlayInactive correctly uses getToolbarPosition() to reposition the overlayView bounds around the user's saved position. So the main process IS restoring position.
  implication: The main process correctly restores the overlay view bounds. But the renderer toolbar's CSS is being cleared to defaults by deactivateOverlaySurface(). Since the toolbar is inside the overlay view, and the overlay view is correctly positioned, the CSS reset causes the toolbar to appear at bottom-right WITHIN that correctly-positioned view -- which may be close but not exact, or may be visibly wrong.

- timestamp: 2026-04-08T00:04:00Z
  checked: Coordinate system analysis -- what getBoundingClientRect returns in small vs full view
  found: When overlay view is small (e.g. {x:840, y:460, w:228, h:321}), the toolbar at bottom:12px,right:8px has a getBoundingClientRect of roughly {left:168, top:4} (view-local). When view expands to full window {x:0, y:0, w:1280, h:800}, position:fixed with left:168,top:4 places toolbar at top-left of screen. The correct full-window position should be approximately (840+168, 460+4) = (1008, 464). The view's origin offset is lost.
  implication: The fix must translate view-local coordinates to full-window coordinates by adding the overlay view's pre-expansion origin (x,y). The renderer needs the overlay view bounds from the main process.

- timestamp: 2026-04-08T00:04:30Z
  checked: Available IPC and architecture for passing view bounds
  found: activateSelection IPC (overlay:activate-selection) currently returns void. It can be modified to return the overlay view's pre-expansion bounds. The renderer can then compute: windowX = viewBounds.x + localRect.left, windowY = viewBounds.y + localRect.top. On deactivation, clearing styles + shrinking view back restores defaults correctly.
  implication: Minimal change: (1) IPC handler returns pre-expansion bounds, (2) activateOverlaySurface accepts bounds param, (3) compute correct fixed position.

## Resolution

root_cause: activateOverlaySurface() uses getBoundingClientRect() to capture the toolbar's position, but this returns coordinates relative to the overlay VIEW's viewport (which is a small rectangle). When the overlay view expands to full window, those view-local coordinates become wrong in the full-window coordinate system. For example, toolbar at view-local {left:168, top:4} in a view positioned at {x:840, y:460} should be at full-window {left:1008, top:464}, but the code pins it at {left:168, top:4} -- making it jump to the top-left area. The previous ordering fix was insufficient because the coordinate system mismatch is the real problem, not the ordering.
fix: Three-part fix -- (1) IPC handler overlay:activate-selection now captures and returns the overlay view's pre-expansion bounds before expanding to full window. (2) New captureToolbarLocalRect() function captures toolbar getBoundingClientRect() BEFORE the IPC call (while view is still small). (3) activateOverlaySurface() now takes both params and computes correct full-window position as viewBounds.x + localRect.left, viewBounds.y + localRect.top. All 3 activation call sites (selectBtn, elemBtn, prefill) updated. Deactivation paths unchanged -- they correctly shrink view first then clear styles.
verification: TypeScript type-check passes (same 2 pre-existing errors). Full test suite passes (234/234 tests, 18 files). Awaiting human verification.
files_changed: [src/main/ipc-handlers.ts, src/preload/overlay.ts, src/renderer/overlay.ts]
