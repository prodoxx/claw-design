---
phase: 3
slug: selection-overlay-capture
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-04
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.x |
| **Config file** | `vitest.config.ts` or "none — Wave 0 installs" |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | SEL-01 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 1 | SEL-02 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 03-01-03 | 01 | 1 | SEL-03 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 03-01-04 | 01 | 1 | SEL-04 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 2 | CAP-01 | manual | visual | N/A | ⬜ pending |
| 03-02-02 | 02 | 2 | CAP-02 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 03-02-03 | 02 | 2 | CAP-03 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 03-03-01 | 03 | 2 | INST-01 | manual | visual | N/A | ⬜ pending |
| 03-03-02 | 03 | 2 | INST-02 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 03-03-03 | 03 | 2 | INST-03 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Vitest installed and configured (if not already from Phase 1)
- [ ] `tests/overlay/` directory for overlay unit tests
- [ ] Test stubs for selection state machine transitions
- [ ] Test stubs for DPI coordinate calculations
- [ ] Test stubs for DOM serialization

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Freeform rectangle renders visually correct | SEL-01 | Visual rendering verification | Draw rectangle, verify rounded border + tint overlay appears |
| Element hover highlight tracks cursor | SEL-02 | Requires Electron window + mouse events | Hover over elements, verify highlight follows cursor |
| Input bar positions near selection | INST-01 | Visual positioning depends on viewport | Create selections at various positions, verify input bar placement |
| Screenshot captures correct region on HiDPI | CAP-01 | Requires HiDPI display validation | Capture region on Retina display, verify pixel-perfect bounds |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
