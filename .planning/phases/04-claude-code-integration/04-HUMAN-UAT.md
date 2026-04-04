---
status: partial
phase: 04-claude-code-integration
source: [04-VERIFICATION.md]
started: 2026-04-04T21:21:00Z
updated: 2026-04-04T21:21:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. End-to-end file edit + HMR
expected: Select a region, submit instruction, confirm source file changes and HMR applies the result
result: [pending]

### 2. Sidebar status sequence live
expected: Confirm Sending -> Editing -> Done transitions appear in sidebar with real Agent SDK streaming
result: [pending]

### 3. Error state + retry flow
expected: Trigger a real SDK error, confirm human-readable message appears, Retry prefills the textarea
result: [pending]

### 4. Clean shutdown under load
expected: Press Ctrl+C during active Claude edit, confirm no zombie processes remain
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
