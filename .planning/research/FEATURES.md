# Feature Landscape

**Domain:** Visual web development tool with AI-assisted code editing (browser-to-source workflow)
**Researched:** 2026-04-03
**Overall Confidence:** HIGH (multiple direct competitors and adjacent tools analyzed)

## Competitive Context

Claw sits at the intersection of several tool categories. Understanding what each category considers table stakes informs what users will expect from Claw even though it approaches the problem differently.

**Direct competitors (visual browser-to-source editing):**
- **Design In The Browser** -- Near-identical concept: point at elements in a browser, describe changes, AI edits source via Claude Code/Cursor/Gemini CLI. Free, desktop app, v1.5.2 as of early 2026.
- **Frontman** -- Framework middleware that installs inside dev servers (Next.js, Astro, Vite). Click any element, get component tree + computed styles + source map resolution. Runs its own AI agent with BYOK. Open source.
- **Stagewise** -- Browser toolbar injected via CLI proxy. Select DOM elements, describe changes, routes to IDE agent (Cursor/Copilot/Windsurf) or built-in agent. Pivoting to full Electron-based "developer browser." YC-backed, EUR 20/month.
- **Cursor Visual Editor** -- Point-and-prompt in Cursor's built-in browser. Drag-and-drop elements, design sidebar with sliders/color pickers, parallel AI agents. Cursor 2.2+ (Dec 2025). Requires Cursor IDE.

**Adjacent tools (visual-first code generation):**
- **Onlook** -- Figma-like visual editor for React/Next.js/Tailwind. Open source. Direct DOM manipulation, real-time code sync.
- **Vercel v0** -- Text-to-React-component generation. Full-stack app builder as of 2026. No connection to existing codebases.
- **Bolt.new / Lovable** -- AI app builders that generate and host full apps. No existing-codebase editing.

**Underlying infrastructure tools:**
- **Domscribe** -- DOM-to-source mapping library. Build-time IDs, manifest files, MCP integration. Framework-agnostic. Open source.
- **Chrome DevTools MCP** -- Exposes DevTools state to AI agents. DOM/CSS inspection, accessibility, network, performance. 26 tools across 6 categories.
- **Click-to-Component plugins** -- Vite plugins (vite-plugin-react-inspector, vite-plugin-dev-inspector) that map browser elements to source files.

---

## Table Stakes

Features users expect. Missing = product feels incomplete or broken compared to alternatives.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Visual element selection** | Core value proposition -- every competitor has this. Users must be able to point at what they want changed. | Medium | Claw uses freeform region selection (draw a box). Competitors offer both click-to-element AND region select. Region-only is viable for v1 but click-to-element will be expected quickly. |
| **Screenshot capture of selection** | AI needs visual context to understand what the user sees. Design In The Browser, Cursor, and Stagewise all send screenshots. | Low | Electron makes this straightforward with `webContents.capturePage()` or similar. |
| **DOM context extraction** | Screenshot alone is insufficient -- AI needs structure (classes, IDs, text content, hierarchy) to find the right source files. Every competitor provides DOM context. | Medium | Capturing DOM within a selection region requires coordinate-to-element mapping. Competitors like Frontman go deeper with component tree + computed styles. |
| **Natural language instruction input** | Users describe what they want in plain English. This is the universal interaction pattern across ALL tools in this space. | Low | Text input after selection. Every tool does this. |
| **AI-powered source code editing** | The AI must edit actual source files, not just suggest changes. Claude Code, Cursor, Aider all do multi-file edits. | Low (delegated) | Claw delegates this to Claude Code CLI which already handles codebase navigation, file editing, and multi-file changes. Claw's job is providing good context. |
| **Live preview via HMR** | Changes must appear immediately. Users see the result without manual refresh. Every modern dev tool integrates with HMR. | Low (delegated) | Claw relies on the user's dev server HMR. No custom implementation needed. Key: don't break HMR by interfering with the dev server process. |
| **Dev server management** | `claw start` must handle spawning the dev server. Users expect one command to get going. Design In The Browser and Stagewise both handle this. | Medium | Auto-detect start command from package.json. Handle process lifecycle, port detection, graceful shutdown. |
| **Framework agnosticism** | Tools that work with only one framework lose the majority of potential users. Even Frontman (only Next/Astro/Vite) is criticized for limited framework support. | Medium | Claw achieves this by NOT requiring framework-specific plugins. DOM capture + screenshots work with any framework. Claude Code handles any codebase. This is a strength. |
| **Error handling and recovery** | When AI makes wrong changes, users need a way out. Cursor's checkpoint bugs are a top complaint. Aider's auto-commit + /undo is praised. | Medium | At minimum: clear error messages when Claude Code fails. Better: leverage git for recovery (auto-commit before changes, easy revert). PROJECT.md explicitly defers undo to git, which is fine IF the git workflow is smooth. |
| **Clear status feedback** | Users must know what's happening: "Capturing selection...", "Sending to Claude...", "Claude is editing files...", "Changes applied." | Low | Cursor and Frontman show real-time progress. CLI tools show streaming output. Claw needs status indicators in the Electron overlay. |

