---
phase: 04-claude-code-integration
plan: 01
subsystem: claude-integration
tags: [agent-sdk, prompt-assembly, concurrency, async-iterable, base64-image]

# Dependency graph
requires:
  - phase: 03-selection-capture
    provides: DomExtractionResult type, CSSRect type, screenshot Buffer
provides:
  - assemblePrompt function converting instruction + screenshot + DOM to Agent SDK content blocks
  - AgentManager class orchestrating parallel Claude agents with lifecycle tracking
  - TaskStatus/Task/TaskUpdate types for IPC status communication
affects: [04-02 (IPC bridge), 04-03 (sidebar renderer)]

# Tech tracking
tech-stack:
  added: ["@anthropic-ai/claude-agent-sdk (query, SDKUserMessage, SDKMessage)"]
  patterns: [async-iterable prompt input, agent concurrency pool with queue drain, error message mapping]

key-files:
  created:
    - src/main/prompt.ts
    - src/main/agent-manager.ts
    - tests/main/prompt.test.ts
    - tests/main/agent-manager.test.ts
  modified: []

key-decisions:
  - "AsyncIterable<SDKUserMessage> as prompt format -- matches Agent SDK query() signature for streaming input"
  - "Max 3 parallel agents with processQueue drain pattern -- prevents query process accumulation (Pitfall 2)"
  - "Only react to system.init and result messages -- prevents IPC flooding (Pitfall 3)"
  - "humanReadableError maps SDK error substrings to user-friendly messages -- clean UX for common failures"

patterns-established:
  - "Prompt assembly: text + image + text content block ordering for visual context"
  - "Agent concurrency pool: queue -> process -> drain pattern with AbortController per task"
  - "SDK message filtering: ignore all but init/result to prevent flooding downstream"

requirements-completed: [CLAUD-01, CLAUD-02, CLAUD-03, CLAUD-04]

# Metrics
duration: 7min
completed: 2026-04-04
---

# Phase 4 Plan 1: Prompt Assembly + AgentManager Summary

**Prompt assembler encodes screenshot/DOM/instruction into Agent SDK content blocks; AgentManager orchestrates max-3 parallel Claude agents with full task lifecycle tracking**

## Performance

- **Duration:** 7 min
- **Started:** 2026-04-04T12:54:58Z
- **Completed:** 2026-04-04T13:02:00Z
- **Tasks:** 2
- **Files created:** 4

## Accomplishments
- assemblePrompt converts instruction + screenshot Buffer + DomExtractionResult into single-message AsyncIterable with text/image/text content blocks for Agent SDK
- AgentManager manages task lifecycle (queued -> sending -> editing -> done/error) with max 3 parallel agents, queue drain, and AbortController cleanup
- SDK error messages mapped to human-readable strings (authentication, rate limit, billing, server errors)
- Retry creates new task with original instruction; dismiss aborts active queries; shutdown cleans up all resources
- Full TDD: 21 new tests (9 prompt + 12 agent-manager), 172 total tests passing

## Task Commits

Each task was committed atomically:

1. **Task 1: Prompt assembly module** - `6179b2e` (test: RED) + `27f2959` (feat: GREEN)
2. **Task 2: AgentManager class** - `c44368c` (test: RED) + `c3d85d3` (feat: GREEN)

_TDD tasks have two commits each (test -> implementation)_

## Files Created/Modified
- `src/main/prompt.ts` - Prompt assembly: instruction + screenshot + DOM -> AsyncIterable<SDKUserMessage>
- `src/main/agent-manager.ts` - AgentManager class with concurrency pool, task lifecycle, error handling
- `tests/main/prompt.test.ts` - 9 tests for content block structure, encoding, edge cases
- `tests/main/agent-manager.test.ts` - 12 tests for lifecycle, concurrency, retry, dismiss, shutdown

## Decisions Made
- AsyncIterable<SDKUserMessage> prompt format matches Agent SDK query() streaming input signature
- Max 3 parallel agents with processQueue drain pattern prevents query process accumulation (per 04-RESEARCH Pitfall 2)
- Only react to system.init and result SDK messages, ignore all others to prevent IPC flooding (per 04-RESEARCH Pitfall 3)
- humanReadableError function maps known SDK error substrings to friendly messages with sensible default fallback
- systemPrompt uses preset 'claude_code' with append for claw-design context
- permissionMode set to 'acceptEdits' for autonomous file editing
- persistSession set to false for ephemeral task-based workflows

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed mock reset in agent-manager tests**
- **Found during:** Task 2 (AgentManager tests GREEN phase)
- **Issue:** vi.clearAllMocks() in beforeEach was clearing the vi.mock factory implementation, causing tests that relied on mockQueryMessages to fail silently (query returned undefined)
- **Fix:** Replaced vi.clearAllMocks() with explicit mock re-implementation in beforeEach that restores the default mock reading from mockQueryMessages
- **Files modified:** tests/main/agent-manager.test.ts
- **Verification:** All 12 agent-manager tests pass
- **Committed in:** c3d85d3 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug in test setup)
**Impact on plan:** Test infrastructure fix only. No scope creep.

## Issues Encountered
None beyond the mock reset issue documented above.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - both modules are fully implemented with all planned functionality.

## Next Phase Readiness
- Prompt assembly and AgentManager ready for Plan 02 (IPC bridge wiring)
- AgentManager.setOnTaskUpdate callback is the integration point for IPC status routing
- assemblePrompt is imported by AgentManager internally; no external wiring needed
- Task/TaskUpdate types ready for serialization over Electron IPC

## Self-Check: PASSED

All 4 source/test files exist. All 4 commit hashes verified in git log.

---
*Phase: 04-claude-code-integration*
*Completed: 2026-04-04*
