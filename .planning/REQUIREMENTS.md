# Requirements: claw-design

**Defined:** 2026-04-03
**Core Value:** Developers can visually select any part of their running website and describe changes in plain English — Claude edits the code, HMR shows the result.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### CLI

- [x] **CLI-01**: User can run `clawdesign start` in a project directory to launch the full workflow
- [ ] **CLI-02**: CLI auto-detects dev server start command from package.json (dev > start > serve)
- [ ] **CLI-03**: User can override dev server command with `--cmd` flag
- [x] **CLI-04**: CLI spawns dev server as child process and detects when it's ready (port listening)
- [x] **CLI-05**: CLI spawns Claude Code session pointed at the current codebase
- [ ] **CLI-06**: CLI opens Electron window loading the dev server's localhost URL

### Electron Window

- [ ] **ELEC-01**: Electron window loads user's localhost URL with proper security isolation (sandbox, contextIsolation)
- [ ] **ELEC-02**: Electron window renders selection overlay on top of the user's site content
- [ ] **ELEC-03**: User can switch between desktop, tablet, and mobile viewport sizes

### Selection

- [ ] **SEL-01**: User can draw a freeform rectangle over any area of the website to select a region
- [ ] **SEL-02**: User can click a single DOM element to select it (element highlights on hover)
- [ ] **SEL-03**: Selected region/element is visually highlighted with a clear boundary indicator
- [ ] **SEL-04**: User can re-select the same or nearby area to continue editing in context (iterative refinement)

### Capture

- [ ] **CAP-01**: Screenshot of the selected region is captured as an image
- [ ] **CAP-02**: DOM elements within the selected region are extracted (structure, classes, IDs, text content, hierarchy)
- [ ] **CAP-03**: Screenshot coordinates are DPI-aware (correct on Retina/HiDPI displays)

### Instruction

- [ ] **INST-01**: After selection, an input field appears where the user can type their change instruction
- [ ] **INST-02**: User can submit the instruction to send it to Claude Code
- [ ] **INST-03**: Input field supports multi-line text for complex instructions

### Claude Integration

- [ ] **CLAUD-01**: Screenshot + DOM context + user instruction are assembled into a prompt and sent to Claude Code
- [ ] **CLAUD-02**: Claude Code edits source files based on the visual context and instruction
- [ ] **CLAUD-03**: Status feedback shows current state: capturing, sending to Claude, Claude editing, changes applied
- [ ] **CLAUD-04**: When Claude Code encounters an error, a clear message is shown with an option to retry

### Process Lifecycle

- [x] **PROC-01**: All child processes (dev server, Claude Code, Electron) shut down gracefully on exit
- [x] **PROC-02**: Dev server process tree is fully killed (no zombie/orphan processes)
- [x] **PROC-03**: CLI handles SIGINT/SIGTERM for clean shutdown

### Framework Agnosticism

- [x] **FRAME-01**: Tool works with any web framework that serves on localhost (React, Vue, Svelte, Angular, Rails, Django, Laravel, plain HTML, etc.)
- [x] **FRAME-02**: No framework-specific plugins, middleware, or configuration required

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Batch Selection

- **BATCH-01**: User can queue multiple region selections before sending to Claude
- **BATCH-02**: Multiple selections are sent as a coordinated change request

### Reference Images

- **REF-01**: User can drag-and-drop a design image as reference for Claude
- **REF-02**: Reference image is included alongside screenshot in the Claude prompt

### CSS Inspection

- **CSS-01**: User can hold modifier key to inspect computed styles of elements
- **CSS-02**: Inspected style values can be copied to clipboard

### Session History

- **HIST-01**: Log of past instructions and changes is accessible during a session
- **HIST-02**: User can re-apply or reference previous instructions

### Git Safety

- **GIT-01**: Auto-commit current state before Claude makes changes (Aider pattern)
- **GIT-02**: Easy revert to pre-change state via CLI command

### Power User

- **KEY-01**: Keyboard shortcuts for selection mode, submit, cancel, viewport switch

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Built-in AI agent / LLM integration | Claw's value is the visual layer, not the AI — delegate to Claude Code |
| In-app code editor | Users have their IDE; Claw shows visual results, not code |
| Full design tool (Figma-like canvas) | Different product entirely; massive scope |
| Custom undo/redo system | Cursor's checkpoint bugs prove this is hard — git provides undo |
| Deployment / hosting | Local development tool only |
| Project scaffolding / app generation | Claw works with existing codebases |
| Multi-user collaboration | Single-developer tool; collaboration is premature |
| Non-web projects | Scoped to web development with localhost dev server |
| Chrome extension version | Electron gives full control; extension splits the experience |
| Framework-specific plugins | Framework agnosticism is a competitive advantage |
| Direct Claude API (bypassing Claude Code) | Claude Code handles codebase nav, file editing, tool use — don't reimplement |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CLI-01 | Phase 1 | Complete |
| CLI-02 | Phase 1 | Pending |
| CLI-03 | Phase 1 | Pending |
| CLI-04 | Phase 1 | Complete |
| CLI-05 | Phase 1 | Complete |
| CLI-06 | Phase 2 | Pending |
| ELEC-01 | Phase 2 | Pending |
| ELEC-02 | Phase 2 | Pending |
| ELEC-03 | Phase 5 | Pending |
| SEL-01 | Phase 3 | Pending |
| SEL-02 | Phase 3 | Pending |
| SEL-03 | Phase 3 | Pending |
| SEL-04 | Phase 3 | Pending |
| CAP-01 | Phase 3 | Pending |
| CAP-02 | Phase 3 | Pending |
| CAP-03 | Phase 3 | Pending |
| INST-01 | Phase 3 | Pending |
| INST-02 | Phase 3 | Pending |
| INST-03 | Phase 3 | Pending |
| CLAUD-01 | Phase 4 | Pending |
| CLAUD-02 | Phase 4 | Pending |
| CLAUD-03 | Phase 4 | Pending |
| CLAUD-04 | Phase 4 | Pending |
| PROC-01 | Phase 1 | Complete |
| PROC-02 | Phase 1 | Complete |
| PROC-03 | Phase 1 | Complete |
| FRAME-01 | Phase 1 | Complete |
| FRAME-02 | Phase 1 | Complete |

**Coverage:**
- v1 requirements: 28 total
- Mapped to phases: 28
- Unmapped: 0

---
*Requirements defined: 2026-04-03*
*Last updated: 2026-04-03 after roadmap creation*