---

## Differentiators

Features that set Claw apart. Not expected by default, but create competitive advantage when present.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Zero-config framework agnosticism** | Unlike Frontman (requires middleware), Stagewise (requires proxy setup), and Cursor Visual Editor (requires Cursor IDE) -- Claw works with ANY web framework without plugins, middleware, or config. Just `claw start` and point. | Already designed | This is Claw's strongest differentiator. Most competitors require framework-specific integration. Claw's approach of screenshot + DOM + Claude Code means it works with Rails, Django, Laravel, plain HTML, etc. -- not just JS frameworks. |
| **CLI-first one-command workflow** | `claw start` spawns dev server + Electron + Claude Code session. One command, zero setup. Design In The Browser requires manual Claude Code/Cursor setup. Frontman requires middleware installation. | Medium | Key: auto-detection of dev server command, port, and URL. Fallback to manual `--cmd` and `--url` flags. |
| **Open source with no API keys required (beyond Claude)** | Frontman requires BYOK but wraps its own agent. Stagewise charges EUR 20/month. Claw just uses Claude Code the user already has. | Low | No vendor lock-in, no additional billing. Users pay Anthropic directly. |
| **Multi-element batch selection** | Select multiple regions, describe changes for each, send them all to Claude Code as a coordinated request. Design In The Browser has this ("queue up changes, send them all at once"). Most others are single-element. | High | This is a strong workflow feature but complex to implement well. Defer to post-v1. |
| **Iterative visual feedback loop** | Select area -> describe change -> see result via HMR -> select again -> refine. The tight loop of "see problem -> describe fix -> see result" without leaving the visual context is the core magic. | Medium | Requires the Electron window to maintain state across interactions. The overlay should support repeated select-describe cycles in a continuous session. |
| **Reference image support** | Drop a screenshot or design mockup for AI to match. "Make this look like this." Design In The Browser supports this. v0 supports Figma import. | Medium | Useful for design-to-code workflows. Can be added post-v1 as an enhancement. |
| **Responsive viewport switching** | Switch between desktop/tablet/mobile viewports without resizing the window. Design In The Browser has this. | Low | Electron `BrowserWindow` resize + viewport meta tag. Nice quality-of-life feature. |
| **CSS inspection overlay** | Hold modifier key to inspect computed styles of elements. Copy values. Design In The Browser has ALT-to-inspect. Browser DevTools do this natively. | Medium | Adds precision to the "what am I looking at" step. Useful but not critical for v1. |
| **Auto-commit before AI changes** | Like Aider: automatically commit current state before AI edits, so `git checkout .` always reverts to the pre-change state. Makes git-as-undo actually reliable. | Medium | Aider proves this pattern works. Addresses the "undo" gap without building custom undo UI. |

---

## Anti-Features

Features to explicitly NOT build. Building these would waste effort, bloat scope, or misposition the product.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Built-in AI agent / LLM integration** | Claw's value is the VISUAL LAYER, not the AI layer. Frontman bundles its own agent and is limited by it. Claw delegates to Claude Code which is already the best agentic coder. Don't compete with Claude Code; augment it. | Spawn Claude Code CLI as a subprocess. Send it rich visual context. Let it do what it's best at. |
| **In-app code editor** | Users have their IDE. Onlook and Cursor have editors because they ARE editors. Claw is a visual selection tool, not an IDE. Adding a code editor would create a worse version of what users already have. | Claude Code edits files directly. Users view changes in their IDE. Claw shows the visual result. |
| **Full design tool (Figma-like canvas)** | Onlook went this route and it's a massive scope commitment. Drag-and-drop DOM manipulation, design tokens, style panels -- this is a different product entirely. | Keep the overlay lightweight: selection, instruction, status. Don't try to be Figma. |
| **Custom undo/redo system** | Complex state management across multiple files. Cursor's checkpoint system is notoriously buggy (silent reverts, missing undo buttons, sync conflicts reported through early 2026). Git already provides undo. Aider proves that git-based undo is the right pattern. | Encourage git-based workflow. Consider: auto-commit before AI changes (like Aider) so `git checkout .` is always safe. |
| **Deployment / hosting** | Bolt.new and Lovable handle deployment. Claw is a local development tool. Deployment is a different problem solved by different tools. | Out of scope. Users deploy however they normally deploy. |
| **Project scaffolding / app generation** | v0, Bolt, and Lovable generate apps from scratch. Claw works with EXISTING codebases. Different use case, different user, different product. | Claw starts with `claw start` in an existing project directory. The codebase already exists. |
| **Multi-user collaboration** | Real-time multiplayer editing is enormously complex (VS Code Live Share, Replit). Claw is a single-developer tool. Adding collaboration before nailing the core loop is premature. | Single developer, single session. Collaboration can come later if demand warrants it. |
| **Non-web projects** | Mobile apps, desktop apps, backend-only changes. Claw's value is the visual bridge between browser and source. Non-web projects don't have this gap. | Scoped to web development with a localhost dev server. Period. |
| **Browser extension version** | Chrome extensions can't control the CLI experience, can't spawn processes, and require separate installation. Electron gives full control over the entire experience. | Electron-only. One `claw start` command controls everything. |
| **Framework-specific plugins/middleware** | Frontman requires middleware per framework. This limits reach and creates maintenance burden. Claw's framework-agnosticism is a competitive advantage -- don't sacrifice it. | DOM capture is framework-agnostic. Claude Code handles any codebase. No plugins needed. |
| **Direct Claude API integration (bypassing Claude Code)** | Claude Code handles codebase navigation, file discovery, multi-file editing, tool use, and git. Reimplementing this is months of work and would be worse. | Always go through Claude Code CLI. It's the reason this tool can be built by a small team. |

