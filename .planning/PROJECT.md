# claw-design

## What This Is

A visual web development tool that lets developers point at parts of their running website and describe changes in natural language. Claw opens the user's localhost site in an Electron window with a selection overlay, captures screenshot + DOM context of selected regions, and sends instructions to a Claude Code session that edits the source code directly. Changes appear live via the dev server's hot module reload.

## Core Value

Developers can visually select any part of their running website and describe changes in plain English — Claude edits the code, HMR shows the result. No context-switching between browser and editor.

## Requirements

### Validated

- [x] CLI entry point (`clawdesign start`) that orchestrates the full workflow — Validated in Phase 1
- [x] Auto-detect dev server start command from package.json with manual override (`--cmd`) — Validated in Phase 1
- [x] Auto-detect package manager (npm/pnpm/bun) from lockfiles — Validated in Phase 1
- [x] Spawn and manage the user's dev server as a child process — Validated in Phase 1
- [x] Spawn and manage a Claude Code CLI session pointed at the codebase — Validated in Phase 1
- [x] Electron app that loads the user's localhost URL — Validated in Phase 2
- [x] Transparent overlay layer with toolbar (drag handle + selection button) — Validated in Phase 2

- [x] Freeform region selection overlay (draw a box around any area) — Validated in Phase 3
- [x] Element hover/click selection (inspect-style element detection) — Validated in Phase 3
- [x] Capture screenshot of selected region — Validated in Phase 3
- [x] Capture DOM elements within selected region (structure, classes, IDs, text content) — Validated in Phase 3
- [x] Input box appears after selection for the user to describe desired changes — Validated in Phase 3

- [x] Send screenshot + DOM context + user instruction to Claude Code session — Validated in Phase 4
- [x] Claude Code edits source files based on the visual context and instruction — Validated in Phase 4
- [x] Dev server HMR reflects changes without manual refresh — Validated in Phase 4
- [x] Framework agnostic — works with any web framework/stack — Validated in Phase 1
- [x] Open source (public repository, OSS license) — Validated in Phase 7

### Active

(No active requirements — v1.0 shipped. See v2 requirements in archived REQUIREMENTS.md.)

### Out of Scope

- In-app undo/redo — users have git for reverting changes
- Single-element click selection — freeform region covers this use case
- Mobile device preview — desktop browser viewport only for v1
- Deployment or hosting features — this is a local development tool
- Non-web projects — scoped to web development with a localhost dev server

## Context

- **v1.0 shipped 2026-04-08.** 4,581 LOC TypeScript, 234 tests, 7 phases, 21 plans.
- The tool bridges the gap between "seeing" a problem in the browser and "fixing" it in code. Developers mentally map DOM elements to source files — Claw eliminates that translation step.
- Claude Code handles codebase navigation, file editing, and multi-file changes via Agent SDK. Claw adds a visual selection layer on top.
- Framework agnosticism works because Claude Code handles any codebase. DOM capture is framework-independent.
- Electron chosen over Chrome extension for CLI-first workflow (`clawdesign start`) — one command controls everything.
- Dev server's own HMR handles reflecting changes — no custom reload mechanism needed.

## Constraints

- **Platform**: Electron for the browser window — needed for overlay control and tight CLI integration
- **Claude integration**: Spawns Claude Code CLI as subprocess — requires user to have Claude Code installed
- **Dev server**: Must support localhost URLs — the tool is for local development only
- **Open source**: License and repo structure must support community contributions

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Electron over Chrome extension | CLI-first flow means one command controls everything; no separate extension install needed | Validated Phase 2 |
| BaseWindow + dual WebContentsView | Site view (sandboxed) + transparent overlay view; bounds-toggle for mouse passthrough | Validated Phase 2 |
| setBackgroundColor on View, not WebContents | Electron 36 API — method lives on View base class | Validated Phase 2 |
| Freeform region + element selection (both modes) | Rectangle captures area intent; element mode adds precision; user chooses per interaction | Validated Phase 3 |
| Screenshot + DOM for context | Gives Claude both visual and structural understanding of what the user is pointing at | Validated Phase 3 |
| Preload scripts must build as CJS | Electron preload rejects ESM import statements; electron-vite config needs format: 'cjs' | Validated Phase 3 |
| Near-invisible overlay background for hit-testing | Chromium skips hit-testing on fully transparent views; rgba(0,0,0,0.01) provides surface | Validated Phase 3 |
| Spawn Claude Code CLI (not API) | Leverages Claude Code's existing codebase navigation, tool use, and multi-file editing | Validated Phase 4 |
| Framework agnostic from v1 | Claude Code already handles any codebase; DOM capture is framework-independent | Validated Phase 1 |
| No undo for v1 | Git provides undo capability; building custom undo adds complexity without core value | Validated v1.0 |
| Agent SDK for Claude integration | Structured message passing, streaming, multi-turn support vs raw child_process | Validated Phase 4 |
| Vertical pill toolbar with drag handle | Compact, movable UI that doesn't obstruct site content | Validated Phase 2 |
| Branded postinstall for macOS | Patches Electron.app Info.plist and icon for "Claw Design" branding in dev mode | Validated Phase 7 |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-08 after v1.0 milestone*
