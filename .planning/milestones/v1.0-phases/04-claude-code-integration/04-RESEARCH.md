# Phase 4: Claude Code Integration - Research

**Researched:** 2026-04-04
**Domain:** Claude Agent SDK integration, multi-agent orchestration, Electron IPC for real-time status, sidebar WebContentsView architecture
**Confidence:** HIGH

## Summary

Phase 4 wires the submit pipeline to Claude Code via the Agent SDK. The existing `overlay:submit-instruction` IPC handler (currently a stub) receives `{ instruction, screenshot, dom, bounds }` and must assemble a prompt with image content blocks, spawn a Claude agent, stream status updates to a new sidebar WebContentsView, and handle errors with retry.

The critical research finding is that the Agent SDK `query()` function accepts `AsyncIterable<SDKUserMessage>` as its prompt, and `SDKUserMessage.message` is typed as `MessageParam` from the Anthropic SDK, which supports `ImageBlockParam` with `Base64ImageSource`. This means **PNG screenshot buffers can be sent as base64-encoded image content blocks directly in the user message** -- no file saving required. This was the primary research flag from STATE.md and is now confirmed HIGH confidence from the installed SDK type definitions (v0.2.91).

For multi-agent parallel execution, each instruction spawns a separate `query()` call (separate Claude Code process). The Agent SDK does not provide inter-query coordination -- each `query()` is independent. The decision D-13/D-14/D-15 (parallel by default, max 3-4, dependency inference) must be implemented as application-level logic in a new "agent manager" module. The SDK's built-in subagent feature (`agents` option) is a different pattern -- it lets Claude decide when to delegate to child agents within a single query. For claw-design, we need multiple independent top-level queries running in parallel, not subagents within one query.

**Primary recommendation:** Each instruction gets its own `query()` call with a one-shot string prompt (not streaming input mode). The prompt contains text instruction + base64 image + DOM context JSON as content blocks. An AgentManager class in the main process tracks active queries, enforces concurrency limits, and pipes status updates to the sidebar via IPC.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: Right-side overlay panel for tracking in-flight and completed edits. Floats over the site content (does not shrink site viewport width).
- D-02: Sidebar is NOT part of the overlay WebContentsView -- must persist when overlay bounds toggle shrinks overlay to 48x48 on deactivation. Claude has discretion on rendering approach.
- D-03: Hidden by default -- does not exist until first instruction is submitted. A small icon appears on the right edge (vertically centered, middle-right) after first submit.
- D-04: Click the icon to expand the full sidebar panel. Click again (or a minimize button) to collapse back to the icon position with animated slide transition.
- D-05: Minimized state shows a compact badge with summary (e.g., "3/5") next to the icon, partially visible on the right edge.
- D-06: When a new task is submitted, sidebar auto-expands briefly (~2 seconds) to show the new task, then auto-minimizes back to the badge.
- D-07: When a task completes or errors while minimized, the badge pulses/glows briefly to indicate a change. Errors pulse with a red/orange accent color.
- D-08: When the sidebar is expanded and the user enters selection mode, sidebar auto-minimizes to maximize visible site area for accurate selection. Re-expands after submit.
- D-09: Matches the existing dark overlay aesthetic: rgba(10,10,10,0.88) background, white text, rounded corners.
- D-10: Simple 3-state model per task: Sending -> Editing -> Done. Errors replace any state.
- D-11: Each task row shows instruction text (truncated) and status badge. No screenshot thumbnails.
- D-12: Completed and errored tasks persist until explicitly dismissed by the user.
- D-13: Parallel execution by default -- each instruction spawns a separate Claude agent. Instructions do NOT queue unless dependent.
- D-14: Claude infers dependencies from instruction text. When a new instruction references a prior edit, it queues behind the relevant in-flight task.
- D-15: Maximum 3-4 parallel agents at any time. Additional independent instructions queue behind the oldest running agent.
- D-16: Research must investigate current Agent SDK capabilities for multi-agent patterns.
- D-17: Errors appear inline in the sidebar task row.
- D-18: Errors pulse badge but do NOT auto-expand.
- D-19: Retry prefills the instruction input bar with original instruction text. Submit sends a fresh capture.

