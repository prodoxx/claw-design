---
phase: 1
slug: cli-foundation-process-lifecycle
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-03
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^4.x |
| **Config file** | vitest.config.ts (created in Plan 01, Task 1) |
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
| 01-01-01 | 01 | 1 | CLI-01, CLI-02, CLI-03, FRAME-02 | config | `node --input-type=module -e "import { readFileSync } from 'fs'; const p = JSON.parse(readFileSync('./package.json', 'utf8')); console.log(p.name, p.type, p.bin.clawdesign);" && npx tsc --noEmit` | W0 (creates vitest.config.ts + npm install) | pending |
| 01-01-02 | 01 | 1 | CLI-01, CLI-02, CLI-03, FRAME-02 | unit | `npx vitest run tests/cli/dev-server.test.ts --reporter=verbose` | Created by task | pending |
| 01-02-01 | 02 | 2 | CLI-04, FRAME-01 | unit | `npx vitest run tests/cli/port-detect.test.ts --reporter=verbose` | Created by task | pending |
| 01-02-02 | 02 | 2 | CLI-05, PROC-01, PROC-02, PROC-03 | unit | `npx vitest run tests/cli/claude.test.ts tests/cli/process.test.ts --reporter=verbose` | Created by task | pending |
| 01-03-01 | 03 | 3 | CLI-01, CLI-04, CLI-05, PROC-01, FRAME-01, FRAME-02 | typecheck | `npx tsc --noEmit` | N/A (type check only; correctness verified by 01-03-02) | pending |
| 01-03-02 | 03 | 3 | CLI-01, CLI-04, CLI-05, PROC-01, PROC-03, FRAME-01, FRAME-02 | integration | `npx vitest run tests/cli/start.test.ts --reporter=verbose` | Created by task | pending |
| 01-03-03 | 03 | 3 | (all) | e2e + manual | `npx vitest run --reporter=verbose` | N/A (checkpoint) | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [x] `vitest` — installed as devDependency in Plan 01, Task 1 (`"vitest": "^4.0.0"`)
- [x] `vitest.config.ts` — created in Plan 01, Task 1 (test.include: `['tests/**/*.test.ts']`, test.globals: true)
- [x] `tests/` — test directory structure created starting in Plan 01, Task 2 (tests/cli/)

*Wave 0 infrastructure is fully provided by Plan 01, Task 1 (scaffolding). No separate Wave 0 task needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Ctrl+C kills all child processes | PROC-01, PROC-02 | Requires interactive terminal + process tree inspection | Run `clawdesign start`, press Ctrl+C, verify no orphan processes with `ps aux` |
| Dev server stdout visible with --verbose | CLI-04 | Requires visual terminal inspection | Run with --verbose, confirm dev server output streams to terminal |
| Spinner progress display | D-01 | Visual UI in terminal | Run `clawdesign start`, confirm step-by-step spinner output |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ready
