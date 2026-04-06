---
phase: 05-polish-distribution
plan: 04
subsystem: ui
tags: [tooltip, splash-screen, electron, css-animation, data-url]

# Dependency graph
requires:
  - phase: 05-01
    provides: Viewport preset buttons in toolbar (desktop/tablet/mobile)
  - phase: 05-03
    provides: Toast notification system and overlay state machine with mode guards
provides:
  - Tooltip system for all 5 toolbar buttons with 400ms hover delay
  - Branded splash screen with spinner shown during site load
  - navigateToSite() method on WindowComponents for splash-to-site transition
affects: [05-05-npm-packaging]

# Tech tracking
tech-stack:
  added: []
  patterns: [data-url splash screen, forward-declared callback for cross-concern wiring]

key-files:
  created: []
  modified:
    - src/renderer/overlay.html
    - src/renderer/overlay.css
    - src/renderer/overlay.ts
    - src/main/window.ts
    - src/main/index.ts
    - tests/main/window.test.ts

key-decisions:
  - "Forward-declared onModeChange callback in dispatch to wire tooltip hiding without reassigning function declarations"
  - "Splash screen uses data URL approach (no build config changes) per research recommendation"

patterns-established:
  - "data-tooltip attribute pattern: static tooltip text on toolbar buttons read by JS"
  - "onModeChange callback: forward-declared nullable callback for cross-concern dispatch hooks"

requirements-completed: [ELEC-03]

# Metrics
duration: 4min
completed: 2026-04-06
---

# Phase 05 Plan 04: Tooltips and Splash Screen Summary

**Toolbar tooltips with 400ms hover delay positioned left of buttons, and branded splash screen with CSS spinner during site load**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-06T12:01:50Z
- **Completed:** 2026-04-06T12:06:11Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- All 5 toolbar buttons have tooltip text matching UI-SPEC copywriting contract (Region select, Element select, Desktop/Tablet/Mobile with dimensions)
- Tooltip appears after 400ms hover delay, positioned to the left of the button with 8px gap, hidden during active selection modes
- Branded splash screen shows "claw-design" text, CSS-only 24x24 spinner with accent blue, and "Loading localhost:{port}..." text
- Splash loads as data URL in siteView, immediately replaced when navigateToSite() loads actual site URL
- prefers-reduced-motion disables spinner animation

## Task Commits

Each task was committed atomically:

1. **Task 1: Toolbar tooltip system with hover delay and selection mode guard** - `c3be477` (feat)
2. **Task 2: Branded splash screen with loading indicator during site load** - `fc51522` (feat)

## Files Created/Modified
- `src/renderer/overlay.html` - Added data-tooltip attributes to all 5 buttons, tooltip element with role=tooltip
- `src/renderer/overlay.css` - Added .claw-tooltip styles (11px, rgba(10,10,10,0.95) bg, 8px border-radius, z-index 10000)
- `src/renderer/overlay.ts` - Tooltip show/hide logic with 400ms setTimeout delay, selection mode guard via onModeChange callback
- `src/main/window.ts` - Splash screen HTML as data URL loaded in siteView, navigateToSite() method on WindowComponents
- `src/main/index.ts` - Calls components.navigateToSite() after window creation for splash-to-site transition
- `tests/main/window.test.ts` - Updated loadURL test for splash data URL, added navigateToSite test

## Decisions Made
- Used forward-declared `onModeChange` callback in dispatch rather than reassigning the function declaration, since function declarations in blocks are not reassignable
- Splash screen uses data URL approach (inline HTML string with encodeURIComponent) per research recommendation, avoiding build config changes
- Tooltip uses textContent (not innerHTML) for security, even though text is static from data-tooltip attributes

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All UI polish features (viewport presets, pre-flight checks, toasts, tooltips, splash screen) are complete
- Ready for Plan 05: npm packaging and distribution

## Self-Check: PASSED

All 6 modified files exist. Both task commits (c3be477, fc51522) verified in git log. SUMMARY.md created.

---
*Phase: 05-polish-distribution*
*Completed: 2026-04-06*
