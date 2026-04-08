---
phase: 01-cli-foundation-process-lifecycle
verified: 2026-04-03T23:00:00Z
status: human_needed
score: 10/10 must-haves verified
re_verification: false
human_verification:
  - test: "Run `npx tsx src/cli/index.ts start` in a real project directory that has a dev server (e.g., a Vite or Next.js project)"
    expected: "Spinner progress shows each step: Claude check, dev server detection, spawn, port detection, port readiness, Claude session launch, then 'Ready!' message"
    why_human: "Requires a real dev server running on localhost and Claude Code installed in PATH — cannot simulate in automated checks"
  - test: "After `clawdesign start` is running, press Ctrl+C"
    expected: "Terminal prints 'Shutting down (SIGINT)...', all child processes terminate, no zombie processes remain (verify with `lsof -i :<port>` returning empty)"
    why_human: "Clean shutdown with no orphan processes requires observing real process trees — not verifiable statically"
  - test: "Run `npx tsx src/cli/index.ts start --verbose` in a real project"
    expected: "Dev server stdout/stderr is piped to the terminal alongside spinner output"
    why_human: "Requires observing live terminal output with a running dev server"
  - test: "Run `npx tsx src/cli/index.ts start --cmd 'python -m http.server 8080'` in any directory"
    expected: "Detects port 8080 from stdout and does NOT call auto-detection from package.json"
    why_human: "Requires running a real custom command and observing live port detection behavior"
---

# Phase 1: CLI Foundation & Process Lifecycle Verification Report

**Phase Goal:** User can run `clawdesign start` to launch their dev server with auto-detection, and all processes shut down cleanly on exit
**Verified:** 2026-04-03T23:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can run `clawdesign start` in a project directory and the dev server starts automatically (detected from package.json) | VERIFIED | `detectDevServerScript` reads package.json, iterates `SCRIPT_PRIORITY = ['dev','start','serve']`, wired into `startCommand` Step 2; 14 passing detection tests |
| 2 | User can override the dev server command with `clawdesign start --cmd "yarn dev"` and it uses that command instead | VERIFIED | `--cmd <command>` option declared in `src/cli/index.ts:20`; `options.cmd` branch in `start.ts:33-35` bypasses auto-detection; integration test confirms `detectDevServerScript` not called |
| 3 | CLI detects when the dev server is ready (port is listening) before proceeding | VERIFIED | `extractPortFromOutput` + `waitForPort` with TCP polling (250ms interval, 30s default timeout) via `node:net.createConnection`; all port tests pass |
| 4 | When user presses Ctrl+C, all child processes (dev server, Claude Code) terminate with no orphan/zombie processes | VERIFIED (automated) / NEEDS HUMAN (real behavior) | `registerShutdownHandlers` calls `tree-kill` on both `devServer.pid` and `claudeSession.close()`; idempotent `shuttingDown` flag; SIGINT/SIGTERM both registered; force-exit timeout `setTimeout(5000).unref()`; 8 passing process tests — real orphan check needs human |
| 5 | CLI works with any web framework's dev server without framework-specific config | VERIFIED | `PORT_PATTERNS` covers Vite (`Local: http://localhost:5173/`), Next.js (`started server on 0.0.0.0:3000`), Webpack/CRA (`Port 8080`, `port: 3000`, `listening on port 4000`), and generic URL formats; `detectPackageManager` added for bun/pnpm/npm; 16 pattern tests pass |

