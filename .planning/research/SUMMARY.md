# Project Research Summary

**Project:** claw-design
**Domain:** CLI-first visual web development tool (Electron + Claude Code integration)
**Researched:** 2026-04-03
**Confidence:** MEDIUM-HIGH

## Executive Summary

Claw-design is a CLI-first visual development tool that bridges the gap between seeing a problem in a browser and fixing it in source code. The user runs `claw start`, which spawns their dev server, opens an Electron window loading the localhost site, and initializes a Claude Code session. The user draws a selection box around any part of their site, describes the desired change in plain English, and Claude Code edits source files directly. HMR reflects changes immediately. The product sits in an active competitive space (Design In The Browser, Frontman, Stagewise, Cursor Visual Editor) but has a clear differentiator: framework-agnostic operation with zero-config setup, open source, and no API key requirements beyond the Claude subscription the user already has.

The recommended architecture is a four-process model: CLI orchestrator (Node.js) spawns a dev server, Electron (via `fork()` IPC), and Claude Code (via `@anthropic-ai/claude-agent-sdk`). Within Electron, a `BaseWindow` hosts two `WebContentsView` instances — one loading the user's localhost site (fully sandboxed), one providing the transparent selection overlay (trusted UI with contextBridge IPC). This separation is non-negotiable: loading untrusted localhost content with `nodeIntegration: true` would be a critical security vulnerability, and the deprecated `BrowserView` API must not be used. Screenshot capture and DOM extraction are both available as built-in Electron APIs, eliminating the need for native modules like `sharp`.

The primary risk is process lifecycle management. Dev servers (Vite, Next.js, webpack) spawn their own child processes. A naive `process.kill()` leaves orphaned grandchildren that hold ports open and consume resources across sessions. Using `tree-kill` with comprehensive signal handling (SIGINT, SIGTERM, SIGHUP, Electron `app.will-quit`) is mandatory from Phase 1. Secondary risk is DPI coordinate mismatch: `capturePage()` operates in device pixels while mouse events and `getBoundingClientRect()` return CSS pixels. On Retina displays (`devicePixelRatio: 2`), raw coordinates sent to `capturePage()` will capture the wrong region. The Claude Code Agent SDK integration also carries medium uncertainty because the streaming multi-turn conversation API needs verification.

Distribution is via npm (`npm install -g claw-design`). Electron is listed as a production dependency so its platform binary downloads automatically on install (~180MB Chromium runtime). Native installers (Electron Forge, electron-builder) are unnecessary for a developer tool and add complexity we do not need in v1.

## Key Findings

### Recommended Stack

The stack is minimal by design. All image processing uses Electron's built-in `NativeImage` (crop, toPNG, toJPEG) rather than `sharp`, which requires native module rebuilds against Electron's ABI and is a known source of installation failures. DOM capture and screenshot capture are both Electron built-ins (`webContents.executeJavaScript`, `webContents.capturePage`). The CLI layer is three packages: `commander` for argument parsing (fastest startup at 18-25ms, TypeScript built-in, zero deps), `picocolors` for terminal output (14x smaller than chalk), and `ora` for spinners. Process management uses Node.js built-in `spawn()` plus `tree-kill` for cleanup.

`electron-vite` is recommended over Electron Forge. Forge's Vite integration is explicitly marked experimental and assumes you are building a native installer app. Claw is a dev tool distributed via npm — electron-vite provides a cleaner mental model (auto-discovers `src/main`, `src/preload`, `src/renderer` by convention), better HMR DX, and a lighter dependency tree.

**Core technologies:**
- `electron ^36.x`: Desktop shell — latest stable (36.4.0), ships Chromium 136 + Node 22.14, in active maintenance window
- `electron-vite ^5.0`: Build tooling — stable Vite integration vs. Forge's experimental plugin
- `commander ^14.0`: CLI parsing — fastest startup, zero dependencies, requires Node 20+ (aligns with runtime target)
- `tree-kill ^1.2.2`: Process tree cleanup — kills grandchild processes; `process.kill()` alone leaves orphans
- `@anthropic-ai/claude-agent-sdk`: Claude Code integration — typed subprocess lifecycle, streaming, JSON-lines protocol abstraction
- `picocolors ^1.1`, `ora ^8.x`: Terminal UX — status feedback during startup and Claude Code operations
- `typescript ~5.7`: Type safety — critical for Electron IPC correctness; untyped IPC messages are the top runtime bug source in Electron apps
- `vitest ^3.x`, `@playwright/test ^1.50`: Testing — vitest for unit/integration, Playwright for E2E Electron flows