### Claude's Discretion
- Prompt assembly format (how screenshot, DOM context, and instruction are structured in the message content blocks)
- Sidebar rendering architecture (separate WebContentsView, BrowserWindow child, or other approach that persists across overlay state changes)
- Agent SDK configuration for parallel agents (system prompt, allowed tools, shared context strategy)
- Dependency detection implementation (NLP heuristics, keyword matching, or other approach)
- Animation timing and easing for sidebar expand/collapse/pulse
- Exact sidebar width when expanded
- How the "queued" state is displayed in the sidebar

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CLAUD-01 | Screenshot + DOM context + user instruction are assembled into a prompt and sent to Claude Code | Agent SDK `query()` accepts `MessageParam` with `ImageBlockParam` (base64 PNG) + `TextBlockParam` content blocks. Prompt assembly pattern documented below. |
| CLAUD-02 | Claude Code edits source files based on the visual context and instruction | Agent SDK `query()` with `allowedTools: ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash']` and `permissionMode: 'acceptEdits'` enables autonomous file editing. HMR works naturally since BrowserWindow loads localhost. |
| CLAUD-03 | Status feedback shows current state: capturing, sending to Claude, Claude editing, changes applied | Agent SDK streams `SDKMessage` types including `SDKSystemMessage` (init), `SDKAssistantMessage` (editing), `SDKResultMessage` (done/error). Map to D-10 states via IPC to sidebar. |
| CLAUD-04 | When Claude Code encounters an error, a clear message is shown with option to retry | `SDKResultMessage` with `subtype: 'error'` or `SDKAssistantMessage` with `error` field. Error types include `authentication_failed`, `rate_limit`, `server_error`, `billing_error`. Map to sidebar error row with retry/dismiss per D-17/D-19. |
</phase_requirements>

## Standard Stack

### Core (Phase 4 additions -- all other deps already established)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @anthropic-ai/claude-agent-sdk | ^0.2.91 (installed: 0.2.91, latest: 0.2.92) | Claude Code agent integration | Already in package.json. Provides `query()` for spawning Claude Code sessions with built-in tools. |

### Supporting (no new dependencies)

Phase 4 requires no new npm packages. All capabilities come from:
- Agent SDK (already installed)
- Electron built-ins (WebContentsView, IPC, NativeImage)
- Node.js built-ins (Buffer for base64 encoding)

### Version Verification

```
@anthropic-ai/claude-agent-sdk: installed 0.2.91, latest 0.2.92 (verified 2026-04-04)
```

The 0.2.91 -> 0.2.92 delta is minor. No breaking changes. Safe to stay on ^0.2.0.

## Architecture Patterns

### Recommended Project Structure (new/modified files)

```
src/
├── main/
│   ├── window.ts          # EXTEND: add sidebarView (3rd WebContentsView), extend syncBounds()
│   ├── ipc-handlers.ts    # EXTEND: wire submit-instruction to AgentManager, add sidebar IPC channels
│   ├── agent-manager.ts   # NEW: multi-agent orchestration, concurrency control, status tracking
│   └── prompt.ts          # NEW: prompt assembly (screenshot + DOM + instruction -> MessageParam content blocks)
├── preload/
│   └── sidebar.ts         # NEW: contextBridge for sidebar IPC
├── renderer/
│   ├── sidebar.html       # NEW: sidebar HTML shell
│   ├── sidebar.css        # NEW: sidebar styles (dark chrome aesthetic)
│   └── sidebar.ts         # NEW: sidebar renderer logic (task list, expand/collapse, animations)
└── cli/
    └── utils/
        └── claude.ts      # EXTEND: export spawnOneShot() alongside existing session, or refactor
```

### Pattern 1: One-Shot Query Per Instruction (not streaming input mode)

**What:** Each user instruction spawns a separate `query()` call with a one-shot string prompt (or content block array). The query runs to completion and returns a result.

**When to use:** Always -- claw-design instructions are independent editing tasks, not multi-turn conversations. The existing `spawnClaudeSession()` pattern (streaming input with async generator) is unnecessary for Phase 4's model of "send instruction, wait for result."

**Why not the existing streaming session pattern:** The current `claude.ts` creates a persistent session with an async generator message queue for multi-turn interaction. Phase 4 needs parallel independent agents, not sequential turns on one session. Each instruction gets its own query, its own session, its own context window.

