# Phase 4: Claude Code Integration - Context

**Gathered:** 2026-04-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire the submit pipeline to Claude Code — instruction + visual context (screenshot + DOM) assembled into a prompt and sent to Claude Code via the Agent SDK, with a task sidebar showing edit progress, parallel agent execution for independent instructions, and inline error handling with retry. This phase delivers the core AI editing loop: submit instruction -> Claude edits source -> HMR reflects changes -> user sees result.

</domain>

<decisions>
## Implementation Decisions

### Status Feedback UX — Task Sidebar
- **D-01:** Right-side overlay panel for tracking in-flight and completed edits. Floats over the site content (does not shrink site viewport width).
- **D-02:** Sidebar is NOT part of the overlay WebContentsView — it must persist when the overlay bounds toggle shrinks the overlay to 48x48 on deactivation. Claude has discretion on the rendering approach (separate WebContentsView, or other).
- **D-03:** Hidden by default — does not exist until first instruction is submitted. A small icon appears on the right edge (vertically centered, middle-right) after first submit.
- **D-04:** Click the icon to expand the full sidebar panel. Click again (or a minimize button) to collapse back to the icon position with animated slide transition.
- **D-05:** Minimized state shows a compact badge with summary (e.g., "3/5") next to the icon, partially visible on the right edge.
- **D-06:** When a new task is submitted, sidebar auto-expands briefly (~2 seconds) to show the new task, then auto-minimizes back to the badge.
- **D-07:** When a task completes or errors while minimized, the badge pulses/glows briefly to indicate a change. Errors pulse with a red/orange accent color.
- **D-08:** When the sidebar is expanded and the user enters selection mode, sidebar auto-minimizes to maximize visible site area for accurate selection. Re-expands after submit.
- **D-09:** Matches the existing dark overlay aesthetic: rgba(10,10,10,0.88) background, white text, rounded corners — consistent with toolbar and instruction input.

### Status States
- **D-10:** Simple 3-state model per task: Sending -> Editing -> Done. Errors replace any state with an error indicator.
- **D-11:** Each task row shows instruction text (truncated if long) and status badge. No screenshot thumbnails — keeps the sidebar compact.
- **D-12:** Completed and errored tasks persist in the list until explicitly dismissed by the user. No auto-clearing.

### Concurrent Edit Model
- **D-13:** Parallel execution by default — each instruction spawns a separate Claude agent (separate Agent SDK `query()` call). Instructions do NOT queue behind each other unless dependent.
- **D-14:** Claude infers dependencies from instruction text. When a new instruction references a prior edit (e.g., "match the footer to the header I just changed"), it queues behind the relevant in-flight task. Otherwise runs immediately in parallel.
- **D-15:** Maximum 3-4 parallel agents at any time. Additional independent instructions queue behind the oldest running agent.
- **D-16:** Researcher must investigate current Agent SDK capabilities for multi-agent patterns (including any "team" or inter-agent communication features). If SDK supports agent coordination, use it. If not, the share-context-or-not decision is Claude's discretion.

### Error & Retry UX
- **D-17:** Errors appear inline in the sidebar task row: error state badge, short error message, Retry button, and Dismiss button.
- **D-18:** When an error occurs while the sidebar is minimized, the badge pulses with error color but does NOT auto-expand. User opens sidebar when ready.
- **D-19:** Retry prefills the instruction input bar with the original instruction text for optional editing. Submit sends a fresh capture (new screenshot + DOM) since the site may have changed since the original submission.

### Claude's Discretion
- Prompt assembly format (how screenshot, DOM context, and instruction are structured in the message content blocks)
- Sidebar rendering architecture (separate WebContentsView, BrowserWindow child, or other approach that persists across overlay state changes)
- Agent SDK configuration for parallel agents (system prompt, allowed tools, shared context strategy)
- Dependency detection implementation (NLP heuristics, keyword matching, or other approach)
- Animation timing and easing for sidebar expand/collapse/pulse
- Exact sidebar width when expanded
- How the "queued" state is displayed in the sidebar (if a task is waiting on a dependency)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Technology Stack
- `CLAUDE.md` — Full technology stack. Specifically: Agent SDK (`@anthropic-ai/claude-agent-sdk`), `query()` function for spawning agents.
- `CLAUDE.md` "Key Technical Decisions" — Spawn Claude Code CLI (not API), screenshot as PNG buffer, DOM context as serialized JSON.

