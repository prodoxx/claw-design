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
- [ ] **Phase 6: Wire Retry Prefill & Tech Debt Cleanup** - Complete retry prefill flow, remove dead code
- [ ] **Phase 7: Open Source Readiness** - Branding, ownership, community files, README polish

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
- [x] 02-03-PLAN.md -- CLI integration (Electron build/spawn) and end-to-end verification

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
**Plans**: 3 plans
**UI hint**: yes

Plans:
- [x] 03-01-PLAN.md -- Selection state machine, drawing/highlight UI, element detection IPC, toolbar extension
- [x] 03-02-PLAN.md -- DPI-aware screenshot capture module, DOM extraction module, capture IPC handlers
- [x] 03-03-PLAN.md -- Instruction input bar, submit flow (capture + DOM + IPC), visual verification

### Phase 4: Claude Code Integration
**Goal**: User's instruction with visual context reaches Claude Code, which edits source files, and the user sees changes via HMR
**Depends on**: Phase 3
**Requirements**: CLAUD-01, CLAUD-02, CLAUD-03, CLAUD-04
**Success Criteria** (what must be TRUE):
  1. Screenshot + DOM context + user instruction are assembled and sent to Claude Code as a structured prompt
  2. Claude Code edits source files based on the visual context and instruction, and HMR reflects the changes in the Electron window
  3. Status feedback shows the current state throughout the process (capturing, sending to Claude, Claude editing, changes applied)
  4. When Claude Code encounters an error, a clear message is shown in the overlay with an option to retry
**Plans**: 3 plans
**UI hint**: yes

Plans:
- [x] 04-01-PLAN.md -- Prompt assembly module and AgentManager (concurrency, status tracking, error handling)
- [x] 04-02-PLAN.md -- Sidebar WebContentsView renderer, styles, preload, and state machine
- [ ] 04-03-PLAN.md -- Wire submit pipeline to AgentManager, sidebar IPC, retry/prefill flow, visual verification

### Phase 5: Polish & Distribution
**Goal**: User can install claw-design globally via npm and use it as a polished, shippable tool with responsive viewport switching
**Depends on**: Phase 4
**Requirements**: ELEC-03
**Success Criteria** (what must be TRUE):
  1. User can switch between desktop, tablet, and mobile viewport sizes within the Electron window
  2. `npm install -g claw-design && clawdesign start` works end-to-end on a clean machine
  3. Error messages throughout the tool are human-readable with clear recovery actions (not stack traces or transport internals)
**Plans**: 5 plans
**UI hint**: yes

Plans:
- [x] 05-01-PLAN.md -- Viewport switching: bounds computation, animation, IPC, toolbar buttons
- [x] 05-02-PLAN.md -- Pre-flight checks (Node version, Electron binary) and --version flag
- [x] 05-03-PLAN.md -- Toast notification system and dev server crash in-window alert
- [x] 05-04-PLAN.md -- Toolbar tooltips and branded splash screen
- [x] 05-05-PLAN.md -- npm packaging, README, LICENSE, and distribution files

### Phase 6: Wire Retry Prefill & Tech Debt Cleanup
**Goal**: Complete the retry-prefill-resubmit UX path and remove accumulated dead code from earlier phases
**Depends on**: Phase 4
**Requirements**: None (gap closure phase)
**Gap Closure**: Closes integration gap `prefill-dead-listener` and flow gap `retry-prefill-flow` from v1.0 audit
**Success Criteria** (what must be TRUE):
  1. Sidebar retry action sends `overlay:prefill-instruction` IPC to populate the overlay textarea with the previous instruction
  2. User can edit the prefilled instruction before re-submitting
  3. Dead code removed: `buildElectron` export, `CLAW_CWD` env var, stub `preload/index.ts`, placeholder `renderer/index.html`
**Plans**: 2 plans

Plans:
- [x] 06-01-PLAN.md -- Wire retry-prefill IPC flow (ipc-handlers.ts + overlay.ts prefill handler enhancement)
- [x] 06-02-PLAN.md -- Dead code removal (buildElectron, CLAW_CWD, preload/index.ts, renderer/index.html) and test updates

### Phase 7: Open Source Readiness
**Goal**: Prepare claw-design for public release under prodoxx GitHub with proper branding, ownership, and community files
**Depends on**: Phase 5
**Requirements**: None (open source readiness phase)
**Success Criteria** (what must be TRUE):
  1. All user-facing CLI strings say "Claw Design" instead of "Electron" (spinner text, success messages)
  2. `package.json` repository URL, homepage, and author point to `prodoxx/claw-design`
  3. `LICENSE` copyright holder updated to `prodoxx`
  4. `CONTRIBUTING.md` exists with contribution guidelines
  5. `CODE_OF_CONDUCT.md` exists
  6. `README.md` polished for public launch audience
**Plans**: 0 plans

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. CLI Foundation & Process Lifecycle | 0/3 | Not started | - |
| 2. Electron Shell | 0/3 | Not started | - |
| 3. Selection Overlay & Capture | 0/3 | Not started | - |
| 4. Claude Code Integration | 0/3 | Not started | - |
| 5. Polish & Distribution | 0/5 | Not started | - |
| 6. Wire Retry Prefill & Tech Debt Cleanup | 0/2 | Not started | - |
| 7. Open Source Readiness | 0/0 | Not started | - |