**Example:**
```typescript
// Source: Agent SDK type definitions (sdk.d.ts) + official docs
import { query, type SDKMessage, type SDKResultMessage } from '@anthropic-ai/claude-agent-sdk';

// One-shot query for a single instruction
const q = query({
  prompt: assemblePrompt(instruction, screenshotBase64, domContext),
  options: {
    cwd: projectDir,
    systemPrompt: {
      type: 'preset',
      preset: 'claude_code',
      append: 'You are used by claw-design. The user selected a region of their website ' +
              'and provided a screenshot, DOM context, and change instruction. ' +
              'Edit the source code to implement the change. Be concise in your response.',
    },
    allowedTools: ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash'],
    permissionMode: 'acceptEdits',
    settingSources: ['project'],
    maxTurns: 20,
    persistSession: false,  // Ephemeral -- no need to resume these
  },
});

// Stream messages for status tracking
for await (const message of q) {
  if (message.type === 'system' && message.subtype === 'init') {
    updateTaskStatus(taskId, 'editing');
  }
  if (message.type === 'assistant') {
    // Claude is actively working -- status remains "editing"
  }
  if (message.type === 'result') {
    if (message.subtype === 'success') {
      updateTaskStatus(taskId, 'done');
    } else {
      updateTaskStatus(taskId, 'error', extractErrorMessage(message));
    }
  }
}
```

### Pattern 2: Prompt Assembly with Image Content Blocks

**What:** Structure the user message as an array of content blocks: text instruction + base64 PNG screenshot + DOM context JSON.

**When to use:** Every instruction submission.

**Example:**
```typescript
// Source: Anthropic SDK types (messages.d.ts) - ImageBlockParam, TextBlockParam
import type { MessageParam } from '@anthropic-ai/sdk/resources';

function assemblePrompt(
  instruction: string,
  screenshotBuffer: Buffer,
  domContext: DomExtractionResult,
): string {
  // For one-shot query, prompt is a string. But we need image content blocks.
  // Solution: use AsyncIterable<SDKUserMessage> with a single message containing content blocks.
  // OR: Use the string prompt and reference the image via a different mechanism.
  //
  // The query() prompt parameter accepts string | AsyncIterable<SDKUserMessage>.
  // SDKUserMessage.message is MessageParam which supports content block arrays.
  // So we use the AsyncIterable form with a single-message iterable.
  return ''; // See assemblePromptMessage() below
}

function assemblePromptMessage(
  instruction: string,
  screenshotBuffer: Buffer,
  domContext: DomExtractionResult,
): AsyncIterable<SDKUserMessage> {
  const contentBlocks = [
    {
      type: 'text' as const,
      text: `## Change Instruction\n\n${instruction}`,
    },
    {
      type: 'image' as const,
      source: {
        type: 'base64' as const,
        media_type: 'image/png' as const,
        data: screenshotBuffer.toString('base64'),
      },
    },
    {
      type: 'text' as const,
      text: `## DOM Context\n\nElements in the selected region:\n\`\`\`json\n${JSON.stringify(domContext, null, 2)}\n\`\`\``,
    },
  ];

  const userMessage: SDKUserMessage = {
    type: 'user',
    message: {
      role: 'user',
      content: contentBlocks,
    },
    parent_tool_use_id: null,
  };

  // Single-message async iterable
  return (async function* () {
    yield userMessage;
  })();
}
```

### Pattern 3: Agent Manager (concurrency control + status routing)

**What:** A class in the main process that manages concurrent `query()` calls, enforces the max parallel limit (D-15), tracks task state, and routes status updates via IPC.

**When to use:** This is the central orchestration module for Phase 4.

**Example:**
```typescript
// Source: application design based on CONTEXT.md decisions

interface Task {
  id: string;
  instruction: string;
  status: 'queued' | 'sending' | 'editing' | 'done' | 'error';
  error?: string;
  screenshot: Buffer;
  dom: DomExtractionResult;
  bounds: CSSRect;
  query?: Query;
  abortController?: AbortController;
}

class AgentManager {
  private tasks: Map<string, Task> = new Map();
  private activeCount = 0;
  private readonly maxParallel = 3;
  private readonly projectDir: string;

  constructor(projectDir: string) {
    this.projectDir = projectDir;
  }

  async submitTask(task: Omit<Task, 'id' | 'status'>): Promise<string> {
    const id = crypto.randomUUID();
    const newTask: Task = { ...task, id, status: 'queued' };
    this.tasks.set(id, newTask);
    this.emitTaskUpdate(newTask);
    this.processQueue();
    return id;
  }