### Expected Features

Research of four direct competitors (Design In The Browser, Frontman, Stagewise, Cursor Visual Editor) and the adjacent tool landscape (Onlook, v0, Bolt, Domscribe) establishes a clear feature hierarchy.

**Must have (table stakes):**
- Visual element selection (freeform region draw) — every competitor has this; region-only is viable for v1
- Screenshot capture of selection — AI needs visual context; all tools send screenshots
- DOM context extraction — screenshot alone is insufficient; AI needs structure (tags, classes, IDs, text, bounding rects)
- Natural language instruction input — universal interaction pattern across all tools in the space
- AI-powered source code editing via Claude Code — delegates to Claude Code; Claw's job is providing good context
- Live preview via HMR — dev server handles this; Claw must not break it
- Dev server management — `claw start` spawns the dev server; Design In The Browser and Stagewise both do this
- Framework agnosticism — tools locked to one framework lose the majority of potential users; Claw's approach (screenshot + DOM + Claude Code) works with any stack
- Clear status feedback — users must know what is happening at each step
- Error handling — clear messages when Claude Code fails; git-as-undo is explicitly acceptable per PROJECT.md

**Should have (competitive differentiators):**
- Zero-config one-command workflow (`claw start` auto-detects dev script and port) — strongest differentiator vs. Frontman (middleware required) and Design In The Browser (manual setup)
- Iterative visual feedback loop — repeated select-describe-see-result cycles in a single session without restarting
- Click-to-element selection (Phase 2) — complement to freeform draw; competitors offer both
- Better DOM context (computed styles, parent hierarchy, data-* attributes) — Frontman goes deeper; improves Claude edit accuracy
- Responsive viewport switching — low complexity, quality-of-life for responsive design work
- Auto-commit before AI changes (Aider pattern) — makes git-as-undo actually reliable without custom undo UI

**Defer (v2+):**
- Multi-element batch selection — high complexity, strong feature but deferred
- Reference image support — useful for design-to-code but non-essential for core workflow
- CSS inspection overlay (ALT-to-inspect) — nice but not blocking
- Session history (what instructions were given, what files changed)
- Keyboard shortcuts for power users

**Do not build:**
- Built-in AI agent or direct Claude API integration — Claw augments Claude Code, it does not replace it
- In-app code editor — users have their IDE; Claude Code edits files directly
- Full design tool (Figma-like canvas) — Onlook went this route; it is a different product
- Custom undo/redo — Cursor's checkpoint system is notoriously buggy; use git
- Deployment, project scaffolding, or collaboration features — different product, different user

### Architecture Approach

The architecture has four distinct process boundaries that must be maintained throughout development. The CLI orchestrator owns the lifecycle of everything: it reads `package.json`, detects the dev script, spawns the dev server child process (with health polling via TCP port check), forks Electron (with Node.js IPC channel for bidirectional messaging), and initializes the Claude Code session via the Agent SDK. Within Electron, a `BaseWindow` hosts two `WebContentsView` instances stacked: the site view (loads `http://localhost:<port>`, fully sandboxed, no preload) and the overlay view (transparent, on top, preload script with `contextBridge` bridge). DOM capture is injected via `executeJavaScript()` since the site view has no preload for security reasons. Claude Code receives a structured prompt containing a base64 PNG screenshot, serialized DOM context (elements within the selection region), and the user's natural language instruction.

**Major components:**
1. **CLI Orchestrator** — parses args, detects dev command, spawns all child processes, owns signal handling and graceful shutdown
2. **Dev Server** — opaque child process (any framework); managed but never modified; health-checked via TCP port polling
3. **Electron Main + Site WebContentsView** — BaseWindow, loads localhost, screenshot capture, DOM extraction via `executeJavaScript`, IPC routing; site view gets maximum sandbox restrictions
4. **Overlay WebContentsView** — transparent layer on top of site; canvas-based selection drawing, instruction text input, status display; communicates with main via `invoke/handle` + `contextBridge`
5. **Claude Code Session** — long-lived subprocess via Agent SDK `query()`; receives multi-modal prompts (image + text), edits files, streams status events back to overlay