**Score:** 5/5 truths verified (4 fully automated, 1 requires human confirmation for real orphan-process behavior)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `package.json` | Project manifest with bin field, `type: module`, dependencies | VERIFIED | `"bin": {"clawdesign": "./dist/cli/index.js"}`, `"type": "module"`, all required deps present |
| `src/cli/index.ts` | CLI entry point with commander program | VERIFIED | Shebang present, `new Command().name('clawdesign')`, `start` command wired to `startCommand` |
| `src/cli/commands/start.ts` | Complete 7-step start command (min 80 lines) | VERIFIED | 186 lines; all 7 steps implemented with error handling, spinners, and clean shutdown |
| `src/cli/utils/dev-server.ts` | Dev server detection and spawning | VERIFIED | Exports `SCRIPT_PRIORITY`, `DetectionError`, `detectDevServerScript`, `spawnDevServer`, `detectPackageManager` |
| `src/cli/utils/port-detect.ts` | Port extraction and TCP polling | VERIFIED | Exports `PORT_PATTERNS`, `extractPortFromOutput`, `waitForPort`, `getProcessOnPort`; `createConnection` from `node:net` |
| `src/cli/utils/claude.ts` | Claude Code session management | VERIFIED | Exports `isClaudeInstalled`, `ClaudeSession`, `spawnClaudeSession`; uses Agent SDK with `preset: 'claude_code'` |
| `src/cli/utils/process.ts` | Graceful shutdown coordination | VERIFIED | Exports `ManagedProcesses`, `registerShutdownHandlers`, `resetShutdownState`; imports `tree-kill`; idempotent `shuttingDown` flag |
| `src/cli/utils/output.ts` | Terminal output helpers | VERIFIED | Exports `createSpinner`, `printHeader`, `printReady`, `printError` using `ora` and `picocolors` |
| `tests/cli/dev-server.test.ts` | 7+ tests for detection logic | VERIFIED | 14 tests pass (includes `detectPackageManager` tests added by user request) |
| `tests/cli/port-detect.test.ts` | 12+ tests for port patterns and TCP | VERIFIED | 19 tests pass covering all URL variants, dev server formats, TCP timeout and success |
| `tests/cli/claude.test.ts` | 4+ tests for Claude installed check | VERIFIED | 6 tests pass |
| `tests/cli/process.test.ts` | 5+ tests for shutdown coordination | VERIFIED | 8 tests pass |
| `tests/cli/start.test.ts` | 7+ integration tests for start command | VERIFIED | 9 tests pass (2 extra for package manager detection) |

---

### Key Link Verification

#### Plan 01-01 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/cli/index.ts` | `src/cli/commands/start.ts` | `import startCommand` | WIRED | Line 5: `import { startCommand } from './commands/start.js'` |
| `src/cli/commands/start.ts` | `src/cli/utils/dev-server.ts` | `import detection + spawning` | WIRED | Line 1: `import { detectDevServerScript, detectPackageManager, spawnDevServer, DetectionError }` |
| `package.json` | `src/cli/index.ts` | `bin.clawdesign` | WIRED | `"clawdesign": "./dist/cli/index.js"` — compiled entry points to CLI |

#### Plan 01-02 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/cli/utils/port-detect.ts` | `node:net` | `createConnection` for TCP polling | WIRED | Line 1: `import { createConnection } from 'node:net'`; used in `waitForPort` |
| `src/cli/utils/process.ts` | `tree-kill` | `import kill from tree-kill` | WIRED | Line 1: `import kill from 'tree-kill'`; called at lines 38, 43 |
| `src/cli/utils/claude.ts` | `@anthropic-ai/claude-agent-sdk` | `import query` | WIRED | Line 1: `import { query, type Query } from '@anthropic-ai/claude-agent-sdk'`; used in `spawnClaudeSession` |

#### Plan 01-03 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/cli/commands/start.ts` | `src/cli/utils/dev-server.ts` | `import detectDevServerScript, spawnDevServer` | WIRED | Line 1 import; called at lines 38, 60 |
| `src/cli/commands/start.ts` | `src/cli/utils/port-detect.ts` | `import extractPortFromOutput, waitForPort` | WIRED | Line 2 import; called at lines 81, 132 |
| `src/cli/commands/start.ts` | `src/cli/utils/claude.ts` | `import isClaudeInstalled, spawnClaudeSession` | WIRED | Line 3 import; called at lines 20, 162 |
| `src/cli/commands/start.ts` | `src/cli/utils/process.ts` | `import registerShutdownHandlers` | WIRED | Line 4 import; called at line 174 |
| `src/cli/commands/start.ts` | `src/cli/utils/output.ts` | `import createSpinner, printReady, printError` | WIRED | Line 5 import; used throughout for spinner/error/ready output |