  private async processQueue(): Promise<void> {
    if (this.activeCount >= this.maxParallel) return;

    const nextQueued = [...this.tasks.values()].find(t => t.status === 'queued');
    if (!nextQueued) return;

    this.activeCount++;
    nextQueued.status = 'sending';
    this.emitTaskUpdate(nextQueued);

    try {
      await this.executeTask(nextQueued);
    } finally {
      this.activeCount--;
      this.processQueue(); // Check if more queued tasks can start
    }
  }

  private async executeTask(task: Task): Promise<void> {
    const abortController = new AbortController();
    task.abortController = abortController;

    const q = query({
      prompt: assemblePromptMessage(task.instruction, task.screenshot, task.dom),
      options: {
        abortController,
        cwd: this.projectDir,
        systemPrompt: { type: 'preset', preset: 'claude_code', append: '...' },
        allowedTools: ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash'],
        permissionMode: 'acceptEdits',
        settingSources: ['project'],
        persistSession: false,
      },
    });

    task.query = q;

    for await (const message of q) {
      if (message.type === 'system' && message.subtype === 'init') {
        task.status = 'editing';
        this.emitTaskUpdate(task);
      }
      if (message.type === 'result') {
        if (message.subtype === 'success') {
          task.status = 'done';
        } else {
          task.status = 'error';
          task.error = this.extractErrorMessage(message);
        }
        this.emitTaskUpdate(task);
      }
    }
  }

  dismissTask(id: string): void {
    this.tasks.delete(id);
    // Notify sidebar
  }
}
```

### Pattern 4: Sidebar as Third WebContentsView

**What:** The sidebar is a separate WebContentsView added to the BaseWindow after the overlay view. It has its own preload script, HTML, CSS, and TypeScript renderer. Bounds are managed by the main process (like the overlay bounds toggle pattern).

**When to use:** This satisfies D-02 (sidebar persists across overlay state changes).

**Why this approach:** The UI-SPEC already mandates this architecture. The sidebar view's bounds are independent of the overlay view's bounds. When the overlay shrinks to 48x48 for inactive mode, the sidebar remains at its position (minimized icon or expanded panel).

**Example (window.ts extension):**
```typescript
// Add sidebar view to WindowComponents
export interface WindowComponents {
  window: BaseWindow;
  siteView: WebContentsView;
  overlayView: WebContentsView;
  sidebarView: WebContentsView;  // NEW
  setOverlayIsActive: (active: boolean) => void;
  setSidebarState: (state: 'hidden' | 'minimized' | 'expanded') => void;  // NEW
}

// In createMainWindow():
const sidebarView = new WebContentsView({
  webPreferences: {
    contextIsolation: true,
    sandbox: true,
    nodeIntegration: false,
    webSecurity: true,
    preload: path.join(__dirname, '../preload/sidebar.cjs'),
  },
});
sidebarView.setBackgroundColor('#00000000');
win.contentView.addChildView(sidebarView); // Added last = topmost

