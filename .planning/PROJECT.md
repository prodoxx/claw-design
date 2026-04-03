# claw-design

## What This Is

A visual web development tool that lets developers point at parts of their running website and describe changes in natural language. Claw opens the user's localhost site in an Electron window with a selection overlay, captures screenshot + DOM context of selected regions, and sends instructions to a Claude Code session that edits the source code directly. Changes appear live via the dev server's hot module reload.

## Core Value

Developers can visually select any part of their running website and describe changes in plain English — Claude edits the code, HMR shows the result. No context-switching between browser and editor.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] CLI entry point (`claw start`) that orchestrates the full workflow
- [ ] Auto-detect dev server start command from package.json with manual override (`--cmd`)
- [ ] Spawn and manage the user's dev server as a child process
- [ ] Spawn and manage a Claude Code CLI session pointed at the codebase
- [ ] Electron app that loads the user's localhost URL
- [ ] Freeform region selection overlay (draw a box around any area)
- [ ] Capture screenshot of selected region
- [ ] Capture DOM elements within selected region (structure, classes, IDs, text content)
- [ ] Input box appears after selection for the user to describe desired changes
- [ ] Send screenshot + DOM context + user instruction to Claude Code session
- [ ] Claude Code edits source files based on the visual context and instruction
- [ ] Dev server HMR reflects changes without manual refresh
- [ ] Framework agnostic — works with any web framework/stack
- [ ] Open source (public repository, OSS license)

### Out of Scope

- In-app undo/redo — users have git for reverting changes
- Single-element click selection — freeform region covers this use case
- Mobile device preview — desktop browser viewport only for v1
- Deployment or hosting features — this is a local development tool
- Non-web projects — scoped to web development with a localhost dev server

## Context

- The tool bridges the gap between "seeing" a problem in the browser and "fixing" it in code. Today developers mentally map DOM elements to source files — Claw eliminates that translation step.
- Claude Code already handles codebase navigation, file editing, and multi-file changes. Claw adds a visual selection layer on top.
- Framework agnosticism is achievable because Claude Code already works with any codebase. The challenge is in DOM-to-source mapping, which Claude handles by searching the codebase using class names, text content, and component structure from the captured DOM.
- Electron is chosen over a Chrome extension because the CLI-first workflow (`claw start`) controls the entire experience — one command, no separate extension installation.
- The dev server's own HMR/live reload handles reflecting changes, so Claw doesn't need to implement its own reload mechanism.

## Constraints

- **Platform**: Electron for the browser window — needed for overlay control and tight CLI integration
- **Claude integration**: Spawns Claude Code CLI as subprocess — requires user to have Claude Code installed
- **Dev server**: Must support localhost URLs — the tool is for local development only
- **Open source**: License and repo structure must support community contributions

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Electron over Chrome extension | CLI-first flow means one command controls everything; no separate extension install needed | — Pending |
| Freeform region selection over single-element click | Captures user intent about an area, more flexible than DOM-element-level selection | — Pending |
| Screenshot + DOM for context | Gives Claude both visual and structural understanding of what the user is pointing at | — Pending |
| Spawn Claude Code CLI (not API) | Leverages Claude Code's existing codebase navigation, tool use, and multi-file editing | — Pending |
| Framework agnostic from v1 | Claude Code already handles any codebase; DOM capture is framework-independent | — Pending |
| No undo for v1 | Git provides undo capability; building custom undo adds complexity without core value | — Pending |

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
*Last updated: 2026-04-03 after initialization*
