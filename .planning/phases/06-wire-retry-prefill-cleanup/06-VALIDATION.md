---
phase: 6
slug: wire-retry-prefill-cleanup
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-07
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.x |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run tests/cli/electron.test.ts -x` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/cli/electron.test.ts -x`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | SC-1 (prefill IPC) | — | IPC data from trusted AgentManager | integration | Manual verification (Electron IPC) | N/A | ⬜ pending |
| 06-01-02 | 01 | 1 | SC-2 (editable prefill) | — | N/A | manual | Visual verification in running app | N/A | ⬜ pending |
| 06-02-01 | 02 | 1 | SC-3 (dead code) | — | N/A | unit | `npx vitest run tests/cli/electron.test.ts -x` | ✅ | ⬜ pending |
| 06-02-02 | 02 | 1 | SC-3 (config cleanup) | — | N/A | build | `npx electron-vite build` | ✅ | ⬜ pending |
| 06-02-03 | 02 | 1 | regression | — | N/A | regression | `npx vitest run` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. The `tests/cli/electron.test.ts` file needs updating (remove dead tests, update assertions), not creation.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Retry prefills overlay textarea | SC-1 | Requires Electron IPC context with running overlay | 1. Submit a task that errors, 2. Click Retry in sidebar, 3. Verify overlay activates with prefilled instruction |
| Prefilled text is editable | SC-2 | Visual/interaction verification | 1. After prefill, modify text in textarea, 2. Submit, 3. Verify modified instruction was sent |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