// Start hidden (zero-size bounds per D-03)
sidebarView.setBounds({ x: 0, y: 0, width: 0, height: 0 });
```

### Anti-Patterns to Avoid

- **Reusing the existing streaming session for parallel tasks:** The existing `spawnClaudeSession()` creates a single persistent session with an async generator queue. Sending multiple instructions to the same session would serialize them. Each instruction MUST get its own `query()` call.

- **Spawning Claude Code via raw child_process:** The project already chose the Agent SDK (STATE.md: "Agent SDK for Claude Code (not raw child_process)"). The SDK handles process management, tool execution, and message serialization.

- **Rendering sidebar inside the overlay WebContentsView:** The overlay shrinks to 48x48 when inactive (bounds toggle pattern). The sidebar must survive this. Separate WebContentsView is mandatory.

- **Using subagents within a single query for parallel editing:** The SDK's subagent feature is for delegating subtasks within one agent's context (e.g., code-reviewer + test-runner). Claw-design needs independent top-level editing sessions, not child agents.

- **Storing screenshot as file before sending:** The SDK accepts base64 image content blocks in-memory. No temp file needed. Buffer.toString('base64') is sufficient.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Claude Code process management | Custom child_process spawning with stdio parsing | Agent SDK `query()` | SDK handles process lifecycle, message serialization, tool execution loop, error recovery |
| File editing by AI | Custom file editing + diff application | Agent SDK built-in tools (Read, Write, Edit) | Claude Code's Edit tool has built-in merge conflict detection, line-number verification, partial edits |
| Permission management | Custom tool approval flow | `permissionMode: 'acceptEdits'` option | SDK auto-approves file edits; no user prompt needed for each tool use |
| Session cleanup | Manual process killing on abort | `query.close()` + AbortController | SDK cleans up its child process, temp files, and MCP servers |
| UUID generation | Custom ID generation | `crypto.randomUUID()` | Built-in Node.js, same format as SDK uses internally |

**Key insight:** The Agent SDK is a thick abstraction over Claude Code CLI. It spawns a Node.js child process running the full Claude Code runtime with all built-in tools. We send a prompt, it does everything, we get a stream of status messages. The complexity is in orchestrating multiple of these in parallel, not in the Claude interaction itself.

## Common Pitfalls

### Pitfall 1: Buffer Serialization Across IPC

**What goes wrong:** The `screenshot` field in the `overlay:submit-instruction` handler arrives as a `Buffer` from `captureRegion()`. However, Electron IPC serializes objects using the structured clone algorithm, which converts `Buffer` to `Uint8Array`. If code assumes `Buffer.toString('base64')` is available, it may fail.

**Why it happens:** Electron IPC uses structured cloning, not JSON serialization. `Buffer` instances become `Uint8Array` on the receiving end.

**How to avoid:** In the IPC handler, convert to Buffer explicitly: `Buffer.from(data.screenshot)` before calling `.toString('base64')`. Or convert in the renderer before sending (use `NativeImage.toPNG()` which returns Buffer, but it crosses IPC).

**Warning signs:** `TypeError: data.screenshot.toString is not a function` or base64 output is garbled.

### Pitfall 2: Query Process Accumulation

**What goes wrong:** Each `query()` call spawns a Claude Code child process. If tasks are submitted rapidly and old queries are not cleaned up, the system accumulates dozens of Node.js processes consuming memory and API quota.

**Why it happens:** The Agent SDK `query()` starts a process that runs until the async generator is fully consumed or `.close()` is called. If the consuming `for await` loop errors out without closing the query, the process leaks.

**How to avoid:** Always wrap query consumption in try/finally with `q.close()`. Use `AbortController` for each task and call `.abort()` on dismiss. Track all active queries in the AgentManager and close them all on shutdown.

**Warning signs:** High memory usage, "too many open files" errors, concurrent API requests exceeding quota.

### Pitfall 3: IPC Channel Flooding

**What goes wrong:** The Agent SDK emits many messages per query (system init, partial assistant messages, tool progress, stream events). If every message triggers an IPC send to the sidebar renderer, the IPC channel becomes a bottleneck.

**Why it happens:** Claude Code processes generate 50-200+ messages per editing task (each tool use, each text delta, etc.).

**How to avoid:** Only send meaningful state transitions over IPC: `sending -> editing -> done/error`. Do NOT pipe raw SDK messages to the renderer. The AgentManager filters messages and emits only task-level state changes.

**Warning signs:** UI jank, high CPU in renderer process, IPC error "object could not be cloned."

### Pitfall 4: Race Condition on Sidebar State During Overlay Toggle

**What goes wrong:** When the user enters selection mode (D-08), the sidebar should auto-minimize. But if a task completes at the same time, the task-completion handler tries to pulse the badge. These two state changes can conflict.

**Why it happens:** Overlay activation and task status updates are asynchronous events from different sources.

**How to avoid:** Use a single state machine for sidebar state in the main process (not the renderer). The main process is the source of truth for sidebar bounds. Both "overlay activated" and "task completed" events go through the same state machine which determines the correct action.

**Warning signs:** Sidebar flickers between expanded and minimized, badge pulse triggers expand.

### Pitfall 5: electron-vite Multi-Entry Configuration

**What goes wrong:** Adding the sidebar as a new renderer entry to electron-vite requires updating the config with a new HTML input, and a new preload entry. Missing either causes build failures or blank views.

**Why it happens:** electron-vite builds main/preload/renderer as separate bundles. Each renderer with a preload needs both configured.

**How to avoid:** Add sidebar.html to `renderer.build.rollupOptions.input` and sidebar.ts to `preload.build.rollupOptions.input` in `electron.vite.config.ts`.

**Warning signs:** White blank sidebar view, preload script not found errors, CSP violations.

### Pitfall 6: Existing Claude Session Conflict

**What goes wrong:** The current `start.ts` creates a `spawnClaudeSession()` at startup (line 174). Phase 4 adds its own `query()` calls per instruction. If both the persistent session and per-instruction queries run simultaneously, they share the same Claude Code authentication and may hit rate limits faster.

**Why it happens:** The persistent session was designed in Phase 1 for a sequential model. Phase 4 moves to parallel one-shot queries.

**How to avoid:** The existing persistent session (`spawnClaudeSession()`) should be removed or replaced. Phase 4's AgentManager spawns queries on demand. The startup flow changes: instead of eagerly creating a session, the AgentManager is created (but spawns no queries until the first instruction). Update `registerShutdownHandlers` to close all active queries via AgentManager.

**Warning signs:** Multiple Claude Code processes from the same claw-design instance, unexpected "session already in use" errors.

## Code Examples

### Verified: SDKUserMessage with Image Content Block

```typescript
// Source: Agent SDK sdk.d.ts (line 1790-1793) + Anthropic SDK messages.d.ts (line 494-501, 95-99)
// The query() prompt accepts AsyncIterable<SDKUserMessage>.
// SDKUserMessage.message is MessageParam, which supports content: Array<ContentBlockParam>.
// ContentBlockParam includes ImageBlockParam with Base64ImageSource.