---

### Data-Flow Trace (Level 4)

These are CLI utility modules, not UI components rendering dynamic data from a store or API. The "data flow" is process I/O (stdout chunks, TCP sockets, child process PIDs). The relevant checks are verified by the wiring above and by test coverage.

| Flow | Source | Produces Real Data | Status |
|------|--------|--------------------|--------|
| Port number from dev server stdout | `devServer.stdout` event → `extractPortFromOutput` → `waitForPort` | Yes — TCP poll confirms port is actually open | FLOWING |
| `devServer.pid` to shutdown handler | `spawnDevServer()` return → `devServer.pid` → `registerShutdownHandlers({ devServer: { pid } })` → `kill(pid, ...)` | Yes — real ChildProcess PID passed through | FLOWING |
| Claude session close to shutdown handler | `spawnClaudeSession()` → `ClaudeSession.close` → `registerShutdownHandlers({ claudeSession: claude })` | Yes — closure returned from Agent SDK wired into coordinator | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `--version` prints version number | `npx tsx src/cli/index.ts --version` | `0.1.0` | PASS |
| `--help` shows `start` command | `npx tsx src/cli/index.ts --help` | Shows `start [options]  Launch dev server and open visual editor` | PASS |
| TypeScript compiles without errors | `npx tsc --noEmit` | Exit code 0, no output | PASS |
| All 56 unit + integration tests pass | `npx vitest run --reporter=verbose` | `5 passed (5)`, `56 passed (56)` | PASS |

---

### Requirements Coverage

All 10 requirement IDs declared across the 3 phase plans are verified against the codebase:

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|---------------|-------------|--------|----------|
| CLI-01 | 01-01, 01-03 | User can run `clawdesign start` | SATISFIED | `src/cli/index.ts` registers `start` command; `startCommand` orchestrates full flow; `--help` confirms |
| CLI-02 | 01-01 | Auto-detect dev server from package.json (dev > start > serve) | SATISFIED | `detectDevServerScript` + `SCRIPT_PRIORITY = ['dev','start','serve']`; 7 detection tests pass |
| CLI-03 | 01-01 | `--cmd` flag override | SATISFIED | `--cmd <command>` option + `if (options.cmd)` branch in `startCommand`; integration test confirms bypass |
| CLI-04 | 01-02, 01-03 | Spawn dev server as child process, detect when ready | SATISFIED | `spawnDevServer` (shell:true, piped stdio) + `extractPortFromOutput` + `waitForPort` (TCP polling) |
| CLI-05 | 01-02, 01-03 | Spawn Claude Code session | SATISFIED | `spawnClaudeSession` using Agent SDK streaming input mode with async generator queue |
| PROC-01 | 01-02, 01-03 | Graceful shutdown of all child processes | SATISFIED | `registerShutdownHandlers` with idempotent `shuttingDown` flag, ordered teardown |
| PROC-02 | 01-02 | Dev server process tree fully killed (no zombies) | SATISFIED | `tree-kill` called with `devServer.pid` (not `process.kill`) — kills entire process tree |
| PROC-03 | 01-02, 01-03 | SIGINT/SIGTERM handled | SATISFIED | `process.on('SIGINT', ...)` and `process.on('SIGTERM', ...)` both registered in `registerShutdownHandlers` |
| FRAME-01 | 01-02, 01-03 | Works with any web framework | SATISFIED | `PORT_PATTERNS` regex array covers Vite, Next.js, Webpack, CRA, generic formats; 16 extraction tests pass |
| FRAME-02 | 01-01, 01-03 | No framework-specific plugins required | SATISFIED | Pure stdout regex + TCP polling approach — no framework integration points |

