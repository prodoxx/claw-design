# Domain Pitfalls

**Domain:** CLI + Electron visual development tool with Claude Code integration
**Researched:** 2026-04-03
**Confidence:** HIGH (Electron security, process management, distribution) / MEDIUM (Claude Code integration, overlay accuracy, DOM-to-source mapping)

---

## Critical Pitfalls

Mistakes that cause rewrites or major issues.

### Pitfall 1: Orphan Processes on Exit -- Dev Server and Claude Code Outlive the App

**What goes wrong:** User presses Ctrl+C but dev server and/or Claude Code processes keep running in the background. Ports stay bound. Users have to manually hunt down and kill processes. On subsequent launches, port conflicts cause failures. Claude Code may continue consuming API tokens in the background.

**Why it happens:** `process.kill(pid)` only kills the direct child process. Dev servers (Vite, Next.js, webpack) spawn their own child processes (esbuild, SWC, TypeScript compiler). Killing the parent leaves these grandchildren running. On macOS/Linux, children are re-parented to init/launchd. On Windows, child processes are completely independent. A simple `process.on('exit')` handler is insufficient because `exit` does not fire on `SIGKILL`, and `SIGKILL` cannot be caught.

**Consequences:** Port conflicts on next `claw start`. Memory leaks from zombie processes. Users lose trust in the tool. Wasted API costs from orphaned Claude Code sessions.

**Prevention:**
- Use `tree-kill(pid, 'SIGTERM')` instead of `process.kill(pid)` for all child process cleanup
- Register handlers for `SIGINT`, `SIGTERM`, `SIGHUP`, `beforeunload` (Electron), and `app.on('will-quit')`
- On `exit` event, use synchronous `tree-kill` variant as final fallback
- Set a kill timeout: SIGTERM first, SIGKILL after 3-5 seconds if process still alive
- On Windows, use `taskkill /pid PID /T /F` since POSIX signals do not work the same way
- Use a PID file (e.g., `~/.claw/server.pid`) to detect and kill orphans from previous runs on startup
- Consider spawning dev servers with `detached: false` and a process group so you can kill the group

**Detection:** Test by running `claw start`, pressing Ctrl+C, then checking `ps aux | grep node` for lingering processes. Also test by force-killing the Claw process (`kill -9`), then verifying no orphans remain.

**Phase to address:** Phase 1 (process management). Build the cleanup infrastructure before spawning any child processes. This is foundational -- every other feature depends on reliable process lifecycle.

---

### Pitfall 2: Electron Security Misconfiguration When Loading Localhost Content

**What goes wrong:** Claw loads the user's dev server (localhost) inside an Electron BrowserWindow. The temptation is to relax security settings -- enabling `nodeIntegration`, disabling `contextIsolation`, or disabling `webSecurity` -- to make overlay injection and DOM access easier. This is catastrophic. The user's website may load third-party scripts (analytics, CDNs, ad networks), and any XSS in the loaded site would gain full Node.js access: file system, child processes, everything on the developer's machine.

**Why it happens:** Developers think "it's just localhost, it's safe." But localhost content loads arbitrary third-party resources. The user's dev server is not trusted content from Electron's perspective -- it's a web page that could contain any JavaScript. Disabling `contextIsolation` also implicitly disables process sandboxing.

**Consequences:** Full remote code execution via any XSS in the user's site or its third-party dependencies. An attacker could read/write files, spawn processes, exfiltrate credentials.

**Prevention:**
- Always use `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`
- Use a preload script with `contextBridge.exposeInMainWorld()` to expose only the specific IPC channels needed (screenshot capture, selection coordinates, user input)
- Never expose raw `ipcRenderer` -- expose one method per IPC message
- Set a restrictive CSP via `session.defaultSession.webRequest.onHeadersReceived` that allows the user's dev server resources but blocks escalation
- Use `webContents.setWindowOpenHandler()` to prevent the loaded site from opening new windows with elevated privileges
- Validate all file paths received from the renderer are within the project root

**Detection:**
- Any BrowserWindow config with `nodeIntegration: true` or `contextIsolation: false`
- Preload script that calls `contextBridge.exposeInMainWorld('ipc', ipcRenderer)` instead of wrapping specific channels
- No CSP defined for the renderer loading localhost content
- `webSecurity: false` anywhere in production code