import { query, type SDKUserMessage, type SDKMessage } from '@anthropic-ai/claude-agent-sdk';

function createSingleMessageIterable(msg: SDKUserMessage): AsyncIterable<SDKUserMessage> {
  return (async function* () {
    yield msg;
  })();
}

const screenshotBase64 = screenshotBuffer.toString('base64');

const userMessage: SDKUserMessage = {
  type: 'user',
  message: {
    role: 'user',
    content: [
      { type: 'text', text: `Change requested: ${instruction}` },
      {
        type: 'image',
        source: {
          type: 'base64',
          media_type: 'image/png',
          data: screenshotBase64,
        },
      },
      {
        type: 'text',
        text: `DOM elements in selected region:\n${JSON.stringify(domContext, null, 2)}`,
      },
    ],
  },
  parent_tool_use_id: null,
};

const q = query({
  prompt: createSingleMessageIterable(userMessage),
  options: { /* ... */ },
});
```

### Verified: Agent SDK Message Types for Status Tracking

```typescript
// Source: Agent SDK sdk.d.ts -- SDKMessage union type (line 2389)
// Key message types for status mapping:

for await (const message of q) {
  switch (message.type) {
    case 'system':
      if (message.subtype === 'init') {
        // Claude Code process initialized -- transition from "sending" to "editing"
        // message.session_id is available here
      }
      if (message.subtype === 'status') {
        // SDKStatusMessage -- general status update
      }
      break;

    case 'assistant':
      // SDKAssistantMessage -- Claude is actively working
      // message.message is BetaMessage from Anthropic SDK
      // message.error is optional: 'authentication_failed' | 'rate_limit' | etc.
      if (message.error) {
        // Error during editing -- transition to "error" state
      }
      break;

    case 'tool_progress':
      // SDKToolProgressMessage -- a tool is executing
      // message.tool_name, message.elapsed_time_seconds
      // Useful for "Claude is editing file X" status if desired
      break;

    case 'result':
      // SDKResultMessage -- query complete
      if (message.subtype === 'success') {
        // message.result contains the final text response
        // message.duration_ms, message.total_cost_usd available
      } else {
        // message.subtype === 'error'
        // message.error: SDKAssistantMessageError type string
      }
      break;
  }
}
```

### Verified: Electron WebContentsView Sidebar Pattern

```typescript
// Source: Electron docs + existing window.ts pattern
// Adding a third WebContentsView follows the exact same pattern as the overlay view.

import { BaseWindow, WebContentsView } from 'electron';

// In createMainWindow():
const sidebarView = new WebContentsView({
  webPreferences: {
    contextIsolation: true,
    sandbox: true,
    nodeIntegration: false,
    webSecurity: true,
    preload: path.join(__dirname, '../preload/sidebar.cjs'),
  },
});
sidebarView.setBackgroundColor('#00000000');
win.contentView.addChildView(sidebarView);

// Load sidebar HTML
sidebarView.webContents.loadFile(
  path.join(__dirname, '../renderer/sidebar.html'),
);

// Initially hidden (D-03)
sidebarView.setBounds({ x: 0, y: 0, width: 0, height: 0 });
```

### Verified: IPC Channel for Task Updates (main -> renderer)

```typescript
// Source: Existing IPC pattern from ipc-handlers.ts + Electron docs
// Main process sends updates to sidebar renderer via webContents.send()

