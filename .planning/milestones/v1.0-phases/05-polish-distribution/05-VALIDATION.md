---
phase: 5
slug: polish-distribution
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-06
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.0.0 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | ELEC-03 | T-05-02 | Whitelist viewport preset values | unit | `npx vitest run tests/main/viewport.test.ts -t "bounds"` | ❌ W0 | ⬜ pending |
| 05-01-02 | 01 | 1 | ELEC-03 | — | N/A | unit | `npx vitest run tests/main/viewport.test.ts -t "desktop"` | ❌ W0 | ⬜ pending |
| 05-01-03 | 01 | 1 | ELEC-03 | — | N/A | unit | `npx vitest run tests/main/viewport.test.ts -t "smaller"` | ❌ W0 | ⬜ pending |
| 05-01-04 | 01 | 1 | ELEC-03 | — | N/A | unit | `npx vitest run tests/main/viewport.test.ts -t "animate"` | ❌ W0 | ⬜ pending |
| 05-02-01 | 02 | 2 | D-14 | — | N/A | unit | `npx vitest run tests/cli/preflight.test.ts -t "node"` | ❌ W0 | ⬜ pending |
| 05-02-02 | 02 | 2 | D-14 | — | N/A | unit | `npx vitest run tests/cli/preflight.test.ts -t "electron"` | ❌ W0 | ⬜ pending |
| 05-03-01 | 03 | 2 | D-09 | T-05-01 | Use textContent not innerHTML | unit | `npx vitest run tests/renderer/toast.test.ts -t "auto-dismiss"` | ❌ W0 | ⬜ pending |
| 05-04-01 | 04 | 3 | D-17 | — | N/A | unit | `npx vitest run tests/cli/start.test.ts -t "version"` | ❌ W0 | ⬜ pending |
| 05-04-02 | 04 | 3 | D-12/D-13 | — | N/A | unit | `npx vitest run tests/cli/package.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/main/viewport.test.ts` — stubs for ELEC-03 viewport bounds calculation and animation
- [ ] `tests/cli/preflight.test.ts` — stubs for D-14 pre-flight checks
- [ ] `tests/renderer/toast.test.ts` — stubs for D-09 toast rendering and auto-dismiss logic
- [ ] `tests/cli/package.test.ts` — stubs for D-12/D-13 package.json structure validation

*(Existing test infrastructure: 14 test files, 185 tests, all passing. Vitest config and patterns well established.)*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Viewport animation smoothness | D-05 | Visual timing perception | Switch presets, confirm 200-300ms ease transition appears smooth |
| Splash screen appearance | D-21 | Visual design validation | Start with dev server, confirm branded splash with loading indicator |
| Tooltip hover behavior | D-22 | Hover timing UX | Hover toolbar icons, confirm tooltips appear after delay |
| Dark surround aesthetic | D-06 | Visual design | Switch to tablet/mobile, confirm #1a1a1a surround matches overlay aesthetic |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