**Phase to address:** Phase 1 (Electron window setup). This must be correct from the first line of Electron code. Retrofitting security is extremely painful because every IPC call must be refactored.

---

### Pitfall 3: BrowserView is Deprecated -- Use WebContentsView

**What goes wrong:** Building the dual-view architecture (site + overlay) using `BrowserView`, then having to rewrite when it is removed.

**Why it happens:** Many tutorials and Stack Overflow answers still reference `BrowserView`. It was deprecated in Electron 30 (early 2024) and replaced with `WebContentsView` + `BaseWindow`.

**Consequences:** Technical debt from day one. `BrowserView` may be removed in any upcoming Electron major version (the 8-week release cycle means this could happen within months).

**Prevention:** Use `BaseWindow` + `WebContentsView` from the start. The API is nearly identical but uses `contentView.addChildView()` instead of `addBrowserView()`.

**Detection:** Deprecation warnings in Electron console output.

**Phase to address:** Phase 1 (Electron window setup). Non-negotiable -- use the current API from the start.

---

### Pitfall 4: Overlay Injection Breaks the User's Application

**What goes wrong:** The selection overlay (HTML/CSS layer drawn on top of the user's site) interferes with the application's own UI. The overlay captures mouse events that should go to the app. The overlay's CSS (z-index, position: fixed, pointer-events) conflicts with the app's styles. Frameworks using portals, modals, or top-layer elements (dialogs, popovers via HTML `<dialog>`) render above the overlay because the top layer renders above all z-index values. Shadow DOM components are invisible to the overlay's DOM traversal. The overlay's presence changes the layout, causing the app to behave differently than without Claw.

**Why it happens:** Web applications use diverse CSS strategies. A `z-index: 2147483647` overlay seems foolproof until you encounter CSS stacking contexts, the HTML `<dialog>` top layer (which renders above all z-index values), or frameworks that use `position: fixed` with `transform` (which creates new stacking contexts). Shadow DOM encapsulation prevents `querySelectorAll` from reaching inside components.

**Consequences:** User's app becomes unusable inside Claw. Users cannot interact with their site to navigate to the area they want to edit. Style conflicts corrupt the visual appearance.

**Prevention:**
- Implement the overlay in a separate WebContentsView layered on top of the content WebContentsView, rather than injecting CSS into the user's page. This provides complete isolation.
- If using injected overlay: use an absolutely unique CSS class prefix (e.g., `__claw-overlay-*`), scope all styles, and use `pointer-events: none` on the overlay container with `pointer-events: auto` only on interactive overlay elements
- For DOM traversal, recursively enter shadow roots: `element.shadowRoot?.querySelectorAll('*')`
- Handle iframes by accessing `iframe.contentDocument` (same-origin only -- cross-origin iframes cannot be inspected, and that is acceptable for a dev tool)
- Toggle the overlay on/off: selection mode vs. interaction mode, so the overlay never permanently blocks the app
- Never inject `<style>` tags that use element selectors or unscoped class names -- they will collide with the user's styles

**Detection:**
- User's app buttons/links stop being clickable when Claw is running
- Modals or dropdowns in the user's app appear behind the selection overlay
- The user's app looks different inside Claw than in a regular browser
- DOM capture misses elements inside shadow DOM or iframes

**Phase to address:** Phase 2 (selection overlay). Strongly prefer the separate WebContentsView approach from the start. Injecting into the user's DOM is a path of escalating hacks.

---

### Pitfall 5: Claude Code Session Dies Silently, Leaving Claw in a Broken State

**What goes wrong:** The Claude Code CLI subprocess crashes, times out, or loses its API connection mid-session. Claw continues to accept user selections and instructions, sends them to the dead process, and either hangs forever waiting for a response or throws cryptic errors like "ProcessTransport is not ready for writing." The user has no idea what happened.

**Why it happens:** The Claude Code CLI is a complex subprocess with its own failure modes: API rate limits, network timeouts, token limits, OOM kills, and internal errors. The SDK's `ProcessTransport` can enter a permanently broken state where `ready = false` but the session object still exists. Claude Code operations can take 30-120+ seconds for complex edits, making it hard to distinguish "still working" from "hung."

**Consequences:** Hung UI with no feedback. Wasted API tokens. User loses confidence in the tool and closes it, potentially losing in-progress work context.

**Prevention:**
- Monitor the Claude Code subprocess health: listen for `exit`, `error`, and `close` events on the child process
- Implement a heartbeat or health check -- if the subprocess exits unexpectedly, immediately notify the user and offer to restart the session
- Use `--output-format stream-json` to get incremental progress, allowing the UI to show "Claude is working..." with actual status
- Set reasonable timeouts per operation (120s default) with user-visible countdown or progress indication
- Implement session recovery: if the subprocess dies, spawn a new one with `resume: sessionId` to replay conversation context
- Never queue instructions to a dead session -- check liveness before sending
- Surface Claude Code errors clearly: "Claude Code lost connection" not "Error: ProcessTransport is not ready for writing"

**Detection:**
- User submits an instruction and nothing happens for minutes
- Error messages reference internal SDK/transport details instead of human-readable text
- Claude Code process exits with code 143 (SIGTERM) or 137 (OOM) but the UI does not reflect it
- Multiple Claude Code processes accumulate because failed sessions were not cleaned up

**Phase to address:** Phase 2 (Claude Code integration). Build the health monitoring and error handling layer around the subprocess from the start. Do not treat it as a reliable black box.

---

### Pitfall 6: Selection Overlay Coordinate Mismatch on High-DPI Displays

**What goes wrong:** The selection rectangle coordinates (in CSS pixels) do not match the `capturePage()` output (in device pixels). Screenshots are cropped incorrectly -- off by 2x on Retina displays. The screenshot sent to Claude shows the wrong part of the page.

**Why it happens:** CSS pixels and device pixels are different coordinate systems. `getBoundingClientRect()` and mouse events report in CSS pixels. `capturePage()` operates in device pixels. Developers test on non-Retina displays where `devicePixelRatio` is 1 and the bug is invisible, then it breaks on every MacBook.

**Consequences:** Claude receives wrong visual context, makes wrong edits. Users think the tool is broken.

**Prevention:**
- Always multiply CSS coordinates by `window.devicePixelRatio` before passing to `capturePage()`
- Test on both Retina and non-Retina displays from the start (or simulate with `--force-device-scale-factor=2`)
- When capturing a region, compute: `{ x: cssX * dpr, y: cssY * dpr, width: cssWidth * dpr, height: cssHeight * dpr }`
- Account for scroll position: add `window.scrollX` and `window.scrollY` to element coordinates from `getBoundingClientRect()` before DPI scaling
- Be aware that `devicePixelRatio` can differ between monitors on multi-monitor setups, and Electron has had bugs where it does not update when dragging between displays

**Detection:**
- Screenshot captures are offset or show a different area than selected
- Selection works on some machines but not others
- Bug reports cluster around MacBook Pro users
- Test by drawing a selection on a page element and comparing the captured image to the expected area

**Phase to address:** Phase 2 (selection + capture). Write a coordinate transformation utility tested with `devicePixelRatio` values of 1, 2, and 3.

---

### Pitfall 7: Dev Server Readiness Detection is Fragile and Framework-Specific

**What goes wrong:** Claw spawns the user's dev server and needs to know when it is ready before loading the URL in Electron. The naive approach -- parsing stdout for "ready on http://localhost:3000" -- breaks across frameworks because every tool prints different messages in different formats. Vite says "Local: http://localhost:5173/". Next.js says "Ready in 2.3s" and uses a different format between Pages Router and App Router. Webpack says nothing useful by default. Some tools print to stderr. Some use ANSI color codes that break string matching.

**Why it happens:** There is no standard "I'm ready" signal across dev servers. Each framework has its own output format, and those formats change between versions.

**Consequences:** Electron opens to a blank page or connection refused. Tool appears completely broken on first use.

**Prevention:**
- Use TCP port polling (attempt `net.connect()` to the target port) as the primary readiness signal -- this is framework-agnostic and reliable
- Parse stdout only as a secondary signal for port discovery (when the user does not specify a port)
- Strip ANSI codes before parsing stdout (`strip-ansi` package)
- Implement a timeout (30 seconds default, configurable) -- if the server has not started, show a clear error explaining what happened
- Provide a `--port` flag so users can specify the port explicitly, bypassing auto-detection entirely
- Handle the case where the port is already in use (Vite auto-increments, Next.js fails)

**Detection:**
- Electron opens to blank page or connection refused
- Readiness detection works for Vite but fails for Next.js (or vice versa)
- Startup hangs indefinitely with no feedback to the user
- ANSI escape codes appear in log output or break string matching

**Phase to address:** Phase 1 (CLI + dev server management). This is one of the first things the CLI does, and getting it wrong means the entire tool appears broken on first use.

---

### Pitfall 8: DOM-to-Source Mapping Gives Claude Wrong Context

**What goes wrong:** Claw captures DOM elements within the selected region and sends them to Claude Code as context. But the runtime DOM bears little resemblance to the source code. React components render as `<div class="css-1a2b3c">` -- the class name is a CSS-in-JS hash that does not appear anywhere in source. Tailwind classes tell Claude what styles are applied but not which component file to edit. Server-rendered HTML includes framework wrapper elements that do not exist in JSX.

**Why it happens:** There is a semantic gap between "what the user sees in the browser" and "what exists in source files." Build tools transform, minify, and restructure code. CSS-in-JS generates runtime class names. Frameworks add wrapper elements. The DOM is an output, not a 1:1 representation of input source code.

**Consequences:** Claude edits the wrong file or wrong component. The edit rate drops below useful levels for non-trivial projects.

**Prevention:**
- Capture text content, HTML structure, and visible CSS properties (via `getComputedStyle`) -- these are more stable than class names for locating components
- Include the full subtree of selected elements, not just top-level nodes -- deeper structure gives Claude more signal
- Send the screenshot alongside DOM data -- Claude can use visual context to understand what the user is looking at
- Let Claude Code handle the source mapping -- it can search the codebase for matching text content, component names, and patterns. Do not try to build a source map resolver in Claw itself
- Include `data-testid`, `id`, `aria-label` attributes when present -- these are intentional identifiers developers put in their source
- Strip framework-internal attributes and wrapper elements that add noise (React's `data-reactroot`, Vue's comment nodes)

**Detection:**
- Claude edits the wrong file or wrong component
- Claude says "I can't find the element you're referring to" frequently
- Edits work for simple HTML sites but fail for React/Vue/Svelte apps
- Captured DOM context exceeds 50KB of noise for a simple button selection

**Phase to address:** Phase 2-3 (context capture + Claude integration). This is the hardest problem in the product and will require iteration. Start with a "good enough" approach (screenshot + cleaned DOM + text content) and refine based on real usage.

---

## Moderate Pitfalls

### Pitfall 9: Transparent WebContentsView Rendering Artifacts

**What goes wrong:** The overlay `WebContentsView` (set to transparent background) accumulates paint artifacts. Animated content or partially transparent elements leave ghost images.

**Why it happens:** Known Chromium rendering bug when compositing transparent web content views. Tracked in electron/electron#42335.

**Prevention:**
- Use `setBackgroundColor('#00000000')` for transparency
- Keep overlay content simple: solid-color selection rectangles, opaque input boxes
- Avoid CSS animations/transitions in the overlay
- If artifacts appear, force a repaint by toggling view visibility or calling `invalidate()`
- Consider the fallback: use a single BrowserWindow with preload injection instead of dual views

**Detection:** Visually obvious during development. Test by drawing/clearing multiple selections rapidly.

**Phase to address:** Phase 2 (overlay implementation).

---

### Pitfall 10: executeJavaScript DOM Serialization Limits

**What goes wrong:** `webContents.executeJavaScript()` returns a Promise, but DOM elements cannot be returned through the IPC channel. Developers try to return DOM elements directly and get silent failures or `undefined`.

**Why it happens:** Electron's IPC uses structured cloning. DOM elements are not structured-clonable.

**Prevention:**
- Always serialize DOM data into plain objects before returning from `executeJavaScript()`
- Test the capture script in Chrome DevTools console first (copy-paste into console, run, verify output)
- Add explicit type checking: if the returned value is `undefined` or has unexpected shape, log an error

**Detection:** Unit test the DOM capture script by running it against a test HTML page in a headless Electron instance.

**Phase to address:** Phase 2 (DOM extraction).

---

### Pitfall 11: capturePage Returns Empty Image on Hidden/Minimized Window

**What goes wrong:** `webContents.capturePage()` returns an empty (0x0) NativeImage when the BrowserWindow is minimized, fully occluded by other windows, or off-screen. Known issue on Windows (electron/electron#31992).

**Prevention:**
- Check `win.isMinimized()` and `win.isVisible()` before capture
- Call `win.show()` / `win.focus()` if window is not visible
- After capture, validate that the NativeImage has non-zero dimensions before proceeding
- Show an error message if capture fails: "Please make sure the Claw window is visible"

**Detection:** Test screenshot capture with minimized window and with window behind other windows.

**Phase to address:** Phase 2 (screenshot capture).

---

### Pitfall 12: Claude Code CLI Not Installed

**What goes wrong:** User runs `claw start` but does not have Claude Code CLI installed. The spawn fails with an unhelpful ENOENT error.

**Prevention:**
- On startup, check if `claude` binary is in PATH
- If not found, show a clear error: "Claude Code CLI not found. Install it from https://claude.ai/download"
- Check this BEFORE spawning the dev server or Electron (fail fast)

**Detection:** Test by temporarily renaming the `claude` binary and running `claw start`.

**Phase to address:** Phase 1 (CLI startup checks).

---

### Pitfall 13: Context Isolation and Preload Script Timing

**What goes wrong:** The preload script's `DOMContentLoaded` handler fires before the user's site JS has finished rendering. DOM capture returns elements from the initial HTML, not the fully rendered page (missing client-side rendered content).

**Prevention:**
- Do not tie DOM capture to DOMContentLoaded. Instead, capture DOM on-demand when the user completes a selection
- The user naturally waits until they see the rendered page before drawing a selection, so timing is self-correcting
- For SPAs that render asynchronously, the on-demand capture approach avoids the timing problem entirely

**Detection:** Test with a React SPA that renders content after a 2-second API call. Verify the captured DOM includes the async-rendered content.

**Phase to address:** Phase 2 (DOM capture).

---

## Minor Pitfalls

### Pitfall 14: Electron App Name in Dock/Taskbar

**What goes wrong:** The app shows as "Electron" in the macOS dock or Windows taskbar instead of "Claw".

**Prevention:** Set `app.name = 'Claw'` before any windows are created. On macOS, also set the `CFBundleName` in the app's Info.plist (handled automatically if using electron-vite's build config).

**Phase to address:** Phase 1 (Electron setup).

---

### Pitfall 15: Multiple Instances of Claw Running

**What goes wrong:** User runs `claw start` in two terminal tabs. Both try to spawn Electron, both try to spawn dev servers. Port conflicts and confusion.

**Prevention:** Use `app.requestSingleInstanceLock()` in Electron main process. In the CLI, check if the target port is already in use before spawning the dev server.

**Phase to address:** Phase 1 (CLI startup).

---

### Pitfall 16: HMR WebSocket Connection Through Electron

**What goes wrong:** Dev server HMR uses WebSocket connections. Electron's security settings or network configuration might interfere with WebSocket connections to localhost.

**Prevention:** Since we are loading localhost directly in the BrowserWindow (not through a proxy), WebSocket connections work the same as in a regular browser. Do not set `webSecurity: false` -- the default `true` already allows same-origin WebSocket connections. If HMR fails, it is likely a dev server configuration issue, not a Claw issue.

**Phase to address:** Phase 1 (verify during Electron setup).

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Injecting overlay CSS into user's page instead of separate WebContentsView | Faster to prototype, simpler architecture | Escalating z-index wars, style conflicts, layout interference, stacking context bugs | Never in production -- prototype only |
| Hardcoding framework-specific stdout patterns for readiness detection | Works for the one framework you test with | Breaks for every other framework, requires constant maintenance as output formats change | Never -- use TCP port polling from the start |
| Using `child.kill()` instead of `tree-kill` for process cleanup | One fewer dependency | Zombie grandchild processes on every exit, port conflicts on restart | Never -- the dep is tiny and saves hours of debugging |
| Skipping Claude Code health monitoring | Fewer moving parts initially | Silent failures, hung UI, orphaned sessions, token waste | MVP only -- add monitoring before any user testing |
| Storing selection state in Electron main process globals | Simple, no IPC needed for state | Impossible to test, state leaks between selections, no multi-window support | Phase 1 prototype only, refactor in Phase 2 |
| Synchronous `executeJavaScript` calls for DOM capture | Simpler control flow | Blocks Electron main thread, UI freezes during large DOM traversals | Never -- always use async |
| Sending full-page DOM to Claude instead of selected region | Simpler implementation | Claude's context window fills up, responses slow or truncate, worse edit quality | Never -- prune from the start |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Claude Code CLI subprocess | Treating it as a request/response API (send instruction, get result) | It is a stateful session. Monitor for crashes, handle streaming output, implement timeouts, manage the conversation context window |
| User's dev server | Assuming it is ready when the process spawns | Poll the TCP port. The process starts immediately but the server may take 5-30 seconds to compile and bind |
| Electron BrowserWindow loading localhost | Loading the URL before the dev server is ready | Wait for TCP port availability, then call `loadURL()`. Handle `did-fail-load` and retry with backoff |
| Screenshot capture via `capturePage()` | Passing CSS pixel coordinates directly | Multiply by `devicePixelRatio`. Test on Retina displays |
| DOM traversal for context capture | Using `document.querySelectorAll('*')` and assuming complete coverage | Must recursively enter shadow roots, handle iframes (same-origin only), and skip non-visible elements |
| Preload script IPC | Exposing `ipcRenderer` directly via contextBridge | Expose specific, named methods only. Never pass raw IPC access to the renderer |
| Claude Code non-interactive mode | Spawning with `-p` flag and expecting synchronous results | Use `--output-format stream-json` for real-time progress. Claude Code operations can take 30-120+ seconds |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Full-page DOM serialization on every selection | 2-5 second freeze when user draws selection box on complex pages | Only serialize elements within the selected region's bounding box. Use manual rect-check to filter | Pages with 5000+ DOM nodes (common in data tables, dashboards) |
| Unthrottled screenshot capture | High CPU, Electron becomes laggy, fan noise | Only capture on selection completion, never continuously. `capturePage()` is expensive -- it forces a composite | Any page |
| Sending full page HTML to Claude Code | Claude's context window fills up, responses slow or truncate | Prune to selected region + immediate ancestors. Limit serialized DOM to around 10KB | Pages with 20KB+ of HTML |
| Spawning a new Claude Code process per instruction | 3-5 second startup per interaction, feels sluggish | Keep a persistent session. Use conversation continuation (resume) | Every interaction without a persistent session |
| Polling stdout with regex matching for server readiness | CPU spin loop, delayed detection, fragile pattern matching | Use TCP socket connection attempt with exponential backoff (50ms, 100ms, 200ms...) | When dev server takes 10+ seconds to start |
| Synchronous DOM traversal in renderer | Main thread blocks, overlay becomes unresponsive | Use async iteration with `requestIdleCallback` or chunk the traversal across frames | Pages with deep DOM trees (10+ levels) and 1000+ nodes |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| `nodeIntegration: true` on the BrowserWindow loading localhost | Full RCE via any XSS in the user's site or its third-party scripts | Always `nodeIntegration: false`. No exceptions |
| Exposing `shell.openExternal()` via IPC without URL validation | The loaded page could open `file:///` URLs or trigger arbitrary protocols | Validate URLs against an allowlist of schemes (`http:`, `https:`) before passing to `shell.openExternal()` |
| Running Claude Code with unscoped working directory | Claude edits files outside the project directory | Always spawn Claude Code with `cwd` set to the project root |
| IPC handler that accepts arbitrary file paths from renderer | The loaded site (via XSS) could read/write any file on disk via Claw's IPC | Validate all file paths from renderer are within the project root. Never accept absolute paths from the renderer |
| No CSP on the Electron BrowserWindow | XSS in the user's site can load arbitrary remote scripts that exploit the Electron context | Set CSP via `webRequest.onHeadersReceived` -- restrict default-src and script-src appropriately for dev servers |
| Storing API keys or tokens in Electron's renderer-accessible storage | User's Anthropic credentials exposed via devtools or XSS | Claude Code manages its own auth. Claw should never handle API keys directly |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No feedback while Claude Code is processing | User thinks the tool crashed, submits duplicate requests, or closes the app | Show streaming status: "Claude is reading your codebase...", "Claude is editing src/App.tsx...", "Waiting for HMR..." |
| Error messages showing stack traces or internal errors | User has no idea what to do. "ProcessTransport is not ready for writing" means nothing | Translate every error to a user action: "Claude Code disconnected. Press Enter to reconnect." |
| Silent failure when dev server fails to start | User sees blank Electron window with no explanation | Show the dev server's stderr output in a status panel. Suggest running the dev command manually to check for errors |
| Selection overlay always active, blocking interaction with the app | User cannot scroll, click, or interact with their site to navigate to the area they want to edit | Toggle mode: keyboard shortcut to enter selection mode, Escape to exit. Default to interaction mode |
| No indication of what changed after Claude edits | User sees HMR flash but does not know which files changed | Show a notification with changed file names and line ranges, with option to view diff |
| Requiring complex CLI flags to get started | User gives up before seeing value | Smart defaults: auto-detect `dev` script from package.json, auto-detect port from server output. Zero-config for 80% of projects |

## "Looks Done But Isn't" Checklist

- [ ] **Selection overlay:** Often missing scroll position handling -- verify selection accuracy after scrolling down the page 500px
- [ ] **Screenshot capture:** Often missing DPI scaling -- verify capture matches selection on Retina display (devicePixelRatio 2)
- [ ] **Process cleanup:** Often missing force-kill fallback -- verify no orphan processes after force-killing the Claw process
- [ ] **Dev server detection:** Often missing timeout -- verify behavior when the dev command fails to start (missing node_modules, syntax error)
- [ ] **Claude Code integration:** Often missing error recovery -- verify behavior when Claude Code process crashes mid-edit
- [ ] **DOM capture:** Often missing shadow DOM traversal -- verify capture includes elements inside web components
- [ ] **Cross-origin iframes:** Often missing graceful handling -- verify the tool does not crash when a cross-origin iframe exists on the page (just skip it)
- [ ] **Windows compatibility:** Often missing signal handling -- verify process cleanup works on Windows (no POSIX signals, need taskkill)
- [ ] **Multi-monitor:** Often missing DPI handling -- verify selection overlay works when dragging Electron window between monitors with different DPI
- [ ] **Large pages:** Often missing performance -- verify selection does not freeze on a page with 10,000+ DOM nodes
- [ ] **capturePage on hidden window:** Often missing validation -- verify screenshot capture handles minimized/occluded window gracefully

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Zombie processes left running | LOW | Add startup check: scan for orphaned processes from previous runs (PID file or port check), kill them, warn user |
| Security misconfiguration shipped | HIGH | Requires refactoring all IPC communication. Must audit every `contextBridge` exposure. Blocking release issue |
| Wrong coordinate system (CSS vs device pixels) | MEDIUM | Create a coordinate utility module. Find and replace all raw coordinate usage. Regression test on multiple DPI values |
| Claude Code session corruption | LOW | Kill subprocess, spawn new session. User loses conversation context but can re-describe the change |
| Overlay interfering with user's app | HIGH | Requires architectural change from injected CSS to separate WebContentsView. Significant refactoring |
| Failed dev server detection | LOW | Fall back to user-specified port. Show manual override instructions. Consider `--url` flag to skip server management entirely |
| DOM context too noisy for Claude | MEDIUM | Iterative improvement: add filters for framework noise, improve element selection heuristics, limit serialization depth |
| Distribution/installation failures | MEDIUM | Separate CLI package from Electron binary. Add architecture detection and fallback download logic |
| BrowserView deprecation migration | MEDIUM | WebContentsView API is similar. Migration is mechanical but requires testing all view composition behaviors |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Orphan processes (#1) | Phase 1 (process management) | Force-kill Claw process, verify dev server and Claude Code processes are gone. Test on macOS, Linux, Windows |
| Electron security (#2) | Phase 1 (Electron setup) | Grep for `nodeIntegration`, `contextIsolation`, `webSecurity` in config. All must be secure defaults |
| BrowserView deprecation (#3) | Phase 1 (Electron setup) | Zero references to `BrowserView` in codebase. Only `WebContentsView` + `BaseWindow` |
| Overlay breaks user's app (#4) | Phase 2 (selection overlay) | Test on a site with modals, dropdowns, shadow DOM components, and fixed-position headers |
| Claude Code session failure (#5) | Phase 2 (Claude integration) | Kill Claude Code subprocess during an edit. Verify Claw detects it, shows error, allows reconnection |
| DPI coordinate mismatch (#6) | Phase 2 (selection + capture) | Test screenshot capture at devicePixelRatio 1, 2, and 3. Compare captured region to selection rectangle visually |
| Dev server readiness (#7) | Phase 1 (CLI + dev server) | Test with Vite, Next.js, and Webpack projects. Test with server that takes 15 seconds to start. Test failure case |
| DOM-to-source mapping (#8) | Phase 2-3 (context capture) | Test on React, Next.js, Vue, Svelte, and plain HTML sites. Verify Claude edits the correct file >80% of the time |
| Transparent view artifacts (#9) | Phase 2 (overlay) | Draw/clear multiple selections rapidly. Check for ghost images or paint artifacts |
| DOM serialization limits (#10) | Phase 2 (DOM extraction) | Verify `executeJavaScript` returns complete, well-formed plain objects for complex pages |
| capturePage empty image (#11) | Phase 2 (capture) | Test capture with minimized window and with window behind other windows |
| Claude Code not installed (#12) | Phase 1 (CLI startup) | Run `claw start` without `claude` in PATH. Verify clear error message |
| Electron binary distribution (#5 from STACK) | Phase 3+ (packaging) | Test install on macOS ARM, macOS Intel, Linux x64, Windows x64. Verify install completes cleanly |

---

## Sources

- [Electron Security Documentation](https://www.electronjs.org/docs/latest/tutorial/security) - Context isolation, CSP, node integration (HIGH confidence)
- [Electron Context Isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation) - Preload script security patterns (HIGH confidence)
- [Electron Process Sandboxing](https://www.electronjs.org/docs/latest/tutorial/sandbox/) - Sandbox behavior with nodeIntegration (HIGH confidence)
- [Bishop Fox: Design A Reasonably Secure Electron Framework](https://bishopfox.com/blog/reasonably-secure-electron) - Security architecture patterns (HIGH confidence)
- [Electron WebContentsView Migration](https://www.electronjs.org/blog/migrate-to-webcontentsview) - BrowserView deprecation (HIGH confidence)
- [WebContentsView Transparent Bug](https://github.com/electron/electron/issues/42335) - Rendering artifacts (HIGH confidence)
- [capturePage Empty on Windows](https://github.com/electron/electron/issues/31992) - Hidden window capture bug (HIGH confidence)
- [tree-kill npm](https://www.npmjs.com/package/tree-kill) - Process tree management (HIGH confidence)
- [Node.js Child Process Documentation](https://nodejs.org/api/child_process.html) - Process lifecycle (HIGH confidence)
- [Claude Code Headless/Programmatic Mode](https://code.claude.com/docs/en/headless) - Non-interactive usage (HIGH confidence)
- [Claude Code CLI subprocess death issue](https://github.com/agentclientprotocol/claude-agent-acp/issues/338) - Session recovery patterns (MEDIUM confidence)
- [MDN: getBoundingClientRect()](https://developer.mozilla.org/en-US/docs/Web/API/Element/getBoundingClientRect) - Coordinate systems (HIGH confidence)
- [Chrome Top Layer Documentation](https://developer.chrome.com/blog/what-is-the-top-layer) - Z-index limitations (HIGH confidence)
- [Electron DPI Issues](https://github.com/electron/electron/issues/8533) - Multi-monitor DPI bugs (HIGH confidence)
- [Electron capturePage Discussion](https://github.com/electron/electron/issues/17834) - Screenshot capture limitations (HIGH confidence)
- [Vite Port Resolution Issue](https://github.com/vitejs/vite/issues/7271) - Port auto-detection challenges (MEDIUM confidence)
- [Electron Packaging Guide (2026)](https://dev.to/raxxostudios/how-to-build-and-distribute-an-electron-desktop-app-in-2026-24nk) - Distribution patterns (MEDIUM confidence)
- [Node.js Graceful Shutdown](https://dev.to/superiqbal7/graceful-shutdown-in-nodejs-handling-stranger-danger-29jo) - Signal handling patterns (HIGH confidence)

---
*Pitfalls research for: Visual web development tool (CLI + Electron + AI code editing)*
*Researched: 2026-04-03*
