# Phase 3: Selection Overlay & Capture - Context

**Gathered:** 2026-04-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Visual selection of website regions (freeform rectangle and element click), screenshot capture, DOM element extraction, and instruction input. This phase delivers the core interaction loop: select area -> type instruction -> submit. It does NOT include sending the instruction to Claude Code or showing edit progress (Phase 4).

</domain>

<decisions>
## Implementation Decisions

### Selection Modes & Switching
- **D-01:** Default mode is freeform rectangle. User clicks the select button in toolbar -> crosshair cursor -> draw a box.
- **D-02:** Element click is a secondary mode, toggled via a second button in the toolbar. Persistent until switched back.
- **D-03:** Cancel selection: both Escape key and clicking the toolbar select button again return overlay to inactive state. Multiple exit paths.
- **D-04:** Element hover detection is top-level document only for v1. No shadow DOM or iframe traversal.

### Selection Drawing Feel
- **D-05:** Selection rectangle style: rounded border with semi-transparent tint overlay on the selected content. Reference: Gemini's inline selection UI (user-provided screenshot).
- **D-06:** Element hover highlight uses the same rounded border + tint style as the rectangle selection. Consistent visual language across both modes.
- **D-07:** Color scheme: subtle light border (similar to the reference image's light blue/white rounded border) with a semi-transparent tint fill. Not a hard blue OS-style selection.

### Instruction Input UX
- **D-08:** Input bar appears inline near the selection — below if there's room, above if the selection is near the bottom of the window. Smart positioning adapts to available space.
- **D-09:** Dark input bar matching toolbar aesthetic: dark background (~88% opacity), white text, rounded corners. Consistent with the existing Claw toolbar and the Gemini reference.
- **D-10:** Auto-expanding input: starts as single-line, grows taller as user types more lines (up to a max height). Compact by default.
- **D-11:** Enter to submit, Shift+Enter for new line. Standard chat/prompt convention.

### Iterative Refinement
- **D-12:** After submitting an instruction, selection and input disappear. Overlay returns to inactive state. Clean slate each time.
- **D-13:** No selection memory — each selection is independent. No history, no ghost outlines. Claude Code's own conversation context provides continuity for iterative work on the same area.
- **D-14:** Concurrent edits allowed — after submit, user can immediately make another selection without waiting for Claude to finish the previous edit. Multiple instructions can be in-flight simultaneously (Phase 4 implements the subagent orchestration and task progress UI).

### Claude's Discretion
- Exact border color and opacity values for the selection rectangle/highlight
- Crosshair cursor implementation (CSS cursor vs custom drawn)
- Exact positioning algorithm for the smart input bar placement
- DOM extraction depth and serialization format (structure, classes, IDs, text content, hierarchy)
- DPI-aware screenshot coordinate calculation (devicePixelRatio handling)
- How element hover detection communicates across the two-view boundary (executeJavaScript on siteView)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Technology Stack
- `CLAUDE.md` — Full technology stack (Electron 36, electron-vite, TypeScript). Specifically: `webContents.capturePage()` for region screenshots, `NativeImage` for crop/format, `webContents.executeJavaScript()` for DOM extraction.

### Architecture
- `CLAUDE.md` "Key Technical Decisions" section — Screenshot as PNG buffer (not file), DOM context as serialized JSON (not HTML string)
- `.planning/STATE.md` — Research flag: transparent WebContentsView compositing artifact (electron/electron#42335) needs prototyping

### Prior Phase Context
- `.planning/phases/02-electron-shell/02-CONTEXT.md` — Window architecture (BaseWindow + dual WebContentsView), overlay bounds toggle pattern, toolbar placement decisions

### Requirements
- `.planning/REQUIREMENTS.md` — SEL-01 through SEL-04, CAP-01 through CAP-03, INST-01 through INST-03

### Known Issues
- Electron issue #42335 — Transparent WebContentsView compositing. If this blocks the overlay approach, fallback is injecting overlay via executeJavaScript (Phase 2 D-10).

### User-Provided Reference
- Gemini inline selection UI screenshot (provided during discussion) — Rounded border + tint overlay style, dark instruction input bar near selection. This is the target visual feel.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/main/window.ts` — `setOverlayActive()` / `setOverlayInactive()` already handle the overlay bounds toggle. Phase 3 calls these when entering/exiting selection mode.
- `src/main/ipc-handlers.ts` — `overlay:activate-selection` and `overlay:deactivate-selection` IPC handlers already wired. Phase 3 extends these with selection capture and DOM extraction handlers.
- `src/preload/overlay.ts` — `activateSelection()` and `onModeChange()` already exposed via contextBridge. Phase 3 extends this API with selection data, DOM extraction, and screenshot capture methods.
- `src/renderer/overlay.html` — Toolbar with select button already in place. Phase 3 adds the rectangle mode toggle button and builds selection/input UI here.
- `src/renderer/overlay.css` — Dark pill toolbar styling (rgba(10,10,10,0.88), rounded, opacity transitions). Phase 3 extends with selection rectangle, hover highlight, and input bar styles matching this aesthetic.
- `src/renderer/overlay.ts` — Click handler for select button and mode change listener already scaffolded. Phase 3 builds the selection drawing logic here.

### Established Patterns
- IPC via `ipcMain.handle()` / `ipcRenderer.invoke()` with typed contextBridge API
- Overlay bounds toggle pattern: shrink to 48x48 inactive, expand to full window for selection
- electron-vite multi-entry config with separate main/preload/renderer builds
- CSS follows the dark toolbar aesthetic (dark bg, white text, rounded corners, subtle opacity)

### Integration Points
- `src/main/window.ts` — `siteView.webContents` is the target for `capturePage()` (screenshot) and `executeJavaScript()` (DOM extraction, element hover detection)
- `src/preload/overlay.ts` — Needs new IPC channels for: capture screenshot, extract DOM, submit instruction
- `electron.vite.config.ts` — May need CSP adjustments if overlay needs to render captured screenshots

</code_context>

<specifics>
## Specific Ideas

- Selection visual should match the Gemini reference: rounded rectangle border (light, subtle) with semi-transparent tint fill over the selected content. Not the sharp-cornered OS-style selection.
- Input bar should feel like the Gemini "Ask Gemini" bar: dark, rounded, floating near the selection with a clean minimal look.
- The toolbar gets a second button for element click mode (toggle between rectangle and element mode).
- Concurrent edit capability: after submitting, the user can immediately select and submit another instruction. Phase 4 handles the multi-edit orchestration via Claude subagents and task progress UI.

</specifics>

<deferred>
## Deferred Ideas

- Task progress UI showing multiple in-flight edits — Phase 4 (CLAUD-03 status feedback)
- Claude subagent orchestration for concurrent edits — Phase 4 architecture decision

</deferred>

---

*Phase: 03-selection-overlay-capture*
*Context gathered: 2026-04-04*
