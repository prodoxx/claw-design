# Phase 5: Polish & Distribution - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Viewport switching (desktop/tablet/mobile presets), error UX polish (in-window notifications + CLI), npm packaging for `npm install -g claw-design`, and pre-release visual polish (splash screen, tooltips, consistency audit). This phase makes the tool shippable.

</domain>

<decisions>
## Implementation Decisions

### Viewport Switching
- **D-01:** Viewport preset buttons live in the existing overlay toolbar — extend the vertical pill with 3 new icons (desktop, tablet, mobile) separated visually from the selection controls.
- **D-02:** Switching viewports resizes the site view only, not the window. Window stays full size. Site view is constrained to the preset dimensions, centered, with dark background fill on the surrounding area (like Chrome DevTools responsive mode).
- **D-03:** Three presets: Desktop (1280×800), Tablet (768×1024), Mobile (375×812).
- **D-04:** Active viewport icon gets a brighter/accent color to indicate current selection. No dimensions label.
- **D-05:** Smooth resize animation (200-300ms ease) when switching between viewport sizes.
- **D-06:** Dark background (#1a1a1a or similar) for the area surrounding the constrained site view. Matches the overall dark overlay aesthetic.
- **D-07:** Overlay continues to cover the full window area regardless of viewport size — selection/toolbar/sidebar work normally over the dark background.

### Error UX
- **D-08:** Errors surface in both CLI terminal and in-window. Startup/process errors print to terminal. Runtime errors (dev server crash, connection lost) also show as overlay notifications.
- **D-09:** Non-critical errors show as auto-dismissing toast notifications. Critical errors (dev server crashed) show as persistent banners that stay until the issue is resolved or user dismisses.
- **D-10:** In-window error notifications use the dark overlay aesthetic: same dark bg, white text, rounded corners, with red/orange accent color for error state.
- **D-11:** Priority error scenario: dev server crash mid-session must trigger an in-window notification (currently only notifies in terminal per Phase 1 D-13).

### npm Packaging
- **D-12:** electron moves from devDependencies to dependencies. When users run `npm install -g claw-design`, electron's postinstall downloads the platform binary automatically.
- **D-13:** Full OSS metadata: `files` whitelist (dist/, LICENSE), `repository`, `keywords`, `homepage`, `author` fields added to package.json.
- **D-14:** Pre-flight checks at startup: verify electron binary exists, Claude Code CLI in PATH, Node version >= 20. Fast checks that catch common install issues before confusing errors.
- **D-15:** Full README.md: installation, usage, how it works, requirements. First thing users see on npm/GitHub.
- **D-16:** MIT license (LICENSE file).
- **D-17:** `clawdesign --version` shows just the version number (e.g., "0.1.0").
- **D-18:** Unified build: `npm run build` runs CLI build + electron-vite build. `prepublishOnly` hook calls build automatically.
- **D-19:** Package name: unscoped `claw-design`.
- **D-20:** No separate `clawdesign doctor` command — pre-flight checks at startup are sufficient for v1.

### Pre-release Polish
- **D-21:** Branded splash screen while site loads: claw-design name centered on dark background with loading indicator and localhost URL. Transitions to site once ready.
- **D-22:** Toolbar icons have simple tooltips on hover showing what each button does (e.g., "Region select", "Tablet viewport"). Helps discoverability.
- **D-23:** No first-run onboarding or tooltip tour. Users ran `clawdesign start` from terminal — they know what they're doing.

### Claude's Discretion
- Error message style (structured vs conversational — pick the right tone for each context)
- Visual consistency audit across all UI surfaces (toolbar, input bar, sidebar, notifications, splash) — fix spacing, colors, opacity, border-radius inconsistencies
- Animation timing and easing details for viewport transitions and toast notifications
- Splash screen exact visual design (typography, spinner style, layout)
- Tooltip implementation approach and timing
- Toast notification position (top vs bottom), auto-dismiss duration
- Persistent error banner position and dismiss interaction
- How viewport constraint is implemented (siteView.setBounds vs CSS transform vs other)
- README content structure and depth

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Window Architecture
- `src/main/window.ts` — BaseWindow + triple WebContentsView (site, overlay, sidebar). Contains `syncBounds()`, `setOverlayActive()`/`setOverlayInactive()`, sidebar state management. Viewport switching modifies siteView bounds here.
- `.planning/phases/02-electron-shell/02-CONTEXT.md` — Window architecture decisions: D-04 (freely resizable, Phase 5 adds presets), D-09 (dual WebContentsView), D-13 (auto-sync on resize).

### Overlay & Toolbar
- `src/renderer/overlay.ts` — Overlay renderer with toolbar, selection modes, input bar. Viewport buttons extend the toolbar here.
- `src/renderer/overlay.css` — Dark toolbar aesthetic (rgba(10,10,10,0.88), white text, rounded corners). All new UI must match.
- `.planning/phases/03-selection-overlay-capture/03-CONTEXT.md` — Selection modes, instruction input UX, dark aesthetic decisions.

### Sidebar & Error Patterns
- `src/renderer/sidebar.ts` — Sidebar renderer with task tracking and inline error display.
- `src/renderer/sidebar-state.ts` — Sidebar state machine (hidden/minimized/expanded).
- `.planning/phases/04-claude-code-integration/04-CONTEXT.md` — D-17 through D-19: inline error handling, retry UX, error notification patterns.

### CLI & Output
- `src/cli/utils/output.ts` — `printError(title, message, suggestion)` pattern. Pre-flight checks and error polish extend this.
- `src/cli/commands/start.ts` — Start command orchestration. Pre-flight checks go here.
- `src/cli/utils/process.ts` — Shutdown handlers. Dev server crash notification hooks here.

### IPC & Preload
- `src/main/ipc-handlers.ts` — IPC handlers including drag/bounds management. Viewport switching adds new IPC channels.
- `src/preload/overlay.ts` — contextBridge API for overlay. Viewport switching API exposed here.

### Package & Distribution
- `package.json` — Current: bin field set, electron in devDeps, missing files/repository/keywords/author. Phase 5 restructures for npm publish.
- `CLAUDE.md` "Technology Stack" — Full dependency list, distribution via npm `bin` field.

### Requirements
- `.planning/REQUIREMENTS.md` — ELEC-03 (viewport switching).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/main/window.ts:syncBounds()` — Already handles resize sync for all three views. Viewport switching can hook into this by constraining siteView bounds while keeping overlay/sidebar at full window size.
- `src/cli/utils/output.ts:printError()` — Title/message/suggestion pattern ready for consistent error formatting.
- `src/renderer/overlay.css` — Established dark aesthetic tokens: rgba(10,10,10,0.88) bg, white text, 12px border-radius, 0.3s opacity transitions.
- `src/main/window.ts:applySidebarBounds()` — Pattern for managing view bounds based on state. Viewport state management can follow the same approach.

### Established Patterns
- IPC via `ipcMain.handle()` / `ipcRenderer.invoke()` with typed contextBridge API
- WebContentsView bounds management for layout (overlay toggle, sidebar states)
- Dark overlay aesthetic consistently applied across toolbar, input bar, sidebar
- electron-vite multi-entry config for main/preload/renderer builds
- State machine pattern for UI state (sidebar-state.ts)

### Integration Points
- `src/renderer/overlay.ts` toolbar section — viewport buttons added here
- `src/main/window.ts` — new `setViewport(preset)` function managing siteView bounds
- `src/main/ipc-handlers.ts` — new IPC channel for viewport switching
- `src/preload/overlay.ts` — expose viewport switching API to renderer
- `package.json` — restructure deps and add metadata fields
- New files: README.md, LICENSE, splash screen HTML/CSS

</code_context>

<specifics>
## Specific Ideas

- Viewport switching should feel like Chrome DevTools responsive mode — site floats as a constrained rectangle, dark fill around it, clean and focused.
- The smooth resize animation when switching viewports gives it a polished feel — not a jarring snap but a deliberate transition.
- Tooltips should be minimal and fast — appear quickly on hover, disappear immediately on mouse leave. No fancy animations.
- The splash screen should feel brief and informative — not a brand moment, just "loading your site..."
- All dark UI elements must look like they belong to the same design system. No slightly-different-blacks or inconsistent border-radius values.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-polish-distribution*
*Context gathered: 2026-04-06*