---

## Feature Dependencies

```
Dev server management ─────────────────────────┐
                                                v
Auto-detect dev server command ──> Spawn dev server ──> Detect port/URL ──> Load in Electron
                                                                                    |
                                                                                    v
                                                                    Visual selection overlay
                                                                           |
                                                               ┌───────────┴───────────┐
                                                               v                       v
                                                    Screenshot capture        DOM context extraction
                                                               |                       |
                                                               └───────────┬───────────┘
                                                                           v
                                                            Natural language input
                                                                           |
                                                                           v
                                                            Send context to Claude Code
                                                                           |
                                                                           v
                                                            Claude Code edits source files
                                                                           |
                                                                           v
                                                            HMR reflects changes
                                                                           |
                                                                           v
                                                            User sees result, iterates
```

Key dependency chains:

1. **Dev server management** must work before anything visual can happen
2. **Electron window + overlay** must load before selection is possible
3. **Screenshot + DOM capture** both depend on a working selection mechanism
4. **Claude Code session** must be spawned and ready before instructions can be sent
5. **HMR** depends on the dev server still running (don't break its process)

Cross-cutting concerns:
- **Error handling** touches every step (dev server crash, selection failure, Claude Code error, HMR not working)
- **Status feedback** must report on every transition between steps
- **Process lifecycle** (dev server, Electron, Claude Code) must handle graceful startup and shutdown

---

## MVP Recommendation

### Prioritize (Phase 1 -- Core Loop)

1. **CLI entry point** (`claw start`) with dev server auto-detection and spawning
2. **Electron window** loading the user's localhost URL
3. **Freeform region selection overlay** (draw a box)
4. **Screenshot capture** of selected region
5. **DOM context extraction** within selected region
6. **Instruction input** (text field appears after selection)
7. **Send to Claude Code** (screenshot + DOM + instruction as a coordinated prompt)
8. **Status feedback** (what's happening at each step)
9. **Process lifecycle management** (graceful startup/shutdown of all three processes)

### Prioritize (Phase 2 -- Polish the Loop)

10. **Click-to-element selection** (in addition to freeform region)
11. **Iterative refinement** (re-select same or nearby area to continue editing)
12. **Better DOM context** (computed styles, parent hierarchy, nearby elements)
13. **Error recovery UX** (clear messaging when Claude Code fails, easy retry)
14. **Responsive viewport switching** (desktop/tablet/mobile)

### Defer (Phase 3+ -- Expansion)

15. **Multi-element batch selection** (queue multiple selections)
16. **Reference image support** (drop a design to match)
17. **CSS inspection overlay** (ALT-to-inspect styles)
18. **Session history** (what changes were made, what instructions were given)
19. **Auto-commit before changes** (Aider-style git safety net)
20. **Keyboard shortcuts** for power users

### Defer Indefinitely

- Design tool features (drag-and-drop, style panels)
- In-app code editor
- Project scaffolding
- Deployment features
- Multi-user collaboration
- Framework-specific plugins

---

## Feature Complexity Assessment

| Feature | Complexity | Rationale |
|---------|------------|-----------|
| CLI entry point + dev server management | Medium | Process spawning, port detection, package.json parsing, error handling for diverse project setups |
| Electron window loading localhost | Low | Standard Electron BrowserWindow, webContents.loadURL |
| Freeform region selection overlay | Medium | Canvas overlay on top of web content, mouse event handling, coordinate capture, visual feedback |
| Screenshot capture | Low | Electron's native screenshot APIs. Crop to selection coordinates. |
| DOM context extraction | Medium-High | Map screen coordinates to DOM elements. Extract relevant subtree. Handle iframes, shadow DOM, complex layouts. Need to extract enough context without overwhelming Claude. |
| Instruction input | Low | Text input UI element, basic form handling |
| Claude Code integration | Medium | Spawn CLI subprocess, format prompt with screenshot + DOM context, stream output, handle errors |
| Status feedback UI | Low | Simple state machine with visual indicators in the overlay |
| Process lifecycle | Medium | Three child processes (dev server, Electron renderer, Claude Code) with proper signal handling, port cleanup, crash recovery |
| Click-to-element selection | Medium | Element highlighting on hover, click to select, extract single element context |
| Multi-element batch | High | UI for managing multiple selections, coordinating them into a single prompt, showing status per selection |
| Reference image support | Medium | Drag-and-drop image, include in Claude prompt alongside screenshot |
| Responsive viewports | Low | Window resize + viewport emulation |
| CSS inspection | Medium | Computed style extraction, overlay display, copy-to-clipboard |
| Git integration (auto-commit) | Medium | Auto-commit, branch detection, revert commands, integration with Claude Code's git awareness |

---

## Competitive Positioning Map

| Capability | Claw (planned) | Design In The Browser | Frontman | Stagewise | Cursor Visual Editor |
|------------|---------------|----------------------|----------|-----------|---------------------|
| Visual selection | Region draw | Click + region | Click element | Click element + annotate | Click + drag-and-drop |
| AI backend | Claude Code CLI | Claude Code / Cursor / Gemini CLI | Built-in agent (BYOK) | Built-in + IDE bridge | Cursor's built-in agents |
| Framework support | Any (no plugins) | Any (no plugins) | Next.js, Astro, Vite only | React, Vue, Angular, Next, Svelte | Any (via Cursor Browser) |
| Setup friction | `claw start` (one cmd) | Download app + install AI tool | npm install middleware + config | `npx stagewise@latest` | Already using Cursor |
| Requires IDE | No | No | No | Optional (bridge mode) | Yes (Cursor) |
| Open source | Yes | Yes | Yes | No (paid) | No (paid) |
| Cost | Free (Claude sub) | Free (Claude sub) | Free (BYOK) | EUR 20/month | Cursor subscription |
| DOM-to-source mapping | Claude searches codebase | Click-to-source | Component tree + source maps | DOM + screenshot | Component inspection |
| Code editing | Claude Code (multi-file) | Claude Code / Cursor | Built-in agent | IDE agent | Cursor agent |
| HMR integration | Dev server's own HMR | Dev server's own HMR | Framework middleware HMR | Dev server's own HMR | Cursor Browser |

**Claw's unique angle:** Framework-agnostic + CLI-first + Claude Code native + open source + zero-config. The closest competitor (Design In The Browser) shares the same philosophy but Claw can differentiate through better DX (one command vs. manual setup), deeper DOM context extraction, and tighter Claude Code integration as a purpose-built Claude Code companion rather than a multi-AI-tool wrapper.

---

## Sources

- [Cursor Visual Editor Blog Post](https://cursor.com/blog/browser-visual-editor)
- [Cursor Features](https://cursor.com/features)
- [Design In The Browser](https://www.designinthebrowser.com/)
- [Frontman AI](https://frontman.sh/)
- [Frontman GitHub](https://github.com/frontman-ai/frontman)
- [Frontman Feature Comparison](https://frontman.sh/compare/)
- [Stagewise GitHub](https://github.com/stagewise-io/stagewise)
- [Stagewise](https://stagewise.io/)
- [Onlook](https://www.onlook.com/)
- [Onlook GitHub](https://github.com/onlook-dev/onlook)
- [Domscribe](https://www.domscribe.com/)
- [Chrome DevTools MCP](https://developer.chrome.com/blog/chrome-devtools-mcp)
- [AI Coding Tools That Actually See Your Browser (2026)](https://dev.to/bluehotdog/ai-coding-tools-that-actually-see-your-browser-2026-2hoc)
- [Claude Code Overview](https://code.claude.com/docs/en/overview)
- [Aider Git Integration](https://aider.chat/docs/git.html)
- [Vercel v0](https://v0.app/)
- [Cursor Checkpoints Guide](https://stevekinney.com/courses/ai-development/cursor-checkpoints)
- [Cursor Problems 2026](https://vibecoding.app/blog/cursor-problems-2026)
- [vite-plugin-react-inspector](https://www.npmjs.com/package/vite-plugin-react-inspector)
- [vite-plugin-dev-inspector](https://github.com/hellof2e/vite-plugin-dev-inspector)
