# Architecture Patterns

**Domain:** Visual web development tool (CLI + Electron + Claude Code integration)
**Researched:** 2026-04-03

## Recommended Architecture

### High-Level Process Model

```
User runs `claw start`
        |
        v
  +-----------+
  |  CLI      |  (Node.js entry point)
  |  Process  |  - Parses args, reads package.json
  +-----+-----+  - Spawns everything, owns lifecycle
        |
        +---> Spawn Dev Server (child_process)
        |         e.g. `npm run dev`
        |         stdout parsed for ready URL
        |
        +---> Spawn Electron Main Process
        |         |
        |         +---> BaseWindow
        |                  |
        |                  +---> WebContentsView: "site"
        |                  |       Loads localhost:3000
        |                  |       (sandboxed, no node)
        |                  |
        |                  +---> WebContentsView: "overlay"
        |                         Transparent, on top
        |                         Selection UI + input box
        |                         (preload script, IPC)
        |
        +---> Spawn Claude Code Session
                  via @anthropic-ai/claude-agent-sdk
                  Long-lived session, receives prompts
                  Edits files -> dev server HMR picks up
```

### Why This Shape

The architecture has **four distinct process boundaries**: CLI orchestrator, dev server, Electron (main + renderers), and Claude Code. This separation is necessary because:

1. **CLI orchestrator** must own the lifecycle of everything. If the user Ctrl-C's, one process kills all children cleanly.
2. **Dev server** is an opaque child process (could be Vite, Next.js, anything). It must be managed but never modified.
3. **Electron main process** manages windows, IPC, and screenshot capture. It runs in a separate process because Electron requires its own event loop.
4. **Claude Code** runs as a subprocess via the Agent SDK. It maintains conversation state and needs a long-lived session.

### Component Boundaries

| Component | Responsibility | Communicates With | Process Type |
|-----------|---------------|-------------------|-------------|
| **CLI Orchestrator** | Parse args, detect dev cmd, spawn processes, lifecycle management, signal handling | Dev Server, Electron, Claude Code | Parent Node.js process |
| **Dev Server** | Serve the user's website, HMR | CLI (stdout/stderr), Browser (HTTP) | child_process.spawn |
| **Electron Main** | Window management, IPC routing, screenshot capture, DOM capture orchestration | CLI (IPC or stdio), Overlay Renderer, Site Renderer | Electron main process |
| **Site WebContentsView** | Display user's localhost website | Electron Main (limited - sandboxed) | Renderer process |
| **Overlay WebContentsView** | Selection drawing, instruction input, status display | Electron Main (preload + IPC) | Renderer process |
| **Claude Code Session** | Receive context (screenshot + DOM + instruction), edit source files | CLI Orchestrator (Agent SDK) | Subprocess (spawned by SDK) |

## Data Flow

### Primary Flow: User Selects Region and Describes Change

```
1. User draws rectangle on overlay
   Overlay Renderer --[ipcRenderer.invoke]--> Electron Main
   "selection:complete" { x, y, width, height }

2. Electron Main captures screenshot of selected region
   site WebContentsView.webContents.capturePage({ x, y, w, h })
   Returns NativeImage -> convert to base64 PNG

3. Electron Main captures DOM elements in selected region
   site WebContentsView.webContents.executeJavaScript(domCaptureScript)
   Returns serialized DOM info: { elements: [{ tag, classes, id, text, rect, styles }] }

4. Overlay shows text input for user instruction
   Overlay Renderer --[ipcRenderer.invoke]--> Electron Main
   "instruction:submit" { text: "Make the header blue" }

5. Electron Main sends context to CLI orchestrator
   Electron Main --[IPC channel]--> CLI Orchestrator

6. CLI orchestrator sends to Claude Code session
   SDK query() or streamInput() with prompt containing:
   - Screenshot (base64 image)
   - DOM context (serialized elements)
   - User instruction text
   - Project directory context

7. Claude Code edits files
   Claude Code --> filesystem writes

8. Dev server HMR detects changes
   Dev server --> browser hot reload
   Site WebContentsView automatically reflects changes
```

### Secondary Flow: Status Updates

```
Claude Code stream events --[SDK async generator]--> CLI Orchestrator
CLI Orchestrator --[IPC]--> Electron Main
Electron Main --[webContents.send]--> Overlay Renderer
Overlay shows "Claude is thinking...", "Editing src/Header.tsx...", "Done"
```

