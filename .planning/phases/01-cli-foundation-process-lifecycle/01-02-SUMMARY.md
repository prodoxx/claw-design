---
phase: 01-cli-foundation-process-lifecycle
plan: 02
subsystem: cli
tags: [port-detection, tcp-polling, agent-sdk, tree-kill, process-lifecycle, graceful-shutdown]

# Dependency graph
requires:
  - "01-01: Project scaffolding, CLI entry point, dev-server detection, output helpers"
provides:
  - "Port extraction from stdout for all major dev server formats (Vite, Next.js, Webpack, CRA, generic)"
  - "TCP readiness polling with configurable timeout (default 30s)"
  - "Port-in-use diagnostics via lsof/ps"
  - "Claude Code installed check (PATH lookup)"
  - "Claude Code session management via Agent SDK streaming input mode"
  - "Graceful shutdown coordination with tree-kill for process tree cleanup"
  - "Signal handler registration for SIGINT, SIGTERM, uncaughtException"
affects: [01-03-PLAN, phase-02, phase-04]

# Tech tracking
tech-stack:
  added: []
  patterns: [port-pattern-priority-ordering, async-generator-message-queue, idempotent-shutdown, tree-kill-process-cleanup]

key-files:
  created:
    - src/cli/utils/port-detect.ts
    - src/cli/utils/claude.ts
    - src/cli/utils/process.ts
    - tests/cli/port-detect.test.ts
    - tests/cli/claude.test.ts
    - tests/cli/process.test.ts
  modified: []

key-decisions:
  - "PORT_PATTERNS ordered most-specific-first (URL > listening/running > generic port keyword > colon:digits) to avoid false positives from database port numbers in logs"
  - "tree-kill called with callback form (3 args) for compatibility with the CJS module's export signature"
  - "resetShutdownState export added for test isolation -- tracks registered listeners for clean removal"

patterns-established:
  - "Port detection: ordered regex array with first-match-wins, followed by TCP poll confirmation"
  - "Agent SDK: async generator message queue for streaming input mode -- push/yield pattern"
  - "Shutdown: idempotent flag guard, ordered teardown (Claude > Electron > dev server), force exit timeout"
  - "Vitest v4: options as second argument (not third) for test timeouts"

requirements-completed: [CLI-04, CLI-05, PROC-01, PROC-02, PROC-03, FRAME-01]

# Metrics
duration: 5min
completed: 2026-04-03
---

# Phase 01 Plan 02: Port Detection, Claude Session, and Shutdown Coordination Summary

**Framework-agnostic port detection with TCP polling, Agent SDK streaming session management, and idempotent tree-kill shutdown -- 33 tests passing**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-03T14:25:12Z
- **Completed:** 2026-04-03T14:30:43Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Port extraction handles all common dev server output formats (localhost URL, 127.0.0.1, 0.0.0.0, [::], Vite, Next.js, generic "port N") with priority ordering to avoid false positives
- TCP readiness polling confirms actual port availability with 30s default timeout and 250ms poll interval
- Claude Code session uses Agent SDK streaming input mode with async generator message queue for multi-turn interaction
- Shutdown coordinator kills entire process trees via tree-kill, not just parent PIDs, with idempotent guard and 5s force exit

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Failing tests for port detection** - `bf43bf1` (test)
2. **Task 1 GREEN: Port detection implementation** - `5a99a46` (feat)
3. **Task 2 RED: Failing tests for Claude session and shutdown** - `a9aee36` (test)
4. **Task 2 GREEN: Claude session and shutdown implementation** - `b6987f8` (feat)

## Files Created/Modified
- `src/cli/utils/port-detect.ts` - Port extraction from stdout (PORT_PATTERNS regex array), TCP polling (waitForPort), port-in-use diagnostics (getProcessOnPort)
- `src/cli/utils/claude.ts` - Claude Code installed check (isClaudeInstalled), Agent SDK session spawn with streaming input (spawnClaudeSession)
- `src/cli/utils/process.ts` - Shutdown handler registration (registerShutdownHandlers), idempotent teardown with tree-kill, signal handling
- `tests/cli/port-detect.test.ts` - 19 tests covering URL variants, dev server formats, edge cases, TCP polling timeout/success
- `tests/cli/claude.test.ts` - 6 tests covering installed check, SDK options verification, session interface
- `tests/cli/process.test.ts` - 8 tests covering signal registration, tree-kill invocation, idempotent shutdown, force exit timeout

## Decisions Made
- PORT_PATTERNS ordered most-specific-first to prevent database port (5432) matching before dev server URL (localhost:3000) -- directly addresses Pitfall 4 from research
- tree-kill called with 3-arg callback form for CJS module compatibility under ESM interop
- Added resetShutdownState export for test isolation -- needed because module-level shuttingDown flag persists across tests

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Vitest v4 removed 3rd-argument test options**
- **Found during:** Task 1 GREEN (running port-detect tests)
- **Issue:** `it('name', async () => {...}, { timeout: 5000 })` signature was removed in Vitest 4 (deprecated in 3)
- **Fix:** Changed to `it('name', { timeout: 5000 }, async () => {...})` (options as 2nd arg)
- **Files modified:** tests/cli/port-detect.test.ts
- **Verification:** All tests pass
- **Committed in:** 5a99a46 (Task 1 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Vitest API change fix was trivial. No scope creep.

## Issues Encountered
None -- all tasks executed cleanly after the Vitest API fix.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None -- all three utility modules are fully implemented with no placeholder logic. They are ready for integration by Plan 03 (start command orchestrator).

## Next Phase Readiness
- Port detection, Claude session, and shutdown modules are ready for Plan 03 to wire into the start command
- All exports match the interfaces declared in the plan: extractPortFromOutput, waitForPort, getProcessOnPort, isClaudeInstalled, spawnClaudeSession, registerShutdownHandlers, ManagedProcesses
- 40 total tests passing across all 4 test files (7 from Plan 01 + 33 from Plan 02)

## Self-Check: PASSED

All 6 created files verified present. All 4 commit hashes verified in git log.

---
*Phase: 01-cli-foundation-process-lifecycle*
*Completed: 2026-04-03*