### Critical Pitfalls

1. **Orphan processes on exit** — `process.kill(pid)` leaves grandchild processes (esbuild, SWC compilers) running, blocking ports on next startup. Use `tree-kill` from day one with handlers for SIGINT, SIGTERM, SIGHUP, and Electron `app.will-quit`. On Windows use `taskkill /T /F`. Write a PID file to detect and kill orphans from crashed previous runs.

2. **Electron security misconfiguration** — The site view loads arbitrary localhost content which may include third-party scripts. Enabling `nodeIntegration: true` or disabling `contextIsolation` exposes the developer's filesystem and processes to any XSS in their site. Non-negotiable defaults: `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`, no preload on site view, only minimal named methods exposed via `contextBridge` on overlay view.

3. **DPI coordinate mismatch** — CSS pixels (mouse events, `getBoundingClientRect()`) vs. device pixels (`capturePage()`). On Retina displays (`devicePixelRatio: 2`), raw CSS coordinates capture the wrong region. Always multiply CSS coordinates by `window.devicePixelRatio` before passing to `capturePage()`. Also account for scroll position (`window.scrollX`, `window.scrollY`). Test with `--force-device-scale-factor=2` during development.

4. **Dev server readiness detection fragility** — Every framework prints different "ready" messages in different formats with ANSI codes. String-matching stdout is maintenance hell. Primary readiness signal must be TCP port polling (`net.connect()` with exponential backoff). Parse stdout only as a secondary signal for port discovery. Provide `--port` flag to bypass auto-detection.

5. **Claude Code session dies silently** — The `ProcessTransport` can enter a permanently broken `ready = false` state without surfacing an obvious error. Meanwhile the overlay hangs. Monitor subprocess `exit`, `error`, and `close` events. Implement per-operation timeouts (120s). Surface errors in human language ("Claude Code disconnected — press Enter to reconnect"), not transport internals. Spawn new session with `resume: sessionId` for recovery.

6. **BrowserView deprecation** — Deprecated since Electron 30, could be removed at any upcoming major version (8-week release cycle). Use `BaseWindow` + `WebContentsView` + `contentView.addChildView()` exclusively. Zero references to `BrowserView` in codebase.

7. **Overlay injection breaking the user's app** — CSS `z-index` wars, stacking contexts, HTML `<dialog>` top-layer elements rendering above the overlay. Shadow DOM blocks `querySelectorAll`. Use separate `WebContentsView` for the overlay (complete isolation) rather than injecting CSS/HTML into the user's page. This is an architectural decision — injecting into the user's DOM is a path of escalating hacks.

8. **DOM-to-source mapping giving Claude wrong context** — Runtime DOM bears little resemblance to source code in CSS-in-JS apps (hashed class names), server-rendered apps (wrapper elements), and Tailwind apps (utility classes with no component identity). Prioritize text content, `data-testid`, `id`, `aria-label`, and visible CSS properties over class names. Delegate actual source file discovery to Claude Code's codebase search. Prune DOM to selected region — never send full-page DOM.

## Implications for Roadmap

Based on the dependency graph in ARCHITECTURE.md and the pitfall-to-phase mapping in PITFALLS.md, the research recommends a 5-phase structure with strict dependency ordering.

### Phase 1: CLI Foundation and Process Lifecycle

**Rationale:** Every other phase depends on the CLI orchestrator working correctly. Process lifecycle management must be built before any child processes are spawned — retrofitting it is painful and prone to missed edge cases (Windows signals, multi-process trees). Dev server readiness detection is the first thing users experience and failure here makes the tool appear completely broken on first run. All of this is testable as pure Node.js without Electron.

**Delivers:** `claw start` detects and launches the dev server, waits for it to be ready, and kills everything cleanly on Ctrl+C. `claw start --cmd "yarn dev" --port 5173` works as override.

**Addresses:** Dev server management (table stakes), framework agnosticism (table stakes), one-command workflow (differentiator)