### Data Formats

**Screenshot Context:**
```typescript
interface ScreenshotContext {
  image: string;        // base64 PNG
  region: {             // coordinates relative to page viewport
    x: number;
    y: number;
    width: number;
    height: number;
  };
  devicePixelRatio: number;  // for Retina displays
}
```

**DOM Context:**
```typescript
interface DOMContext {
  elements: Array<{
    tag: string;            // "div", "h1", "button"
    id: string | null;
    classes: string[];
    textContent: string;    // truncated
    attributes: Record<string, string>;  // data-*, aria-*, href, src
    boundingRect: DOMRect;
    computedStyles: {       // only layout-relevant ones
      display: string;
      position: string;
      color: string;
      backgroundColor: string;
      fontSize: string;
      fontFamily: string;
      padding: string;
      margin: string;
    };
    children: number;       // count, not recursive
    depth: number;          // nesting level from root
  }>;
  viewportSize: { width: number; height: number };
  url: string;
}
```

**Instruction Payload (sent to Claude Code):**
```typescript
interface ClawInstruction {
  screenshot: ScreenshotContext;
  dom: DOMContext;
  instruction: string;       // user's natural language request
  projectDir: string;        // working directory
}
```

## Patterns to Follow

### Pattern 1: BaseWindow + Dual WebContentsView (Layered Views)

**What:** Use Electron's modern `BaseWindow` with two `WebContentsView` instances stacked: site content below, transparent overlay above.

**Why:** `BrowserView` is deprecated since Electron 30. `WebContentsView` is the official replacement. Using two views gives complete isolation between the user's site (untrusted content) and the overlay (trusted UI).

**Implementation:**
```typescript
import { app, BaseWindow, WebContentsView } from 'electron';
import path from 'path';

function createWindow(localhostUrl: string) {
  const win = new BaseWindow({ width: 1280, height: 900 });

  // Site view: loads user's localhost, fully sandboxed
  const siteView = new WebContentsView({
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      // No preload - this is untrusted content
    }
  });
  win.contentView.addChildView(siteView);
  siteView.setBounds({ x: 0, y: 0, width: 1280, height: 900 });
  siteView.webContents.loadURL(localhostUrl);

  // Overlay view: trusted UI, transparent, on top
  const overlayView = new WebContentsView({
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload-overlay.js'),
    }
  });
  overlayView.setBackgroundColor('#00000000'); // fully transparent
  win.contentView.addChildView(overlayView);   // added second = on top
  overlayView.setBounds({ x: 0, y: 0, width: 1280, height: 900 });
  overlayView.webContents.loadFile('overlay.html');

  // Handle window resize: update both views
  win.on('resize', () => {
    const [width, height] = win.getSize();
    siteView.setBounds({ x: 0, y: 0, width, height });
    overlayView.setBounds({ x: 0, y: 0, width, height });
  });

  return { win, siteView, overlayView };
}
```

**Known issue:** Transparent `WebContentsView` has a rendering bug where animated/partially-transparent content can accumulate paints. The overlay should use solid backgrounds for interactive elements (the instruction input box) and only use transparency for the selection area. This is acceptable because the overlay is mostly transparent with simple drawn rectangles.

### Pattern 2: IPC via invoke/handle with Preload Bridge

**What:** Use `ipcRenderer.invoke()` / `ipcMain.handle()` for renderer-to-main communication, exposed through `contextBridge` in the preload script. Never expose raw IPC modules.

**Why:** `invoke/handle` is Promise-based and cleaner than the older `send/on` pattern. Context isolation + contextBridge is mandatory for security.

**Implementation:**
```typescript
// preload-overlay.ts
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('claw', {
  // Overlay -> Main
  onSelectionComplete: (region: { x: number; y: number; width: number; height: number }) =>
    ipcRenderer.invoke('selection:complete', region),

  submitInstruction: (text: string) =>
    ipcRenderer.invoke('instruction:submit', text),

  // Main -> Overlay (for status updates)
  onStatusUpdate: (callback: (status: string) => void) => {
    ipcRenderer.on('status:update', (_event, status) => callback(status));
    // Return cleanup function
    return () => ipcRenderer.removeAllListeners('status:update');
  },
});
```

