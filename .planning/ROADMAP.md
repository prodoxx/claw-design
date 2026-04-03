# Roadmap: claw-design

## Overview

Claw-design delivers a visual web development tool in five phases following the natural dependency chain: CLI orchestrator and process lifecycle first (foundation everything depends on), then the Electron shell (secure browser window), then the selection overlay and capture pipeline (core visual interaction), then Claude Code integration (the AI editing loop), and finally polish and distribution (viewport switching, error UX, npm packaging). Each phase delivers a coherent, independently verifiable capability.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: CLI Foundation & Process Lifecycle** - Orchestrator that spawns/manages dev server with clean shutdown
- [ ] **Phase 2: Electron Shell** - Secure browser window loading the user's localhost site
- [ ] **Phase 3: Selection Overlay & Capture** - Visual selection, screenshot capture, DOM extraction, and instruction input
- [ ] **Phase 4: Claude Code Integration** - Send context to Claude Code, receive edits, show status feedback
- [ ] **Phase 5: Polish & Distribution** - Viewport switching, error UX, cross-platform packaging

## Phase Details

### Phase 1: CLI Foundation & Process Lifecycle
**Goal**: User can run `clawdesign start` to launch their dev server with auto-detection, and all processes shut down cleanly on exit
**Depends on**: Nothing (first phase)
**Requirements**: CLI-01, CLI-02, CLI-03, CLI-04, CLI-05, PROC-01, PROC-02, PROC-03, FRAME-01, FRAME-02
**Success Criteria** (what must be TRUE):
  1. User can run `clawdesign start` in a project directory and the dev server starts automatically (detected from package.json)
  2. User can override the dev server command with `clawdesign start --cmd "yarn dev"` and it uses that command instead
  3. CLI detects when the dev server is ready (port is listening) before proceeding
  4. When user presses Ctrl+C, all child processes (dev server, Claude Code) terminate with no orphan/zombie processes
  5. CLI works with any web framework's dev server (React, Vue, Svelte, plain HTML, etc.) without framework-specific config
**Plans**: 3 plans

Plans:
- [x] 01-01-PLAN.md -- Project scaffolding, CLI entry point, and dev server detection
- [x] 01-02-PLAN.md -- Port detection, Claude Code session management, and shutdown coordination
- [x] 01-03-PLAN.md -- Start command orchestration, integration tests, and end-to-end verification

### Phase 2: Electron Shell
**Goal**: User sees their running website in a secure Electron window with an overlay layer ready for interaction
**Depends on**: Phase 1
**Requirements**: CLI-06, ELEC-01, ELEC-02
**Success Criteria** (what must be TRUE):
  1. After dev server is ready, an Electron window opens showing the user's live website at the localhost URL
  2. The site's HMR/live-reload continues working inside the Electron window (code changes reflect without manual refresh)
  3. A transparent overlay layer renders on top of the site content (ready for selection UI in Phase 3)
**Plans**: 3 plans
**UI hint**: yes

Plans:
- [x] 02-01-PLAN.md -- Overlay renderer, preload scripts, and electron-vite multi-entry config
- [x] 02-02-PLAN.md -- Electron main process with BaseWindow, dual WebContentsView, navigation, and IPC
- [ ] 02-03-PLAN.md -- CLI integration (Electron build/spawn) and end-to-end verification

### Phase 3: Selection Overlay & Capture
**Goal**: User can visually select any part of their website, see the selection highlighted, and type a change instruction
**Depends on**: Phase 2
**Requirements**: SEL-01, SEL-02, SEL-03, SEL-04, CAP-01, CAP-02, CAP-03, INST-01, INST-02, INST-03
**Success Criteria** (what must be TRUE):
  1. User can draw a freeform rectangle over any area of their website and see it highlighted with a clear boundary
  2. User can click a single DOM element to select it (element highlights on hover)
  3. After selection, an input field appears where the user can type a multi-line change instruction and submit it
  4. Screenshot of the selected region is captured correctly on both standard and Retina/HiDPI displays
  5. DOM elements within the selected region are extracted (structure, classes, IDs, text content, hierarchy)
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 03-01: TBD
- [ ] 03-02: TBD
- [ ] 03-03: TBD

### Phase 4: Claude Code Integration
**Goal**: User's instruction with visual context reaches Claude Code, which edits source files, and the user sees changes via HMR
**Depends on**: Phase 3
**Requirements**: CLAUD-01, CLAUD-02, CLAUD-03, CLAUD-04
**Success Criteria** (what must be TRUE):
  1. Screenshot + DOM context + user instruction are assembled and sent to Claude Code as a structured prompt
  2. Claude Code edits source files based on the visual context and instruction, and HMR reflects the changes in the Electron window
  3. Status feedback shows the current state throughout the process (capturing, sending to Claude, Claude editing, changes applied)
  4. When Claude Code encounters an error, a clear message is shown in the overlay with an option to retry
**Plans**: TBD

Plans:
- [ ] 04-01: TBD
- [ ] 04-02: TBD
- [ ] 04-03: TBD

### Phase 5: Polish & Distribution
**Goal**: User can install claw-design globally via npm and use it as a polished, shippable tool with responsive viewport switching
**Depends on**: Phase 4
**Requirements**: ELEC-03
**Success Criteria** (what must be TRUE):
  1. User can switch between desktop, tablet, and mobile viewport sizes within the Electron window
  2. `npm install -g claw-design && clawdesign start` works end-to-end on a clean machine
  3. Error messages throughout the tool are human-readable with clear recovery actions (not stack traces or transport internals)
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 05-01: TBD
- [ ] 05-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. CLI Foundation & Process Lifecycle | 0/3 | Not started | - |
| 2. Electron Shell | 0/3 | Not started | - |
| 3. Selection Overlay & Capture | 0/3 | Not started | - |
| 4. Claude Code Integration | 0/3 | Not started | - |
| 5. Polish & Distribution | 0/2 | Not started | - |
