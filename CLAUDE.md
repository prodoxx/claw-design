<!-- GSD:project-start source:PROJECT.md -->
## Project

**claw-design**

A visual web development tool that lets developers point at parts of their running website and describe changes in natural language. Claw opens the user's localhost site in an Electron window with a selection overlay, captures screenshot + DOM context of selected regions, and sends instructions to a Claude Code session that edits the source code directly. Changes appear live via the dev server's hot module reload.

**Core Value:** Developers can visually select any part of their running website and describe changes in plain English — Claude edits the code, HMR shows the result. No context-switching between browser and editor.

### Constraints

- **Platform**: Electron for the browser window — needed for overlay control and tight CLI integration
- **Claude integration**: Spawns Claude Code CLI as subprocess — requires user to have Claude Code installed
- **Dev server**: Must support localhost URLs — the tool is for local development only
- **Open source**: License and repo structure must support community contributions
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Recommended Stack
### Runtime & Language
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Node.js | >=20.x LTS | Runtime | Commander 14 requires Node 20+. Electron 36 ships with Node 22.14 internally, but CLI entry runs on the user's Node. LTS alignment avoids compat issues. | HIGH |
| TypeScript | ~5.7 | Type safety | Electron IPC type safety is critical -- untyped IPC messages are a top source of runtime bugs in Electron apps. TS catches these at compile time. | HIGH |
### Electron
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Electron | ^36.x | Desktop shell | Latest stable (36.4.0 as of research date). Ships Chromium 136 + Node 22.14. v36 is in the supported window (36, 35, 34 currently maintained). 8-week major release cycle means we should pin to `^36` and update deliberately. | HIGH |
| electron-vite | ^5.0 | Build tooling | Standalone electron-vite over Electron Forge. Rationale below. | MEDIUM |
### CLI Framework
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| commander | ^14.0 | CLI parsing | Zero dependencies, fastest startup (18-25ms vs yargs 35-48ms vs oclif 85-135ms). claw-design has maybe 3-5 commands (`start`, `config`, etc.) -- commander handles this trivially. TypeScript types built-in. 35M weekly downloads. Requires Node 20+, which aligns with our runtime target. | HIGH |
### Screenshot & Image Processing
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Electron `webContents.capturePage()` | (built-in) | Region screenshot | Built into Electron -- no extra dependency. Accepts a `rect` parameter `{x, y, width, height}` to capture a specific region. Returns a `NativeImage` which has `.crop()`, `.toPNG()`, `.toJPEG(quality)`, `.toDataURL()`. This is exactly what we need for freeform region capture. | HIGH |
| Electron `NativeImage` | (built-in) | Image manipulation | Built-in crop, resize, format conversion. Eliminates need for sharp or any native image module. No native module rebuild headaches. | HIGH |
### DOM Inspection
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| `webContents.executeJavaScript()` | (built-in) | DOM extraction | Executes JS in the loaded page's context. We inject a script that calls `document.elementsFromPoint()` or `querySelectorAll()` within the selected region bounds, then serializes element info (tag, classes, IDs, text content, computed styles) into a JSON-serializable object. Returns via Promise. | HIGH |
### IPC & Process Communication
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Electron IPC (`ipcMain` / `ipcRenderer`) | (built-in) | Main <-> Renderer | Standard Electron IPC with `contextBridge` + `contextIsolation` (default since Electron 12). Renderer exposes typed API via preload script. No third-party IPC library needed. | HIGH |
| `contextBridge.exposeInMainWorld()` | (built-in) | Security boundary | Exposes specific functions to renderer, not raw `ipcRenderer`. Security best practice since 2020, mandatory pattern in 2025+. | HIGH |
| Node.js `child_process.spawn()` | (built-in) | CLI -> Dev server, CLI -> Claude Code | Built-in spawn is sufficient for managing two child processes. Both dev server and Claude Code are long-running processes with stdout/stderr streaming. | MEDIUM |
- **stdin/stdout** of the Electron child process (simple, sufficient)
- **Local IPC socket** (more robust, allows bidirectional messaging)
### Process Management
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Node.js `child_process.spawn()` | (built-in) | Spawn dev server + Claude Code | For two long-running processes, built-in spawn with `{ stdio: 'pipe' }` is appropriate. No need for execa's extra features. | MEDIUM |
| tree-kill | ^1.2.2 | Process cleanup | Kills entire process tree on exit. Dev servers (especially webpack/vite) spawn child processes. A simple `process.kill(pid)` leaves orphans. tree-kill handles this. 22M weekly downloads, stable (no changes needed in 6 years -- the API surface is "kill a process tree", it's done). | HIGH |
| `process.on('exit')` / signal handlers | (built-in) | Graceful shutdown | Trap SIGINT, SIGTERM, uncaught exceptions. Kill dev server tree, kill Claude Code, close Electron. Prevents zombie processes. | HIGH |
### Terminal UI
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| picocolors | ^1.1 | Terminal colors | 14x smaller than chalk, 2x faster. No ESM-only complications (supports both CJS and ESM). Used by PostCSS, Browserslist, Stylelint. For a CLI that prints status messages, 16 colors is plenty -- we don't need chalk's truecolor. | HIGH |
| ora | ^8.x | Spinners | Loading spinners for "Starting dev server...", "Sending to Claude Code...", etc. The standard choice, used everywhere. ESM-only in v8, but our project will be ESM (electron-vite enforces this). | MEDIUM |
### Testing
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Vitest | ^3.x | Unit & integration tests | Natural pairing with electron-vite (both Vite-based). Fast, TypeScript-first, Jest-compatible API. | MEDIUM |
| @playwright/test | ^1.50 | E2E for Electron | Playwright has first-class Electron support via `electron.launch()`. Can test the full flow: launch app, interact with overlay, verify screenshots. | MEDIUM |
### Packaging & Distribution
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| npm (package.json `bin` field) | -- | Distribution | This is a dev tool. Distribute via `npm install -g claw-design` or `npx claw-design start`. The `bin` field in package.json points to the CLI entry. No native installers, no app store, no DMG. | HIGH |
| `electron` as dependency | ^36.x | Electron binary | Listed as a regular dependency (not devDependency). When users `npm install -g claw-design`, the electron postinstall script downloads the platform-appropriate binary automatically. ~180MB per platform. | HIGH |
## Full Dependency List
### Production Dependencies
| Package | Version | Size Impact | Purpose |
|---------|---------|-------------|---------|
| electron | ^36.0.0 | ~180MB (binary) | Desktop shell |
| commander | ^14.0.0 | ~50KB | CLI parsing |
| picocolors | ^1.1.0 | ~6KB | Terminal colors |
| ora | ^8.0.0 | ~30KB | Spinners |
| tree-kill | ^1.2.2 | ~8KB | Process tree cleanup |
### Dev Dependencies
| Package | Version | Purpose |
|---------|---------|---------|
| electron-vite | ^5.0.0 | Build tooling (main/preload/renderer) |
| typescript | ~5.7 | Type checking |
| vitest | ^3.0.0 | Testing |
| @playwright/test | ^1.50.0 | E2E testing |
| @types/node | ^22.x | Node type definitions |
## Project Structure
## Alternatives Considered
| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Build tooling | electron-vite | Electron Forge + Vite plugin | Forge's Vite support is experimental; Forge adds unnecessary packaging infrastructure for an npm-distributed CLI tool |
| Build tooling | electron-vite | electron-builder | electron-builder focuses on native packaging/installers we don't need; heavier config |
| CLI framework | commander | yargs | Heavier, slower startup, unnecessary middleware system |
| CLI framework | commander | oclif | Enterprise plugin architecture is massive overkill for <10 commands |
| Image processing | NativeImage (built-in) | sharp | Native module rebuild issues with Electron; NativeImage already provides crop/toPNG/toJPEG |
| Process mgmt | spawn + tree-kill | execa | ESM-only complication; execa optimized for one-shot commands, not long-running processes |
| Process mgmt | spawn + tree-kill | pm2 | Production process manager, wrong abstraction for dev-time child processes |
| Terminal colors | picocolors | chalk | chalk is 7x larger, ESM-only since v5, truecolor unnecessary |
| Terminal colors | picocolors | ansis | ansis is excellent but picocolors has broader adoption (used by PostCSS ecosystem) |
| Distribution | npm `bin` field | Electron Forge makers | Native installers are premature; developers expect `npm install` |
## Key Technical Decisions
### 1. CLI spawns Electron, not the other way around
- The CLI can run without Electron (for future headless/API modes)
- Clean process lifecycle management from a single parent
- Electron is a "view" that the CLI orchestrates, not the orchestrator itself
### 2. Renderer loads user's localhost directly
- Zero framework coupling (works with React, Vue, Svelte, plain HTML, anything)
- User sees their real site, not a proxy or iframe
- HMR works naturally -- the BrowserWindow is just another browser tab
### 3. Screenshot as PNG buffer, not file
### 4. DOM context as serialized JSON, not HTML string
## Version Verification Log
| Technology | Claimed Version | Verified Via | Verification Date |
|------------|----------------|--------------|-------------------|
| Electron | 36.x (36.4.0 latest) | electronjs.org/releases, npm | 2026-04-03 |
| electron-vite | 5.0.0 | npm, electron-vite.org | 2026-04-03 |
| commander | 14.0.3 | npm, github releases | 2026-04-03 |
| tree-kill | 1.2.2 | npm | 2026-04-03 |
| execa (NOT used) | 9.6.1 | npm | 2026-04-03 |
| picocolors | 1.1.x | npm | 2026-04-03 |
| ora | 8.x | npm | 2026-04-03 |
## Sources
- [Electron Releases](https://releases.electronjs.org/) - version verification
- [Electron Forge - Why Electron Forge](https://www.electronforge.io/core-concepts/why-electron-forge) - Forge vs Builder comparison
- [electron-vite Getting Started](https://electron-vite.org/guide/) - electron-vite docs and version
- [Electron IPC Tutorial](https://www.electronjs.org/docs/latest/tutorial/ipc) - IPC patterns
- [Electron contextBridge](https://www.electronjs.org/docs/latest/api/context-bridge) - security model
- [Electron webContents](https://www.electronjs.org/docs/latest/api/web-contents) - capturePage, executeJavaScript
- [Electron NativeImage](https://www.electronjs.org/docs/latest/api/native-image) - crop, toPNG, toDataURL
- [Electron Context Isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation) - security defaults
- [Commander npm](https://www.npmjs.com/package/commander) - v14.0.3 verification
- [tree-kill npm](https://www.npmjs.com/package/tree-kill) - v1.2.2 verification
- [picocolors GitHub](https://github.com/alexeyraspopov/picocolors) - size/performance comparison
- [sharp + Electron issues](https://github.com/lovell/sharp/issues/1951) - native module rebuild problems
- [Electron executeJavaScript limitations](https://github.com/electron/electron/issues/9288) - DOM elements cannot cross IPC
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