```typescript
// main.ts - IPC handlers
ipcMain.handle('selection:complete', async (_event, region) => {
  // 1. Capture screenshot from site view
  const image = await siteView.webContents.capturePage(region);
  const base64 = image.toPNG().toString('base64');

  // 2. Capture DOM from site view
  const dom = await siteView.webContents.executeJavaScript(
    `window.__clawCaptureDom(${JSON.stringify(region)})`
  );
  // Note: __clawCaptureDom is injected via executeJavaScript, NOT a preload
  // (site view has no preload for security)

  return { screenshot: base64, dom };
});
```

### Pattern 3: Claude Code via Agent SDK (Long-Lived Session)

**What:** Use `@anthropic-ai/claude-agent-sdk` to spawn a persistent Claude Code session. Use the `query()` async generator with streaming input for multi-turn conversations.

**Why:** The Agent SDK wraps the Claude Code CLI binary and handles subprocess lifecycle, JSON-lines protocol, and message parsing. Using it avoids reimplementing the communication protocol. The streaming input mode (`AsyncIterable<SDKUserMessage>`) allows sending multiple prompts to the same session without restarting Claude Code.

**Implementation:**
```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';

async function createClaudeSession(projectDir: string) {
  const conversation = query({
    prompt: createInitialPrompt(), // async iterable for multi-turn
    options: {
      cwd: projectDir,
      allowedTools: ['Read', 'Edit', 'Bash', 'Glob', 'Grep'],
      systemPrompt: {
        type: 'preset',
        preset: 'claude_code',
        append: CLAW_SYSTEM_PROMPT, // Context about visual editing workflow
      },
      permissionMode: 'default', // or 'acceptEdits' for auto-approve file edits
    }
  });

  // Stream messages from Claude
  for await (const message of conversation) {
    if (message.type === 'assistant') {
      // Forward status to overlay
      emitStatus(extractStatus(message));
    }
  }
}
```

**Sending visual context as a prompt:**
```typescript
// When user submits an instruction, push to the streaming input
async function sendInstruction(
  instruction: string,
  screenshot: string, // base64 PNG
  dom: DOMContext
) {
  // The SDK supports image content blocks in user messages
  const message: SDKUserMessage = {
    type: 'user',
    content: [
      {
        type: 'image',
        source: {
          type: 'base64',
          media_type: 'image/png',
          data: screenshot,
        },
      },
      {
        type: 'text',
        text: formatInstructionPrompt(instruction, dom),
      },
    ],
  };
  await conversation.streamInput(asyncIterableOf(message));
}
```

### Pattern 4: Dev Server Detection and Health Polling

**What:** Auto-detect the dev server start command from `package.json` scripts, spawn it, then poll for readiness using HTTP GET before loading the URL in Electron.

**Why:** The tool must be framework-agnostic. Every framework uses different scripts and ports. Detection + polling handles the diversity.

**Implementation:**
```typescript
// Detection priority for package.json scripts:
const DEV_SCRIPT_PRIORITY = ['dev', 'start', 'serve'];

function detectDevCommand(packageJson: any): { cmd: string; args: string[] } {
  const scripts = packageJson.scripts || {};
  for (const name of DEV_SCRIPT_PRIORITY) {
    if (scripts[name]) {
      return { cmd: 'npm', args: ['run', name] };
    }
  }
  throw new Error('No dev script found. Use --cmd to specify.');
}

// Port detection from stdout
// Common patterns: "localhost:3000", "127.0.0.1:5173", "Local: http://..."
const URL_PATTERNS = [
  /https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0):(\d+)/,
  /Local:\s+(https?:\/\/\S+)/,
  /ready in .* (https?:\/\/\S+)/,
];

function parseUrlFromOutput(line: string): string | null {
  for (const pattern of URL_PATTERNS) {
    const match = line.match(pattern);
    if (match) return match[1] || `http://localhost:${match[1]}`;
  }
  return null;
}

// Health polling with wait-port
import waitPort from 'wait-port';