### Existing Claude Session
- `src/cli/utils/claude.ts` — Current Agent SDK session with async generator message queue, `sendMessage()`, system prompt configuration, allowed tools. Phase 4 likely replaces/extends this for multi-agent support.

### IPC Pipeline
- `src/main/ipc-handlers.ts` — `overlay:submit-instruction` handler is the Phase 4 entry point. Currently a stub that logs and deactivates overlay. Phase 4 wires this to Claude.
- `src/preload/overlay.ts` — `submitInstruction()` already exposed via contextBridge with screenshot, DOM, instruction, and bounds.

### Overlay Architecture
- `src/main/window.ts` — `setOverlayActive()`/`setOverlayInactive()` and the bounds toggle pattern. Sidebar must NOT be affected by these calls.
- `.planning/phases/02-electron-shell/02-CONTEXT.md` — BaseWindow + dual WebContentsView architecture.
- `.planning/phases/03-selection-overlay-capture/03-CONTEXT.md` — Selection modes, instruction input, concurrent edit allowance (D-14), overlay CSS aesthetic.

### Requirements
- `.planning/REQUIREMENTS.md` — CLAUD-01 (prompt assembly + send), CLAUD-02 (Claude edits + HMR), CLAUD-03 (status feedback), CLAUD-04 (error + retry).

### Research Flags
- `.planning/STATE.md` — "Agent SDK multi-turn streaming and image content block support need verification before planning." Researcher must verify current SDK support for image content blocks in prompts.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/cli/utils/claude.ts` — Agent SDK session with `query()`, system prompt, allowed tools. Foundation for multi-agent spawning.
- `src/main/ipc-handlers.ts` — Submit instruction handler already receives `{ instruction, screenshot, dom, bounds }`. Phase 4 wires it to Claude.
- `src/preload/overlay.ts` — Full `submitInstruction()` API already exposed to renderer.
- `src/renderer/overlay.css` — Dark toolbar aesthetic (rgba(10,10,10,0.88), rounded, opacity transitions) to match for sidebar styling.
- `src/cli/utils/output.ts` — Spinner and error output utilities for CLI-side status.
- `src/cli/utils/process.ts` — Shutdown handlers with `claudeSession` slot. Needs updating for multiple agent cleanup.

### Established Patterns
- IPC via `ipcMain.handle()` / `ipcRenderer.invoke()` with typed contextBridge API
- Overlay bounds toggle pattern: shrink to 48x48 inactive, expand to full window for selection
- electron-vite multi-entry config with separate main/preload/renderer builds
- CSS follows dark toolbar aesthetic (dark bg, white text, rounded corners, subtle opacity)
- tree-kill for process cleanup

### Integration Points
- `src/main/ipc-handlers.ts:79` — `overlay:submit-instruction` handler is the bridge point. Needs to route to Claude agent(s).
- `src/cli/commands/start.ts:174` — Claude session created here. Needs to expose agent spawning to the Electron main process (via IPC or shared reference).
- `src/main/window.ts` — Sidebar rendering needs to be added alongside existing site + overlay views.
- New IPC channels needed: task status updates (main -> overlay/sidebar), retry instruction, dismiss task.

</code_context>

<specifics>
## Specific Ideas

- Sidebar feels like a minimal task tracker — dark, floating, unobtrusive. Think of it as a slim activity monitor that stays out of the way until needed.
- The animated expand/collapse should feel smooth — the sidebar slides out from the icon position and collapses back to it. Not a fade, a spatial animation.
- The minimized badge with "3/5" partially visible on the right edge gives a quick glance at progress without needing to open anything.
- Retry re-opens the instruction input bar prefilled with original text, not an inline editor in the sidebar. This reuses the existing instruction input UX from Phase 3.
- Parallel agents are the default — this is a productivity tool, and queuing defeats the purpose when edits are independent.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-claude-code-integration*
*Context gathered: 2026-04-04*
