# Retrospective

## Milestone: v1.0 — MVP

**Shipped:** 2026-04-08
**Phases:** 7 | **Plans:** 21 | **Tasks:** 44
**Timeline:** 6 days (2026-04-03 to 2026-04-08)
**LOC:** 4,581 TypeScript | **Tests:** 234

### What Was Built
- CLI orchestrator with dev server auto-detection, port polling, Agent SDK sessions, tree-kill shutdown
- Electron BaseWindow with dual WebContentsViews (secure site + transparent overlay)
- Selection state machine with rectangle/element modes, DPI-aware screenshot capture, DOM extraction
- Claude Code integration via Agent SDK with parallel task management, sidebar with live activity streaming
- Viewport switching (desktop/tablet/mobile), toast notifications, branded splash screen
- Retry-prefill flow, dead code cleanup, open source readiness (branding, README, community files)

### What Worked
- Phase-by-phase dependency chain meant each phase had a solid foundation to build on
- Pure state machine pattern (overlay, sidebar) enabled thorough unit testing without Electron mocks
- Parallel worktree execution for independent plans within a wave saved significant time
- electron-vite multi-entry config cleanly separated main/preload/renderer builds

### What Was Inefficient
- Toolbar position bug required multiple debug iterations — coordinate system mismatch between view-local and full-window coords wasn't caught by tests
- Content filter blocked CODE_OF_CONDUCT.md generation, requiring a download workaround
- About dialog icon required three attempts (iconPath vs NativeImage vs bundle replacement) — Electron docs were misleading about which API works on macOS
- Window tests broke after rebrand because they asserted on lowercase "claw-design" instead of display name "Claw Design"

### Patterns Established
- Preload scripts must build as CJS (Electron rejects ESM imports)
- Near-invisible overlay background `rgba(0,0,0,0.01)` for Chromium hit-testing
- Postinstall script for macOS Electron.app branding (plist + icon patching)
- `requestAnimationFrame` throttling for IPC-heavy hover detection

### Key Lessons
- Electron's macOS branding comes from the binary's Info.plist, not from app.setName() — must patch the binary
- `getBoundingClientRect()` returns view-local coordinates — when the view changes size, coordinates need translation
- Agent SDK `AsyncIterable<SDKUserMessage>` pattern works well for multi-turn streaming input

## Cross-Milestone Trends

| Metric | v1.0 |
|--------|------|
| Phases | 7 |
| Plans | 21 |
| Tasks | 44 |
| LOC | 4,581 |
| Tests | 234 |
| Days | 6 |
| Debug sessions | 2 |
