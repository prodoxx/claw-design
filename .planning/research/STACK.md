# Technology Stack

**Project:** claw-design
**Researched:** 2026-04-03
**Overall Confidence:** MEDIUM-HIGH (versions verified via npm/official docs; some Electron Forge Vite details are experimental)

---

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

**Why electron-vite over Electron Forge:**

Electron Forge is the "official" tool, but for this project electron-vite (standalone, `npm: electron-vite@5.0`) is the better fit:

1. **Forge's Vite support is experimental** -- marked experimental since v7.5.0 with potential breaking changes in minor releases. electron-vite's Vite integration is mature and stable.
2. **Simpler mental model** -- claw-design is NOT a traditional desktop app. It's a CLI tool that conditionally spawns an Electron window. Forge assumes you're building a "normal" Electron app with packaging, installers, auto-update. We don't need any of that for v1 -- users install via npm and run `claw start`.
3. **Lighter dependency tree** -- Forge pulls in @electron/packager, @electron/osx-sign, electron-winstaller and more. Unnecessary weight for a dev tool distributed via npm.
4. **electron-vite has better DX** -- auto-discovers main/preload/renderer entry points from `src/` convention, built-in HMR for renderer, first-class TypeScript.

**When to reconsider Forge:** If we later need native installers, code signing, or auto-update for non-developer end users. For an OSS dev tool installed via `npm i -g`, this is unlikely.

### CLI Framework

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| commander | ^14.0 | CLI parsing | Zero dependencies, fastest startup (18-25ms vs yargs 35-48ms vs oclif 85-135ms). claw-design has maybe 3-5 commands (`start`, `config`, etc.) -- commander handles this trivially. TypeScript types built-in. 35M weekly downloads. Requires Node 20+, which aligns with our runtime target. | HIGH |

**Why NOT yargs:** More powerful parsing but heavier, slower startup. We don't need middleware chains or complex validation for `claw start --cmd "npm run dev" --port 3000`.

**Why NOT oclif:** Enterprise-grade plugin architecture. Massive overkill for a tool with <10 commands. Slowest startup at 85-135ms adds latency users feel on every invocation.

### Screenshot & Image Processing

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Electron `webContents.capturePage()` | (built-in) | Region screenshot | Built into Electron -- no extra dependency. Accepts a `rect` parameter `{x, y, width, height}` to capture a specific region. Returns a `NativeImage` which has `.crop()`, `.toPNG()`, `.toJPEG(quality)`, `.toDataURL()`. This is exactly what we need for freeform region capture. | HIGH |
| Electron `NativeImage` | (built-in) | Image manipulation | Built-in crop, resize, format conversion. Eliminates need for sharp or any native image module. No native module rebuild headaches. | HIGH |

