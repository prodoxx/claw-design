---
status: partial
phase: 06-wire-retry-prefill-cleanup
source: [06-VERIFICATION.md]
started: 2026-04-07T14:02:00Z
updated: 2026-04-07T14:02:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Retry-prefill UI flow
expected: Launch app, submit a task that errors, click Retry in sidebar. Overlay activates with the original instruction prefilled in the textarea at a centered position (50% horizontal, 60% height). User can immediately edit the text and draw a new selection to re-submit.
result: [pending]

### 2. Edit and resubmit after prefill
expected: After prefill, draw a selection, edit the instruction, click Submit. A new task is created with the modified instruction. The original error task is gone from the sidebar.
result: [pending]

### 3. Escape cancels prefill
expected: After prefill, press Escape. Overlay deactivates. Prefilled instruction is discarded (documented acceptable behavior for v1.0).
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