async function waitForServer(port: number, timeout = 30000): Promise<void> {
  const result = await waitPort({ port, timeout, output: 'silent' });
  if (!result.open) {
    throw new Error(`Dev server did not start within ${timeout}ms`);
  }
}
```

### Pattern 5: DOM Capture via executeJavaScript

**What:** Inject a DOM capture function into the site view using `webContents.executeJavaScript()`. This function finds all elements within the selected region and extracts their properties.

**Why:** The site view has no preload script (for security), so DOM capture must be injected dynamically. `executeJavaScript` runs in the site's renderer context and can access the full DOM. The key limitation is that DOM elements cannot cross IPC boundaries -- only serializable data can be returned.

**Implementation:**
```typescript
// This script is injected into the site view
const DOM_CAPTURE_SCRIPT = `
(function captureRegion(rect) {
  const elements = document.elementsFromPoint(
    rect.x + rect.width / 2,
    rect.y + rect.height / 2
  );

  // Also get all elements whose bounding rect intersects the selection
  const allElements = document.querySelectorAll('*');
  const captured = [];

  for (const el of allElements) {
    const elRect = el.getBoundingClientRect();
    if (rectsIntersect(elRect, rect)) {
      const styles = window.getComputedStyle(el);
      captured.push({
        tag: el.tagName.toLowerCase(),
        id: el.id || null,
        classes: Array.from(el.classList),
        textContent: (el.textContent || '').slice(0, 200),
        attributes: getRelevantAttributes(el),
        boundingRect: {
          x: elRect.x, y: elRect.y,
          width: elRect.width, height: elRect.height
        },
        computedStyles: {
          display: styles.display,
          position: styles.position,
          color: styles.color,
          backgroundColor: styles.backgroundColor,
          fontSize: styles.fontSize,
          fontFamily: styles.fontFamily,
          padding: styles.padding,
          margin: styles.margin,
        },
        children: el.children.length,
        depth: getDepth(el),
      });
    }
  }

  return {
    elements: captured,
    viewportSize: {
      width: window.innerWidth,
      height: window.innerHeight
    },
    url: window.location.href,
  };
})(REGION_PLACEHOLDER)
`;
```

**Performance note:** Iterating all `*` elements can be slow on large pages. Optimization: use `document.elementsFromPoint()` at multiple sample points within the selection rectangle, then walk up to common ancestors. This is a v2 optimization -- brute force works for v1.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Loading Site Content in BrowserWindow Directly

**What:** Using a single `BrowserWindow` and injecting overlay HTML/CSS into the user's page via `webContents.insertCSS()` and `executeJavaScript()`.

**Why bad:** Mutates the user's page DOM and styles. Can break the site. CSS conflicts are inevitable. No clean separation between trusted overlay and untrusted site content. Cannot sandbox the site view properly. Debugging becomes nightmarish.

**Instead:** Use separate `WebContentsView` instances. Complete isolation, no conflicts, independent security policies.

### Anti-Pattern 2: Using `nodeIntegration: true` on the Site View

**What:** Enabling Node.js integration on the view that loads the user's localhost site.

**Why bad:** The user's site may contain any JavaScript. With node integration, any script on the page could access the filesystem, spawn processes, or read environment variables. This is a critical security vulnerability even for localhost content -- the user's site may include third-party scripts, npm dependencies with supply chain compromises, or development-time debugging tools with XSS vulnerabilities.

**Instead:** The site view gets `nodeIntegration: false`, `sandbox: true`, `contextIsolation: true`, and NO preload script. It is treated as untrusted content.

### Anti-Pattern 3: Communicating with Claude Code via Raw child_process

**What:** Spawning `claude` as a raw child process and manually parsing stdout JSON lines.

**Why bad:** The JSON-lines protocol between the Claude Code CLI and its callers has message categories (regular messages, control messages, permission requests), error handling, retry logic, and session management. Reimplementing this is error-prone and will break when the protocol changes. The Agent SDK already handles this.

**Instead:** Use `@anthropic-ai/claude-agent-sdk`. It handles subprocess lifecycle, protocol parsing, streaming, and provides typed message objects. If the SDK doesn't support a feature, that's a signal to file an issue, not to bypass it.

### Anti-Pattern 4: Polling the Site View for Changes After Claude Edits

**What:** Manually refreshing or polling the site view after Claude Code edits files, to show updated content.

**Why bad:** Unnecessary complexity. The user's dev server already has HMR/live reload. When Claude edits `src/Header.tsx`, Vite/Next.js/webpack detects the change and pushes an update to the browser. The site view receives the update automatically because it has an active WebSocket connection to the dev server.

**Instead:** Do nothing. Let HMR handle it. The only thing Claw needs to do is tell the user "Changes applied" in the overlay after Claude finishes editing.

### Anti-Pattern 5: Single-Process Architecture

**What:** Running the CLI, Electron, and Claude Code communication in the same Node.js process.

**Why bad:** Electron's main process must remain responsive for IPC and window management. Long-running operations (waiting for Claude Code responses, processing large DOM captures) would block the event loop. Additionally, if Claude Code crashes, it would take down the entire application. Process isolation provides fault tolerance.

**Instead:** Keep processes separate. The CLI orchestrator spawns and monitors each child. If Claude Code crashes, restart it. If the dev server crashes, show an error in the overlay. The Electron window stays responsive.

## Security Architecture

### Threat Model for Claw

Loading arbitrary localhost content in Electron creates a unique threat surface:

| Threat | Vector | Mitigation |
|--------|--------|------------|
| Site JS accesses Node APIs | `nodeIntegration` on site view | `nodeIntegration: false` (default), `sandbox: true` |
| Site JS accesses overlay IPC | Shared renderer context | Separate `WebContentsView` instances, no shared preload |
| Site navigates away from localhost | Click on external link | `will-navigate` event handler restricts to localhost origins |
| Site opens new windows | `window.open()`, target="_blank" | `setWindowOpenHandler` to block or restrict |
| Overlay preload leaks APIs | Overly broad contextBridge | Expose minimal API: only `claw.onSelectionComplete`, `claw.submitInstruction`, `claw.onStatusUpdate` |
| Claude edits dangerous files | Prompted to modify `.env`, system files | Claude Code's own permission system handles this; additionally scope `cwd` to project directory |

### Secure Defaults

```typescript
// Site view: maximum restriction
const siteViewPrefs: WebPreferences = {
  sandbox: true,
  contextIsolation: true,
  nodeIntegration: false,
  webSecurity: true,
  allowRunningInsecureContent: false,
  // NO preload script
};

