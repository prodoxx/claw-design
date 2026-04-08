---
phase: 4
slug: claude-code-integration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-04
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.0.0 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | CLAUD-01 | unit | `npx vitest run tests/main/prompt.test.ts -t "assemblePrompt" -x` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 1 | CLAUD-01 | unit | `npx vitest run tests/main/agent-manager.test.ts -t "submitTask" -x` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 1 | CLAUD-02 | unit (mock query) | `npx vitest run tests/main/agent-manager.test.ts -t "executeTask" -x` | ❌ W0 | ⬜ pending |
| 04-02-02 | 02 | 1 | CLAUD-03 | unit | `npx vitest run tests/main/agent-manager.test.ts -t "status" -x` | ❌ W0 | ⬜ pending |
| 04-02-03 | 02 | 1 | CLAUD-03 | unit (mock webContents) | `npx vitest run tests/main/agent-manager.test.ts -t "emitTaskUpdate" -x` | ❌ W0 | ⬜ pending |
| 04-03-01 | 03 | 2 | CLAUD-04 | unit | `npx vitest run tests/main/agent-manager.test.ts -t "error" -x` | ❌ W0 | ⬜ pending |
| 04-03-02 | 03 | 2 | CLAUD-04 | unit | `npx vitest run tests/main/agent-manager.test.ts -t "retry" -x` | ❌ W0 | ⬜ pending |
| 04-02-04 | 02 | 1 | D-15 | unit | `npx vitest run tests/main/agent-manager.test.ts -t "concurrency" -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/main/prompt.test.ts` — stubs for CLAUD-01 prompt assembly (assemblePrompt, content block structure)
- [ ] `tests/main/agent-manager.test.ts` — stubs for CLAUD-01 through CLAUD-04, D-15 concurrency limit
- [ ] `tests/main/sidebar-state.test.ts` — stubs for sidebar state machine (hidden/minimized/expanded)
- [ ] Mock for `@anthropic-ai/claude-agent-sdk` `query()` — needed since real agent spawns are expensive

*Existing infrastructure: Vitest already configured from Phase 1. No new framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| HMR reflects Claude edits in Electron window | CLAUD-02 | Requires running dev server + Electron + real file edits | Start app with `clawdesign start`, submit instruction, observe site updates |
| Sidebar expand/collapse animation | CLAUD-03 | Visual animation timing cannot be unit tested | Verify 200ms expand, 150ms collapse, smooth slide |
| Sidebar auto-minimize during selection mode | D-08 | Requires full Electron IPC + overlay interaction | Enter selection mode, verify sidebar minimizes |
| Badge pulse on completion/error | D-07 | Visual effect requires rendering | Submit task, minimize sidebar, verify pulse on completion |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