**Avoids:** Orphan processes pitfall (#1 — critical, foundational), dev server readiness fragility (#7 — use TCP polling, not stdout matching), Claude Code not installed (#12 — fail fast with clear error before spawning anything)

**Stack:** `commander`, `tree-kill`, `picocolors`, `ora`, Node.js `child_process.spawn()`

### Phase 2: Electron Shell (Secure Window)

**Rationale:** The Electron window is the visual foundation for all overlay and capture features. Security architecture must be correct from the first line of Electron code — retrofitting `contextIsolation` and `contextBridge` requires refactoring all IPC. `BaseWindow` + `WebContentsView` must be used from the start (never `BrowserView`). The window can be tested by loading any localhost URL.

**Delivers:** Electron window loads the user's live dev server. Site view is fully sandboxed. HMR works (WebSocket connections unimpeded). Electron app name shows as "Claw" not "Electron." Single-instance lock prevents duplicate launches.

**Addresses:** Live preview via HMR (table stakes), dev server management integration

**Avoids:** Electron security misconfiguration (#2 — critical, must be right from start), BrowserView deprecation (#3 — non-negotiable), multiple instances (#15), HMR WebSocket interference (#16)

**Stack:** `electron`, `electron-vite`, `typescript`, Node.js `fork()` IPC for CLI-to-Electron channel

**Architecture:** BaseWindow + dual WebContentsView with secure defaults on site view

### Phase 3: Selection Overlay and Capture

**Rationale:** This phase implements the core visual interaction. The overlay must use a separate `WebContentsView` (not CSS injection) for complete isolation from the user's site. DPI coordinate handling must be correct from day one — bugs here are invisible on non-Retina machines. DOM capture via `executeJavaScript` must serialize to plain objects (DOM elements cannot cross IPC). Performance matters: prune to selected region, never serialize full page.

**Delivers:** User draws a freeform selection box on their site. Screenshot of selected region is captured (DPI-correct). DOM elements within the region are extracted and serialized. Instruction text input appears after selection. Status indicators show capture progress.

**Addresses:** Visual element selection (table stakes), screenshot capture (table stakes), DOM context extraction (table stakes), natural language instruction input (table stakes), clear status feedback (table stakes)

**Avoids:** DPI coordinate mismatch (#6 — write coordinate utility tested at dpr 1, 2, 3), overlay injection breaking user's app (#4 — use separate WebContentsView), transparent view rendering artifacts (#9), DOM serialization limits (#10), capturePage on hidden window (#11)

**Stack:** Canvas or SVG in overlay renderer, `webContents.capturePage()`, `webContents.executeJavaScript()`, `NativeImage.toPNG()`

**Architecture:** Overlay WebContentsView with `contextBridge` bridge; `invoke/handle` IPC pattern; DOM capture script injected into site view

### Phase 4: Claude Code Integration

**Rationale:** This is the highest-risk phase because it depends on the Agent SDK's `query()` API behavior, prompt formatting effectiveness, and Claude Code's ability to process base64 images. The Agent SDK must be used (not raw `child_process`) because the JSON-lines protocol is complex and will break on protocol changes. Session health monitoring is mandatory — silent failures make the tool appear hung. Context assembly quality (how much DOM, what format, how the screenshot is included) directly determines edit accuracy and will need empirical iteration.

**Delivers:** User selects region, types instruction, Claude Code receives screenshot + DOM + instruction, edits source files, HMR reflects changes, overlay shows streaming status ("Claude is reading src/App.tsx...", "Done. 2 files changed."). Session survives process crashes and recovers.

**Addresses:** AI-powered source code editing (table stakes), clear status feedback (table stakes), iterative feedback loop (differentiator)

**Avoids:** Raw child_process Claude integration (anti-pattern — use Agent SDK), Claude Code session silent death (#5), DOM-to-source mapping noise (#8 — prune DOM, prioritize stable identifiers)

**Stack:** `@anthropic-ai/claude-agent-sdk`, multi-modal prompt with image content blocks

**Research flag:** Needs phase-level research. Key questions: (a) Does Agent SDK `query()` support streaming new instructions into an existing session without restart? (b) Does it support image content blocks in user messages? (c) What are the timeout/retry behaviors for long-running edits? Verify against current SDK docs before planning this phase.

### Phase 5: Polish and Distribution

**Rationale:** The core loop works at end of Phase 4. Phase 5 transforms a working prototype into a shippable OSS tool. Error handling UX (human-readable messages, recovery actions), edge case coverage (scroll position in selections, cross-origin iframes, shadow DOM, Windows signal handling), and clean npm distribution round out the product.

**Delivers:** `npm install -g claw-design && claw start` works end-to-end on a clean machine across macOS (ARM + Intel), Linux x64, and Windows x64. Error messages are human-readable with clear recovery actions. Selection works correctly after scrolling. Shadow DOM elements are captured. Orphan detection on startup handles crashed previous sessions. README covers installation and usage.

**Addresses:** Error handling and recovery (table stakes), framework agnosticism edge cases (shadow DOM, iframes), click-to-element selection (Phase 2 feature), responsive viewport switching

**Avoids:** Binary size surprise (document ~180MB install size prominently), Windows signal handling gaps (use `taskkill`, not POSIX signals), multi-monitor DPI bugs

**Research flag:** Standard packaging patterns. npm `bin` field distribution is well-documented. No additional research needed unless cross-platform testing reveals blocking issues.

### Phase Ordering Rationale

- Phases have hard sequential dependencies: CLI must work before Electron launches, Electron must show the site before overlay can be placed, capture data must exist before Claude can receive it
- Security architecture (Phase 2) cannot be retrofitted — IPC refactoring is expensive and blocks release
- Process lifecycle (Phase 1) cannot be retrofitted — adding `tree-kill` after the fact requires finding every process spawn site
- Capture (Phase 3) is tested independently of Claude Code — the selection and screenshot pipeline can be validated with console.log before the Agent SDK is integrated
- Claude Code integration (Phase 4) is isolated to its own phase because its failure modes are different from all other phases (external subprocess, API dependency, prompt quality iteration)

### Research Flags

**Needs `/gsd:research-phase` during planning:**
- **Phase 4 (Claude Code Integration):** Agent SDK multi-turn streaming input API, image content block support in user messages, and session recovery patterns need verification against current docs. This is the highest-uncertainty phase. Do not plan implementation details without confirming SDK capabilities.
- **Phase 3 (DOM Capture):** The optimal DOM serialization strategy for Claude context is empirical. Research how much context is useful vs. noise for different framework types (React CSS-in-JS, Tailwind, plain HTML). The transparent WebContentsView artifact bug (electron/electron#42335) should be prototyped before committing to the dual-view architecture.

**Standard patterns (skip research-phase):**
- **Phase 1 (CLI Foundation):** Process spawning, signal handling, TCP port polling, and commander usage are all well-documented with established patterns.
- **Phase 2 (Electron Shell):** BaseWindow + WebContentsView architecture is the current official Electron recommendation with full API docs. IPC patterns with contextBridge are standard.
- **Phase 5 (Distribution):** npm `bin` field distribution is straightforward. Cross-platform testing is execution work, not research.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All versions verified via npm and official sites on 2026-04-03. Technology choices are well-rationalized with explicit alternatives considered. The only MEDIUM-confidence item is `electron-vite ^5.0` (standalone, not Forge) due to it being described as experimental in some contexts — but electron-vite.org docs confirm v5 stability. |
| Features | HIGH | Competitive landscape analyzed via 4 direct competitors + 4 adjacent tools with live URLs and GitHub repos. Table stakes and differentiators align across multiple sources. Feature complexity estimates are conservative. |
| Architecture | MEDIUM-HIGH | Electron IPC, BaseWindow/WebContentsView, and process model patterns are from official Electron docs (HIGH). The transparent overlay compositing bug is confirmed in GitHub issues but workarounds are not yet empirically validated. Agent SDK streaming multi-turn API is referenced in docs but needs hands-on verification. |
| Pitfalls | HIGH | Critical pitfalls (orphan processes, DPI mismatch, security misconfiguration, BrowserView deprecation) are confirmed by multiple independent GitHub issues. Agent SDK failure modes are MEDIUM — documented but real-world behavior needs testing. |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **Agent SDK multi-turn streaming:** The `@anthropic-ai/claude-agent-sdk` `query()` function's ability to accept new user instructions without restarting the session needs explicit verification. If streaming input is not supported, Phase 4 must either restart Claude Code per instruction (3-5s overhead) or implement a custom stdin protocol.
- **Transparent WebContentsView compositing:** The known rendering artifact bug (electron/electron#42335) needs hands-on testing in Phase 3. If severe, the fallback is preload-injected overlay in a single BrowserWindow (simpler architecture, less isolation). This decision affects Phase 3 implementation approach.
- **DOM context quality for different frameworks:** How useful is DOM context for React CSS-in-JS apps vs. Tailwind apps vs. plain HTML? Edit accuracy below ~70% makes the tool frustrating. This needs empirical testing in Phase 4, with prompt iteration before declaring Phase 4 complete.
- **Cross-platform process management:** Windows does not support POSIX signals. `tree-kill` handles this, but the implementation needs explicit Windows testing. Dev server port detection patterns also differ (some tools auto-increment ports on Windows differently).
- **Dev server auto-detection coverage:** The current detection logic prioritizes `dev`, `start`, `serve` scripts. Real-world projects use `dev:local`, `dev:web`, `start:dev`, and other variants. Coverage needs empirical testing against a sample of popular frameworks and project templates.

## Sources

### Primary (HIGH confidence)
- [Electron Releases](https://releases.electronjs.org/) — version verification for Electron 36.x
- [Electron IPC Tutorial](https://www.electronjs.org/docs/latest/tutorial/ipc) — IPC invoke/handle patterns
- [Electron contextBridge](https://www.electronjs.org/docs/latest/api/context-bridge) — preload security model
- [Electron WebContentsView Migration](https://www.electronjs.org/blog/migrate-to-webcontentsview) — BrowserView deprecation, WebContentsView API
- [Electron Security Tutorial](https://www.electronjs.org/docs/latest/tutorial/security) — nodeIntegration, sandbox, CSP
- [Electron webContents API](https://www.electronjs.org/docs/latest/api/web-contents) — capturePage, executeJavaScript
- [Electron NativeImage API](https://www.electronjs.org/docs/latest/api/native-image) — crop, toPNG, toJPEG
- [Run Claude Code Programmatically](https://code.claude.com/docs/en/headless) — Agent SDK headless mode
- [Claude Agent SDK TypeScript Reference](https://platform.claude.com/docs/en/agent-sdk/typescript) — query(), streaming, image content blocks
- [Commander npm](https://www.npmjs.com/package/commander) — v14.0.3 current stable
- [tree-kill npm](https://www.npmjs.com/package/tree-kill) — v1.2.2, process tree cleanup
- [electron-vite Getting Started](https://electron-vite.org/guide/) — v5.0 stable, build tooling

### Secondary (MEDIUM confidence)
- [Design In The Browser](https://www.designinthebrowser.com/) — direct competitor, feature comparison
- [Frontman AI](https://frontman.sh/) — direct competitor, middleware approach, framework limitations
- [Stagewise](https://stagewise.io/) — direct competitor, overlay approach, pricing
- [Cursor Visual Editor](https://cursor.com/blog/browser-visual-editor) — direct competitor, Cursor-integrated
- [Onlook](https://www.onlook.com/) — adjacent tool, anti-feature reference (full design tool scope)
- [WebContentsView Transparent Bug](https://github.com/electron/electron/issues/42335) — rendering artifact confirmed
- [capturePage Empty on Windows](https://github.com/electron/electron/issues/31992) — hidden window capture confirmed
- [Electron DPI Issues](https://github.com/electron/electron/issues/8533) — multi-monitor DPI confirmed
- [sharp + Electron rebuild issues](https://github.com/lovell/sharp/issues/1951) — native module fragility confirmed
- [Aider Git Integration](https://aider.chat/docs/git.html) — auto-commit pattern reference

### Tertiary (LOW confidence)
- [Claude Code CLI subprocess session recovery](https://github.com/agentclientprotocol/claude-agent-acp/issues/338) — session recovery patterns, needs validation
- [Vite Port Resolution Issue](https://github.com/vitejs/vite/issues/7271) — port auto-detection challenges, version-specific

---
*Research completed: 2026-04-03*
*Ready for roadmap: yes*