// In the AgentManager, when a task state changes:
function emitTaskUpdate(
  sidebarView: WebContentsView,
  task: { id: string; instruction: string; status: string; error?: string },
): void {
  sidebarView.webContents.send('sidebar:task-update', {
    id: task.id,
    instruction: task.instruction,
    status: task.status,
    error: task.error,
  });
}

// Sidebar preload exposes listener:
// contextBridge.exposeInMainWorld('clawSidebar', {
//   onTaskUpdate: (cb) => ipcRenderer.on('sidebar:task-update', (_e, data) => cb(data)),
//   expand: () => ipcRenderer.invoke('sidebar:expand'),
//   collapse: () => ipcRenderer.invoke('sidebar:collapse'),
//   dismissTask: (id) => ipcRenderer.invoke('sidebar:task-dismiss', id),
//   retryTask: (id) => ipcRenderer.invoke('sidebar:task-retry', id),
// });
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Claude Code SDK (`@anthropic-ai/claude-code`) | Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`) | Sep 2025 | Package renamed. `query()` API is the same. Import path changed. |
| Task tool (`name: "Task"`) | Agent tool (`name: "Agent"`) | Claude Code v2.1.63 | Subagent invocations use "Agent" not "Task" in tool_use blocks. Both names supported for compat. |
| Streaming input only | `query()` with string prompt OR AsyncIterable | Stable since v0.2.x | One-shot prompts are simpler for independent tasks. |
| `BrowserView` (deprecated) | `WebContentsView` | Electron 32+ | Already using WebContentsView in this project. |
| No V2 API | `unstable_v2_prompt()` and `unstable_v2_resumeSession()` | Preview in 0.2.x | V2 API is unstable/alpha. Do NOT use. Stick with `query()`. |

**Deprecated/outdated:**
- `BrowserView`: Deprecated in Electron. Already using `WebContentsView`.
- `setMaxThinkingTokens()`: Deprecated in favor of `thinking` option in `query()`.
- `@anthropic-ai/claude-code`: Renamed to `@anthropic-ai/claude-agent-sdk`.

## Open Questions

1. **Dependency detection heuristic (D-14)**
   - What we know: User decided Claude infers dependencies from instruction text. When referencing a prior edit, new task queues behind it.
   - What's unclear: Exact implementation. NLP is overkill. Simple keyword matching ("the header I just changed", "match the X I changed") could work.
   - Recommendation: Start with simple string matching in the AgentManager. Check if new instruction text contains references to in-flight task instructions (substring match, "the {noun} I just changed" pattern). If in doubt, run in parallel -- false negatives are better than unnecessary serialization.

2. **Handling the existing spawnClaudeSession()**
   - What we know: `start.ts` creates a persistent session at startup. Phase 4 needs per-instruction one-shot queries.
   - What's unclear: Whether to remove the persistent session entirely or keep it for future use.
   - Recommendation: Replace `spawnClaudeSession()` with `AgentManager` initialization. Remove the eager session spawn from `start.ts`. Update `registerShutdownHandlers` to use AgentManager for cleanup.

3. **AgentManager location: main process or CLI process?**
   - What we know: The Electron main process handles IPC. The CLI process spawned the Claude session in Phase 1. The main process needs to route submit-instruction to Claude and send updates to sidebar.
   - What's unclear: Whether AgentManager runs in Electron's main process or the CLI parent process.
   - Recommendation: AgentManager runs in the **Electron main process** (`src/main/agent-manager.ts`). The CLI process should NOT own agent lifecycle because: (a) IPC between CLI and Electron is more complex than within Electron, (b) the main process already has direct access to all WebContentsViews for status updates, (c) Agent SDK `query()` works fine from any Node.js context including Electron main. Remove the Claude session from the CLI process entirely.

4. **`permissionMode: 'acceptEdits'` vs `'bypassPermissions'`**
   - What we know: We want Claude to edit files without prompting. `acceptEdits` auto-accepts file edits. `bypassPermissions` skips ALL permission checks (requires `allowDangerouslySkipPermissions: true`).
   - What's unclear: Whether `acceptEdits` also auto-allows Bash commands.
   - Recommendation: Use `permissionMode: 'acceptEdits'` to auto-accept file reads/writes/edits. Bash commands may still prompt. For a dev tool operating on the user's own codebase, this is the right balance. If Bash auto-approval is needed, upgrade to `bypassPermissions` but note the security implications.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.0.0 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CLAUD-01 | Prompt assembly: screenshot + DOM + instruction -> content blocks | unit | `npx vitest run tests/main/prompt.test.ts -t "assemblePrompt" -x` | Wave 0 |
| CLAUD-01 | Submit handler routes to AgentManager | unit | `npx vitest run tests/main/agent-manager.test.ts -t "submitTask" -x` | Wave 0 |
| CLAUD-02 | Agent query executes with correct options | unit (mock query) | `npx vitest run tests/main/agent-manager.test.ts -t "executeTask" -x` | Wave 0 |
| CLAUD-03 | Status state machine: sending -> editing -> done | unit | `npx vitest run tests/main/agent-manager.test.ts -t "status" -x` | Wave 0 |
| CLAUD-03 | Task updates emitted via IPC | unit (mock webContents) | `npx vitest run tests/main/agent-manager.test.ts -t "emitTaskUpdate" -x` | Wave 0 |
| CLAUD-04 | Error messages extracted from SDK result | unit | `npx vitest run tests/main/agent-manager.test.ts -t "error" -x` | Wave 0 |
| CLAUD-04 | Retry creates fresh task with original instruction | unit | `npx vitest run tests/main/agent-manager.test.ts -t "retry" -x` | Wave 0 |
| D-15 | Concurrency limit enforced (max 3 parallel) | unit | `npx vitest run tests/main/agent-manager.test.ts -t "concurrency" -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before verify