**Why NOT sharp:** Sharp is the gold standard for Node.js image processing, but it's a native module that requires `@electron/rebuild` to work with Electron's Node ABI. This is a known source of installation failures (multiple open issues on sharp's GitHub). Since Electron's built-in `NativeImage` provides crop and format conversion, adding sharp would add complexity and fragility for zero benefit.

**Why NOT desktopCapturer:** desktopCapturer captures desktop screens/windows, not webpage content. We need to capture the rendered webpage inside the BrowserWindow. `webContents.capturePage()` is purpose-built for this.

### DOM Inspection

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| `webContents.executeJavaScript()` | (built-in) | DOM extraction | Executes JS in the loaded page's context. We inject a script that calls `document.elementsFromPoint()` or `querySelectorAll()` within the selected region bounds, then serializes element info (tag, classes, IDs, text content, computed styles) into a JSON-serializable object. Returns via Promise. | HIGH |

**Critical constraint:** DOM elements themselves cannot cross the IPC boundary. The injected script must serialize relevant data (tag names, class lists, IDs, text content, bounding rects) into plain objects before returning.

**Pattern:**
```typescript
// In main process, after user selects a region {x, y, width, height}
const domContext = await win.webContents.executeJavaScript(`
  (function() {
    const rect = { left: ${x}, top: ${y}, right: ${x + width}, bottom: ${y + height} };
    const allElements = document.querySelectorAll('*');
    const inRegion = [];
    for (const el of allElements) {
      const box = el.getBoundingClientRect();
      if (box.right > rect.left && box.left < rect.right &&
          box.bottom > rect.top && box.top < rect.bottom) {
        inRegion.push({
          tag: el.tagName.toLowerCase(),
          id: el.id || null,
          classes: [...el.classList],
          text: el.textContent?.slice(0, 200) || '',
          rect: { x: box.x, y: box.y, w: box.width, h: box.height }
        });
      }
    }
    return inRegion;
  })()
`);
```

### IPC & Process Communication

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Electron IPC (`ipcMain` / `ipcRenderer`) | (built-in) | Main <-> Renderer | Standard Electron IPC with `contextBridge` + `contextIsolation` (default since Electron 12). Renderer exposes typed API via preload script. No third-party IPC library needed. | HIGH |
| `contextBridge.exposeInMainWorld()` | (built-in) | Security boundary | Exposes specific functions to renderer, not raw `ipcRenderer`. Security best practice since 2020, mandatory pattern in 2025+. | HIGH |
| Node.js `child_process.spawn()` | (built-in) | CLI -> Dev server, CLI -> Claude Code | Built-in spawn is sufficient for managing two child processes. Both dev server and Claude Code are long-running processes with stdout/stderr streaming. | MEDIUM |

**IPC Architecture (3 processes):**

```
CLI Process (Node.js)
  |-- spawns --> Dev Server (child_process)
  |-- spawns --> Claude Code CLI (child_process)  
  |-- spawns --> Electron Main Process
                    |-- IPC --> Renderer (BrowserWindow loading localhost)
                                 |-- preload script with contextBridge
```

The CLI process is the orchestrator. It spawns Electron as a child (using `electron` binary path from the local `node_modules`). Communication between CLI and Electron main can use:
- **stdin/stdout** of the Electron child process (simple, sufficient)
- **Local IPC socket** (more robust, allows bidirectional messaging)

Recommendation: Start with stdin/stdout JSON messages between CLI and Electron main. Upgrade to socket if needed.

### Process Management

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Node.js `child_process.spawn()` | (built-in) | Spawn dev server + Claude Code | For two long-running processes, built-in spawn with `{ stdio: 'pipe' }` is appropriate. No need for execa's extra features. | MEDIUM |
| tree-kill | ^1.2.2 | Process cleanup | Kills entire process tree on exit. Dev servers (especially webpack/vite) spawn child processes. A simple `process.kill(pid)` leaves orphans. tree-kill handles this. 22M weekly downloads, stable (no changes needed in 6 years -- the API surface is "kill a process tree", it's done). | HIGH |
| `process.on('exit')` / signal handlers | (built-in) | Graceful shutdown | Trap SIGINT, SIGTERM, uncaught exceptions. Kill dev server tree, kill Claude Code, close Electron. Prevents zombie processes. | HIGH |

**Why NOT execa:** execa v9.6.1 is pure ESM, which complicates integration. More importantly, execa's value is in one-shot commands (run, get output, done). Our processes are long-running with streaming stdio. Built-in `spawn()` with manual stream handling is actually cleaner for this use case. The `gracefulCancel` feature is nice but tree-kill + signal handlers achieve the same result with less abstraction.

**Why NOT pm2/forever:** These are production process managers. We're managing dev-time child processes within a single CLI session. Over-engineered.

### Terminal UI

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| picocolors | ^1.1 | Terminal colors | 14x smaller than chalk, 2x faster. No ESM-only complications (supports both CJS and ESM). Used by PostCSS, Browserslist, Stylelint. For a CLI that prints status messages, 16 colors is plenty -- we don't need chalk's truecolor. | HIGH |
| ora | ^8.x | Spinners | Loading spinners for "Starting dev server...", "Sending to Claude Code...", etc. The standard choice, used everywhere. ESM-only in v8, but our project will be ESM (electron-vite enforces this). | MEDIUM |

**Why NOT chalk:** ESM-only since v5, 44KB vs picocolors' 6KB. Chalk's truecolor and advanced styling are features we'll never use for `console.log(green("Server started"))`.

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

**Distribution model:**
```json
{
  "name": "claw-design",
  "bin": {
    "claw": "./dist/cli/index.js"
  },
  "dependencies": {
    "electron": "^36.0.0"
  }
}
```

Users run: `npm install -g claw-design && claw start`

The `claw` CLI detects the Electron binary from its own `node_modules` and spawns it. No system-wide Electron install needed.

**Why NOT Electron Forge / electron-builder for packaging:** These create native installers (.dmg, .exe, .deb). Claw is a developer tool -- developers have Node.js and npm. npm distribution is the simplest, most familiar path. Adding native installers is premature optimization for v1.

---

## Full Dependency List

### Production Dependencies

```bash
npm install electron commander picocolors ora tree-kill
```

| Package | Version | Size Impact | Purpose |
|---------|---------|-------------|---------|
| electron | ^36.0.0 | ~180MB (binary) | Desktop shell |
| commander | ^14.0.0 | ~50KB | CLI parsing |
| picocolors | ^1.1.0 | ~6KB | Terminal colors |
| ora | ^8.0.0 | ~30KB | Spinners |
| tree-kill | ^1.2.2 | ~8KB | Process tree cleanup |

### Dev Dependencies

```bash
npm install -D electron-vite typescript vitest @playwright/test \
  @types/node
```

| Package | Version | Purpose |
|---------|---------|---------|
| electron-vite | ^5.0.0 | Build tooling (main/preload/renderer) |
| typescript | ~5.7 | Type checking |
| vitest | ^3.0.0 | Testing |
| @playwright/test | ^1.50.0 | E2E testing |
| @types/node | ^22.x | Node type definitions |

---

## Project Structure

```
claw-design/
  src/
    cli/                  # CLI entry point (commander)
      index.ts            # `claw start` command
      process-manager.ts  # Spawn/manage dev server + Claude Code
    main/                 # Electron main process
      index.ts            # BrowserWindow creation, IPC handlers
      capture.ts          # Screenshot + DOM extraction
      ipc-handlers.ts     # IPC message routing
    preload/              # Preload script
      index.ts            # contextBridge API exposure
    renderer/             # Renderer (selection overlay UI)
      index.html
      overlay.ts          # Canvas-based selection drawing
      ui.ts               # Instruction input box
  electron.vite.config.ts # electron-vite configuration
  tsconfig.json
  package.json
```

electron-vite auto-discovers `src/main`, `src/preload`, and `src/renderer` by convention.

---

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

---

## Key Technical Decisions

### 1. CLI spawns Electron, not the other way around

The CLI (`claw start`) is the entry point. It spawns the dev server, Claude Code, and Electron as child processes. This means:
- The CLI can run without Electron (for future headless/API modes)
- Clean process lifecycle management from a single parent
- Electron is a "view" that the CLI orchestrates, not the orchestrator itself

### 2. Renderer loads user's localhost directly

The Electron BrowserWindow loads `http://localhost:<port>` -- the user's actual running site. The selection overlay is injected via the preload script or `executeJavaScript()`. This means:
- Zero framework coupling (works with React, Vue, Svelte, plain HTML, anything)
- User sees their real site, not a proxy or iframe
- HMR works naturally -- the BrowserWindow is just another browser tab

### 3. Screenshot as PNG buffer, not file

`capturePage()` returns a NativeImage. Convert to PNG buffer with `.toPNG()`, then base64-encode for sending to Claude Code. No temp files, no cleanup, no filesystem permissions issues.

### 4. DOM context as serialized JSON, not HTML string

Extracting `outerHTML` for a region would include massive amounts of irrelevant nested HTML. Instead, serialize only the relevant properties (tag, id, classes, text content, bounding rect) for elements intersecting the selection region. This produces a focused, token-efficient context for Claude.

---

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

---

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