// Overlay view: minimal bridge
const overlayViewPrefs: WebPreferences = {
  sandbox: true,
  contextIsolation: true,
  nodeIntegration: false,
  preload: path.join(__dirname, 'preload-overlay.js'),
};

// Navigation restriction
app.on('web-contents-created', (_event, contents) => {
  contents.on('will-navigate', (event, url) => {
    const parsed = new URL(url);
    if (parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') {
      event.preventDefault();
    }
  });

  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
});
```

## CLI-to-Electron Communication

### Option A: Electron as Child Process (Recommended)

The CLI orchestrator spawns Electron as a child process using `electron` as the executable. Communication happens via Node.js IPC (the `child_process` built-in IPC channel with `{ stdio: ['pipe', 'pipe', 'pipe', 'ipc'] }`).

```typescript
// CLI orchestrator spawns Electron
import { fork } from 'child_process';
import electronPath from 'electron';

const electronProcess = fork(
  path.join(__dirname, 'electron-main.js'),
  [/* args */],
  {
    execPath: electronPath as unknown as string,
    stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
  }
);

// Send to Electron main process
electronProcess.send({ type: 'load-url', url: 'http://localhost:3000' });

// Receive from Electron main process
electronProcess.on('message', (msg) => {
  if (msg.type === 'instruction') {
    sendToClaudeCode(msg.payload);
  }
});
```

**Why this over other options:** `fork()` with IPC gives a structured message channel without having to parse stdout. The Electron main process can use `process.send()` and `process.on('message')` natively. This is the standard pattern for CLI tools that spawn Electron.

### Option B: Electron IS the Main Process (Alternative)

Make the Electron main process the orchestrator. The CLI is just a thin wrapper that calls `electron .`. All orchestration logic lives in the Electron main process.

**Trade-off:** Simpler process tree but harder to test the orchestrator without Electron. Also couples the orchestration logic to Electron's lifecycle. Go with Option A for better separation.

## Suggested Build Order

Based on dependency analysis, build components in this order:

### Phase 1: Foundation (no Electron yet)
1. **CLI entry point** (`claw start` command parsing)
2. **Dev server detection** (read package.json, detect script, `--cmd` override)
3. **Dev server spawning + health polling** (spawn process, parse stdout for URL, poll until ready)

*Rationale: These can be built and tested as pure Node.js without Electron. They form the foundation everything else depends on.*

### Phase 2: Electron Shell
4. **Electron main process** (BaseWindow + dual WebContentsView)
5. **Site view** (load localhost URL, secure webPreferences)
6. **CLI-to-Electron IPC** (fork Electron, message passing)

*Rationale: Depends on Phase 1 having a working dev server URL. The shell can be tested by loading any localhost URL.*

### Phase 3: Overlay + Capture
7. **Overlay view** (transparent WebContentsView, preload bridge)
8. **Selection drawing** (freeform rectangle on canvas/SVG in overlay)
9. **Screenshot capture** (`capturePage` with region rect)
10. **DOM capture** (`executeJavaScript` with capture script)

*Rationale: Depends on Phase 2 having a working Electron window with two views. Selection drawing is pure frontend in the overlay, screenshot/DOM capture require the site view to be loaded.*

### Phase 4: Claude Code Integration
11. **Claude Code session** (Agent SDK `query()`, long-lived session)
12. **Context assembly** (combine screenshot + DOM + instruction into prompt)
13. **Status forwarding** (stream Claude events to overlay)
14. **Instruction input** (text box in overlay, submit flow)

*Rationale: Depends on Phase 3 for capture data. The Claude Code session can be prototyped standalone but needs capture data to be useful.*

### Phase 5: Polish + Lifecycle
15. **Process lifecycle** (clean shutdown on Ctrl-C, restart on crash)
16. **Error handling** (dev server crash, Claude Code errors, network issues)
17. **Multi-selection** (allow multiple regions before submitting)

*Rationale: These are refinements that require the full pipeline to be working.*

### Dependency Graph

```
Phase 1: CLI + Dev Server
    |
    v
