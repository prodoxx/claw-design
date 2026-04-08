# Phase 2: Electron Shell - Context

**Gathered:** 2026-04-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Secure Electron window that loads the user's localhost site with a transparent overlay layer ready for selection interaction in Phase 3. Covers window creation, security isolation, site navigation handling, and the foundational overlay architecture.

</domain>

<decisions>
## Implementation Decisions

### Window Chrome & Sizing
- **D-01:** Standard OS frame with native title bar and traffic lights (macOS) / window controls (Windows). No frameless or custom chrome.
- **D-02:** Default window size: 1280x800, centered on screen.
- **D-03:** Window title format: `claw-design — PROJECT_NAME — localhost:PORT` (reads project name from package.json `name` field).
- **D-04:** Freely resizable by the user with no minimum size constraint. Phase 5 adds preset viewport buttons later.

### Site Navigation
- **D-05:** All in-site navigation allowed. User clicks links freely within their localhost site — SPA routing and multi-page navigation both work normally.
- **D-06:** External URLs (non-localhost) open in the user's default system browser. Electron window stays on localhost.
- **D-07:** Chrome DevTools accessible via standard keyboard shortcut (Cmd+Opt+I / F12).
- **D-08:** Standard browser-like shortcuts supported: Cmd+R to refresh, Cmd+[ / Cmd+] for back/forward.

### Overlay Layer Architecture
- **D-09:** Two stacked WebContentsViews inside a BaseWindow: site view (bottom) loads localhost, overlay view (top) is transparent. Clean separation — overlay can't interfere with site JS/CSS.
- **D-10:** If the compositing artifact (electron/electron#42335) blocks the two-view approach during research, fall back to injecting the overlay into the site view via executeJavaScript.
- **D-11:** Overlay view loads a minimal HTML page from src/renderer/ (e.g., overlay.html) with its own CSS/JS entry point managed by electron-vite. Phase 3 builds selection UI here.
- **D-12:** When overlay is inactive (no selection mode), mouse events pass through completely to the site view. User interacts with their site normally.
- **D-13:** Both WebContentsViews auto-sync to fill the BaseWindow content area on resize. They stay perfectly aligned.

### Overlay Indicator
- **D-14:** Small indicator in the bottom-right corner of the overlay showing Claw is active. Always visible regardless of selection mode state.
- **D-15:** Bottom-right corner also hosts the activation button for selection mode (Phase 3 implements the behavior, Phase 2 establishes the placement).

### Claude's Discretion
- Exact indicator visual design (icon, size, opacity)
- Electron security configuration details (CSP headers, sandbox flags)
- IPC channel naming and preload script API surface
- How the CLI spawns the Electron process (child_process.spawn of electron binary vs electron-vite dev)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Technology Stack
- `CLAUDE.md` — Full technology stack decisions (electron-vite, Electron 36, BaseWindow + WebContentsView pattern)
- `CLAUDE.md` "Key Technical Decisions" section — CLI spawns Electron (not the other way around), renderer loads localhost directly

### Architecture
- `.planning/STATE.md` — Prior decisions: BaseWindow + WebContentsView (not deprecated BrowserView), Agent SDK for Claude Code, ordered shutdown (Claude > Electron > dev server)

### Requirements
- `.planning/REQUIREMENTS.md` — CLI-06 (open Electron window), ELEC-01 (secure window with isolation), ELEC-02 (overlay on top of site content)

### Known Issues
- Electron issue #42335 — Transparent WebContentsView compositing artifact. Researcher must evaluate current status in Electron 36 and prototype the two-view stacking approach. If blocked, fall back to injected overlay (D-10).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/cli/utils/process.ts` — Shutdown handlers already have `electronProcess` slot in `ManagedProcesses` interface. Phase 2 plugs in the Electron PID.
- `src/cli/utils/output.ts` — Spinner and error output utilities for CLI feedback during Electron launch.
- `src/cli/commands/start.ts` — Orchestrator that needs updating to spawn Electron after dev server is ready (after Step 6).

### Established Patterns
- electron-vite config already scaffolded with main/preload/renderer entry points
- tree-kill used for process cleanup (dev server, Claude) — same pattern for Electron process
- picocolors + ora for CLI terminal output

### Integration Points
- `src/main/index.ts` — Placeholder, becomes the Electron main process (BaseWindow creation, WebContentsView setup)
- `src/preload/index.ts` — Placeholder, becomes the preload script with contextBridge API
- `src/renderer/index.html` — Placeholder, may become the overlay HTML (or a new overlay.html is added alongside it)
- `electron.vite.config.ts` — May need a second renderer entry if overlay.html is separate from index.html

</code_context>

<specifics>
## Specific Ideas

- Window title includes all three identifiers: product name, project name, and localhost URL — e.g., `claw-design — my-app — localhost:3000`
- Bottom-right corner hosts both the Claw indicator and the selection mode activation button (Phase 3 builds the activation behavior on top of this placement)
- The overlay should feel invisible when not in use — full passthrough, no visual noise except the small corner indicator

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-electron-shell*
*Context gathered: 2026-04-03*