**Note on REQUIREMENTS.md status field:** CLI-02 and CLI-03 are marked `[ ]` (unchecked) and "Pending" in REQUIREMENTS.md even though the implementation is complete. This is a documentation inconsistency — the code satisfies these requirements fully. REQUIREMENTS.md needs its checkboxes and traceability table updated to mark CLI-02 and CLI-03 as complete.

**Orphaned requirements check:** No requirements mapped to Phase 1 in REQUIREMENTS.md are unaccounted for. All 10 IDs (CLI-01 through CLI-05, PROC-01 through PROC-03, FRAME-01, FRAME-02) are addressed by the plans and verified in the codebase.

---

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `src/main/index.ts` | `// Electron main process - implemented in Phase 2` + `export {}` | Info | Intentional stub for Phase 2; does not affect Phase 1 goals |
| `src/preload/index.ts` | `// Electron preload script - implemented in Phase 2` + `export {}` | Info | Intentional stub for Phase 2; does not affect Phase 1 goals |
| `src/renderer/index.html` | Minimal placeholder HTML | Info | Intentional stub for Phase 2; does not affect Phase 1 goals |

No blockers or warnings found. The three stubs above are explicitly scoped to Phase 2 per the plan and documented in Plan 01-01 SUMMARY as intentional.

---

### Human Verification Required

#### 1. Full End-to-End Startup Flow

**Test:** Navigate to a real web project (e.g., a Vite or Next.js app), run `npx tsx /path/to/claw-design/src/cli/index.ts start`
**Expected:** Terminal shows sequential spinner steps — Claude Code check, dev server detection from package.json, spawn confirmation, port detection from stdout, TCP readiness confirmation, Claude session launch, then "Ready!" with the localhost URL
**Why human:** Requires a running dev server on localhost and Claude Code installed in PATH — full integration cannot be mocked in automated tests

#### 2. Clean Shutdown with No Orphan Processes

**Test:** After the startup flow completes, press Ctrl+C
**Expected:** Terminal prints `Shutting down (SIGINT)...`, then exits cleanly. Running `lsof -i :<detected-port>` immediately after exit returns no results.
**Why human:** Verifying that `tree-kill` actually terminates the full process tree (including grandchild processes spawned by the dev server) requires observing real OS process state

#### 3. Verbose Flag Output

**Test:** Run `clawdesign start --verbose` in a real project
**Expected:** Dev server's own stdout/stderr (e.g., Vite's compilation output, module count) appears in the terminal alongside the spinner progress
**Why human:** Requires a running dev server to produce observable output

#### 4. Custom Command Override

**Test:** Run `clawdesign start --cmd 'python -m http.server 8080'` in any directory
**Expected:** CLI uses `python -m http.server 8080` directly, skips package.json detection, detects port 8080 from output, confirms readiness via TCP
**Why human:** Requires running a real HTTP server and observing live stdout parsing behavior

---

### Gaps Summary

No gaps found. All 10 required artifacts pass all three automated verification levels (exists, substantive, wired) and data-flow traces confirm real data moves through every critical path. All 56 tests pass. TypeScript compiles cleanly. CLI responds correctly to `--version` and `--help`.

The only outstanding items are the 4 human verification scenarios above, which require a real dev server and Claude Code in PATH. These are quality-of-life/integration checks — the underlying implementation is complete and correct per all automated evidence.

**Documentation note:** REQUIREMENTS.md checkboxes for CLI-02 and CLI-03 should be updated to `[x]` and their traceability rows changed from "Pending" to "Complete" to reflect the actual implementation state.

---

_Verified: 2026-04-03T23:00:00Z_
_Verifier: Claude (gsd-verifier)_