Phase 2: Electron Shell
    |
    v
Phase 3: Overlay + Capture
    |
    v
Phase 4: Claude Integration
    |
    v
Phase 5: Polish + Lifecycle
```

Each phase produces a testable, demonstrable artifact. Phase 1 can be tested by running `claw start` and seeing the dev server come up. Phase 2 adds a window showing the site. Phase 3 adds visual selection. Phase 4 makes it actually edit code. Phase 5 makes it production-ready.

## Scalability Considerations

| Concern | At MVP | At 1K Daily Users | At Community Scale |
|---------|--------|--------------------|--------------------|
| Screenshot size | Raw base64, no compression | Resize to max 1920px, compress PNG | Consider WebP, quality settings |
| DOM capture performance | Iterate all `*` elements | Sample-point-based capture | Virtual DOM diffing, incremental capture |
| Claude session memory | Single session per `claw start` | Session persistence across restarts | Multi-session management |
| Multi-monitor / HiDPI | Use devicePixelRatio scaling | Test common configurations | configurable DPI handling |
| Framework support | Test with Vite + Next.js | Common framework detection | Plugin system for custom dev servers |

## Sources

- [Electron IPC Tutorial](https://www.electronjs.org/docs/latest/tutorial/ipc) - Official IPC patterns documentation (HIGH confidence)
- [Migrating from BrowserView to WebContentsView](https://www.electronjs.org/blog/migrate-to-webcontentsview) - Official migration guide for the view architecture (HIGH confidence)
- [WebContentsView API](https://www.electronjs.org/docs/latest/api/web-contents-view) - Official API reference (HIGH confidence)
- [BaseWindow API](https://www.electronjs.org/docs/latest/api/base-window) - Official API for windowless view containers (HIGH confidence)
- [Electron Security Tutorial](https://www.electronjs.org/docs/latest/tutorial/security) - Official security best practices (HIGH confidence)
- [Electron WebContentsView App Structure](https://developer.mamezou-tech.com/en/blogs/2024/08/28/electron-webcontentsview-app-structure/) - Practical guide to multi-view architectures (MEDIUM confidence)
- [WebContentsView Transparent Background Bug](https://github.com/electron/electron/issues/42335) - Known rendering issue with transparent views (HIGH confidence)
- [Run Claude Code Programmatically](https://code.claude.com/docs/en/headless) - Official docs for `--print` mode and Agent SDK (HIGH confidence)
- [Claude Agent SDK TypeScript Reference](https://platform.claude.com/docs/en/agent-sdk/typescript) - Full SDK API documentation (HIGH confidence)
- [@anthropic-ai/claude-agent-sdk npm](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk) - SDK package (HIGH confidence)
- [wait-port npm](https://www.npmjs.com/package/wait-port) - Port readiness detection utility (HIGH confidence)
- [Electron capturePage Region Issue](https://github.com/electron/electron/issues/6075) - Historical context on region capture (MEDIUM confidence)
- [Electron webContents.executeJavaScript](https://www.electronjs.org/docs/latest/api/web-contents) - API for injecting JS into renderers (HIGH confidence)