### Wave 0 Gaps
- [ ] `tests/main/prompt.test.ts` -- covers CLAUD-01 prompt assembly
- [ ] `tests/main/agent-manager.test.ts` -- covers CLAUD-01 through CLAUD-04, D-15 concurrency
- [ ] `tests/main/sidebar-state.test.ts` -- covers sidebar state machine (hidden/minimized/expanded)
- [ ] Mock for `@anthropic-ai/claude-agent-sdk` `query()` -- needed since real agent spawns are expensive

## Sources

### Primary (HIGH confidence)
- `node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts` (v0.2.91) -- Full TypeScript type definitions: `query()`, `Options`, `SDKUserMessage`, `SDKMessage` union, `SDKResultMessage`, `AgentDefinition`. Verified image content block support through type chain: `SDKUserMessage.message` -> `MessageParam.content` -> `ContentBlockParam` -> `ImageBlockParam` -> `Base64ImageSource`.
- `node_modules/@anthropic-ai/sdk/resources/messages/messages.d.ts` -- Anthropic SDK message types: `MessageParam`, `ImageBlockParam`, `Base64ImageSource` with `media_type: 'image/png'`.
- Existing codebase: `src/cli/utils/claude.ts`, `src/main/ipc-handlers.ts`, `src/preload/overlay.ts`, `src/main/window.ts`, `src/renderer/overlay.ts`

### Secondary (MEDIUM confidence)
- [Agent SDK overview](https://platform.claude.com/docs/en/agent-sdk/overview) -- Official docs confirming `query()` API, subagent patterns, tool configuration
- [Subagents in the SDK](https://platform.claude.com/docs/en/agent-sdk/subagents) -- Official docs: subagents run in separate context windows, Agent tool invocation pattern, parallelization
- [Agent SDK TypeScript reference](https://platform.claude.com/docs/en/agent-sdk/typescript) -- Full API reference: `Query` interface methods, `SDKMessage` types, streaming input, V2 preview (unstable)
- `04-UI-SPEC.md` -- Approved UI specification for sidebar architecture, bounds management, IPC channels, component inventory

### Tertiary (LOW confidence)
- Dependency detection heuristic (D-14) -- no established pattern found; recommendation is based on reasoning about the problem, not existing solutions

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- Agent SDK already installed and types verified against source. No new dependencies needed.
- Architecture: HIGH -- Three-view pattern established in Phase 2. Agent SDK `query()` API confirmed via type definitions and official docs. One-shot query per instruction is clearly the right model.
- Pitfalls: HIGH -- Identified from code inspection (Buffer serialization, IPC flooding, session conflict) and Agent SDK type analysis (process cleanup, concurrency).
- Prompt assembly: HIGH -- Image content block support verified directly from installed SDK type definitions.
- Multi-agent: HIGH -- Confirmed that SDK provides independent `query()` calls, not built-in multi-agent coordination. Application-level orchestration required (AgentManager).
- Dependency detection (D-14): LOW -- No established solution. Recommendation is heuristic-based.

**Research date:** 2026-04-04
**Valid until:** 2026-05-04 (Agent SDK evolves rapidly but query() API is stable)
