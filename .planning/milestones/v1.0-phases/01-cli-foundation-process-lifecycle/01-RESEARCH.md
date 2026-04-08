# Phase 1: CLI Foundation & Process Lifecycle - Research

**Researched:** 2026-04-03
**Domain:** CLI framework, process lifecycle, dev server detection, Claude Code integration
**Confidence:** HIGH

## Summary

Phase 1 establishes the CLI entry point (`clawdesign start`), dev server auto-detection and spawning, Claude Code session initialization, and graceful multi-process shutdown. This is a greenfield phase -- no existing code, no migration concerns. The technology stack is well-defined in CLAUDE.md, and the key remaining decision (D-11: Agent SDK vs CLI subprocess) has been resolved by this research: the Agent SDK (`@anthropic-ai/claude-agent-sdk`) fully supports streaming mode with image content blocks, multi-turn sessions, and programmatic process management.

The project structure follows electron-vite conventions with three build targets (main, preload, renderer). The CLI entry point is a separate Node.js script (not bundled by electron-vite) that orchestrates startup: parse args, detect dev server, spawn processes, wait for readiness, then hand off to Electron.

**Primary recommendation:** Use `@anthropic-ai/claude-agent-sdk` with streaming input mode for Claude Code integration. Use `net.createConnection()` polling for port readiness detection (no extra dependency). Structure the CLI as a standalone TypeScript entry point compiled separately from the electron-vite build.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Step-by-step progress output with spinners: detecting dev server -> starting server -> waiting for port -> launching Claude Code -> opening Electron. Clean, structured terminal output.
- **D-02:** Dev server stdout/stderr hidden by default. Visible with `--verbose` flag.
- **D-03:** Binary name is `clawdesign` (matches npm package name exactly).
- **D-04:** Phase 1 supports `clawdesign start`, `clawdesign --version`, and `clawdesign --help`. No other subcommands yet.
- **D-05:** Auto-detect dev server script from package.json in priority order: `dev` > `start` > `serve`. First match wins.
- **D-06:** When no matching script found, print clear error listing what was looked for and suggest `--cmd` flag. Do not prompt interactively for this.
- **D-07:** Port detection: parse dev server stdout for common port patterns (e.g., "localhost:3000", "port 3000"). If nothing detected, prompt user interactively to specify the port.
- **D-08:** `--port` flag available for convenience (skip auto-detection entirely).
- **D-09:** 30-second timeout waiting for dev server readiness. Show spinner with elapsed time.
- **D-10:** Spawn Claude Code session eagerly at startup (during the startup sequence, not lazily on first selection). Session is ready the instant the user makes their first selection.
- **D-11:** Agent SDK vs CLI subprocess: defer to researcher. Both approaches should be investigated before planning. STATE.md leans toward Agent SDK but this needs verification of current capabilities (multi-turn streaming, image content blocks).
- **D-12:** Claude Code not installed: check for `claude` in PATH at startup. If missing, print error with installation link (https://claude.ai/download) and exit immediately.
- **D-13:** Dev server crash mid-session: notify in terminal that dev server exited. Keep Electron window open. User restarts with Ctrl+C and re-runs `clawdesign start`.
- **D-14:** Port already in use: detect occupied port, show PID and process name if possible, suggest `kill <pid>` or `--port <other>`.
- **D-15:** Startup timeout: after 30s without port readiness, show timeout error with suggestions (check dev server output with --verbose, specify port with --port).

### Claude's Discretion
- Terminal color scheme and exact spinner styles (using picocolors + ora)
- Exact stdout parsing patterns for port detection
- Internal process management implementation details

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CLI-01 | User can run `clawdesign start` in a project directory to launch the full workflow | Commander v14 `program.command('start')` with action handler; `bin` field in package.json |
| CLI-02 | CLI auto-detects dev server start command from package.json (dev > start > serve) | Read and parse `package.json` scripts object; priority-ordered lookup |
| CLI-03 | User can override dev server command with `--cmd` flag | Commander `.option('--cmd <command>')` on start subcommand |
| CLI-04 | CLI spawns dev server as child process and detects when it's ready (port listening) | `child_process.spawn()` + stdout parsing for port + `net.createConnection()` polling for readiness |
| CLI-05 | CLI spawns Claude Code session pointed at the current codebase | `@anthropic-ai/claude-agent-sdk` `query()` with streaming input mode, `cwd` set to project directory |
| PROC-01 | All child processes (dev server, Claude Code, Electron) shut down gracefully on exit | Signal handlers (SIGINT, SIGTERM) + tree-kill for dev server + Agent SDK `query.close()` for Claude |
| PROC-02 | Dev server process tree is fully killed (no zombie/orphan processes) | tree-kill v1.2.2 sends signal to entire process tree (uses `pgrep -P` on macOS) |
| PROC-03 | CLI handles SIGINT/SIGTERM for clean shutdown | `process.on('SIGINT')` and `process.on('SIGTERM')` handlers coordinating ordered teardown |
| FRAME-01 | Tool works with any web framework that serves on localhost | Stdout regex patterns covering Vite, Next.js, Webpack, CRA, and generic `localhost:PORT` / `port PORT` patterns |
| FRAME-02 | No framework-specific plugins, middleware, or configuration required | Architecture decision: load user's localhost URL directly in Electron, zero coupling to user's framework |

</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| commander | 14.0.3 | CLI parsing | Zero deps, fastest startup (18-25ms). TypeScript types built-in. Requires Node 20+. 35M weekly downloads. v15 releases May 2026 (v14 gets security updates to May 2027). |
| @anthropic-ai/claude-agent-sdk | 0.2.91 | Claude Code integration | Official Anthropic SDK (renamed from `@anthropic-ai/claude-code`). Streaming input mode supports multi-turn, image content blocks, session management. Actively maintained (published daily). |
| tree-kill | 1.2.2 | Process tree cleanup | Kills entire process tree including root. Uses `pgrep -P` on macOS, `taskkill /T` on Windows. 18M weekly downloads. Stable API (unchanged 6+ years). |
| picocolors | 1.1.1 | Terminal colors | 14x smaller than chalk, 2x faster. Supports CJS and ESM. Used by PostCSS ecosystem. 16 colors sufficient for CLI status output. |
| ora | 9.3.0 | Spinners | Standard loading spinner. ESM-only since v8, but electron-vite bundles ESM fine. Used for step-by-step startup progress per D-01. |
| electron | ^36.x | Desktop shell | Per CLAUDE.md spec. NOTE: latest is 41.1.1 (see Version Note below). Phase 1 does not launch Electron UI but must structure for Phase 2. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| electron-vite | 5.0.0 | Build tooling | Project scaffolding and build system. Handles main/preload/renderer builds. Requires Node 20.19+ and Vite 5+. |
| typescript | ~5.7 | Type safety | Per CLAUDE.md. Critical for IPC type safety in later phases. |

### Version Note: Electron

CLAUDE.md specifies `electron ^36.x`. Current npm latest is 41.1.1. Supported versions are 39, 40, 41. Version 36 is still on npm (`36-x-y` tag at 36.9.5) but is no longer in the actively maintained window. **Recommendation for planning:** Use `^36.x` as specified in CLAUDE.md for Phase 1 since Electron is not launched in this phase. Flag for user decision before Phase 2 when Electron actually launches -- upgrading to a maintained version (39+) would be prudent.

### Package Rename: Claude Code SDK

The package formerly known as `@anthropic-ai/claude-code` has been renamed to `@anthropic-ai/claude-agent-sdk`. The migration guide says: `npm uninstall @anthropic-ai/claude-code && npm install @anthropic-ai/claude-agent-sdk`. CLAUDE.md does not reference a specific package name for Claude integration, so this rename is non-breaking for our decisions.

**Installation:**
```bash
npm install commander@^14.0.0 @anthropic-ai/claude-agent-sdk@^0.2.0 tree-kill@^1.2.2 picocolors@^1.1.0 ora@^9.0.0
npm install -D electron@^36.0.0 electron-vite@^5.0.0 typescript@~5.7 vitest@^4.0.0 @types/node@^22.0.0
```

**Version verification (2026-04-03):**

| Package | npm latest | Verified |
|---------|-----------|----------|
| commander | 14.0.3 | Yes |
| @anthropic-ai/claude-agent-sdk | 0.2.91 | Yes |
| tree-kill | 1.2.2 | Yes |
| picocolors | 1.1.1 | Yes |
| ora | 9.3.0 | Yes |
| electron | 41.1.1 (using ^36.x per CLAUDE.md) | Yes |
| electron-vite | 5.0.0 | Yes |
| vitest | 4.1.2 | Yes |

## Architecture Patterns

### Recommended Project Structure

```
claw-design/
  src/
    cli/                      # CLI entry point and commands
      index.ts                # #!/usr/bin/env node -- bin entry
      commands/
        start.ts              # clawdesign start command logic
      utils/
        dev-server.ts         # Dev server detection + spawning
        port-detect.ts        # Port readiness detection
        claude.ts             # Claude Code session management
        process.ts            # Shutdown coordination
        output.ts             # Terminal output (spinners, colors)
    main/                     # Electron main process (electron-vite)
      index.ts
    preload/                  # Electron preload script (electron-vite)
      index.ts
    renderer/                 # Electron renderer (electron-vite)
      index.html
  electron.vite.config.ts     # electron-vite config (main + preload + renderer)
  tsconfig.json
  tsconfig.cli.json           # Separate TS config for CLI (compiled outside electron-vite)
  package.json                # bin: { clawdesign: "./dist/cli/index.js" }
  vitest.config.ts
```

**Key insight:** The CLI (`src/cli/`) is compiled separately from the Electron code (`src/main/`, `src/preload/`, `src/renderer/`). electron-vite handles the Electron build targets. The CLI is compiled with plain `tsc` or a separate Vite/esbuild config. This separation follows CLAUDE.md's Key Technical Decision #1: "CLI spawns Electron, not the other way around."

### Pattern 1: CLI Entry Point with Commander

**What:** Single `start` command with options, delegating to orchestration logic
**When to use:** Always -- this is the only entry point

```typescript
// src/cli/index.ts
// #!/usr/bin/env node
import { Command } from 'commander';
import { version } from '../../package.json';
import { startCommand } from './commands/start.js';

const program = new Command();

program
  .name('clawdesign')
  .description('Visual web development tool powered by Claude Code')
  .version(version);

program
  .command('start')
  .description('Launch dev server and open visual editor')
  .option('--cmd <command>', 'Override dev server command')
  .option('--port <number>', 'Specify dev server port (skip auto-detection)')
  .option('--verbose', 'Show dev server output')
  .action(startCommand);

program.parse();
```

### Pattern 2: Dev Server Detection from package.json

**What:** Read project's package.json, find dev server script in priority order
**When to use:** When `--cmd` flag is not provided

```typescript
// src/cli/utils/dev-server.ts
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const SCRIPT_PRIORITY = ['dev', 'start', 'serve'] as const;

interface DetectedScript {
  name: string;
  command: string;
}

export async function detectDevServerScript(
  projectDir: string
): Promise<DetectedScript> {
  const pkgPath = join(projectDir, 'package.json');
  const raw = await readFile(pkgPath, 'utf-8');
  const pkg = JSON.parse(raw);

  if (!pkg.scripts) {
    throw new DetectionError('No "scripts" field found in package.json');
  }

  for (const name of SCRIPT_PRIORITY) {
    if (pkg.scripts[name]) {
      return { name, command: pkg.scripts[name] };
    }
  }

  throw new DetectionError(
    `No dev server script found in package.json.\n` +
    `  Looked for: ${SCRIPT_PRIORITY.join(', ')}\n` +
    `  Tip: use --cmd "your-dev-command" to specify manually`
  );
}
```

### Pattern 3: Spawning Dev Server with stdout Piping

**What:** Spawn dev server via `npm run <script>`, capture stdout for port detection
**When to use:** After detecting or receiving the dev server command

```typescript
// src/cli/utils/dev-server.ts (continued)
import { spawn, type ChildProcess } from 'node:child_process';

export function spawnDevServer(
  command: string,
  verbose: boolean
): ChildProcess {
  // Use shell: true to handle npm scripts correctly
  const child = spawn(command, {
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: process.cwd(),
  });

  if (verbose) {
    child.stdout?.pipe(process.stdout);
    child.stderr?.pipe(process.stderr);
  }

  return child;
}
```

### Pattern 4: Port Detection (Two-Phase)

**What:** Phase A: parse stdout for port number. Phase B: poll with TCP connect to confirm readiness.
**When to use:** After spawning dev server, unless `--port` flag was provided

```typescript
// src/cli/utils/port-detect.ts
import { createConnection } from 'node:net';

// Phase A: Extract port from dev server stdout
const PORT_PATTERNS = [
  // http://localhost:3000 or https://127.0.0.1:8080
  /https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::\]):(\d+)/,
  // "port: 3000", "Port 3000", "PORT=3000"
  /(?:port|Port|PORT)\s*[:=]?\s*(\d+)/,
  // "listening on port 3000", "running at port 8080"
  /(?:listening|running)\s+(?:on|at)\s+(?:port\s+)?(\d+)/i,
  // fallback: any 4-5 digit number after colon (e.g., :3000)
  /:(\d{4,5})\b/,
];

export function extractPortFromOutput(output: string): number | null {
  for (const pattern of PORT_PATTERNS) {
    const match = output.match(pattern);
    if (match) {
      const port = parseInt(match[1], 10);
      if (port > 0 && port <= 65535) return port;
    }
  }
  return null;
}

// Phase B: TCP connect poll to verify port is accepting connections
export function waitForPort(
  port: number,
  opts: { timeout: number; interval?: number } = {
    timeout: 30_000,
    interval: 250,
  }
): Promise<void> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    function attempt() {
      if (Date.now() - startTime > opts.timeout) {
        reject(
          new Error(
            `Timeout: port ${port} not ready after ${opts.timeout / 1000}s`
          )
        );
        return;
      }

      const socket = createConnection({ port, host: '127.0.0.1' });
      socket.once('connect', () => {
        socket.destroy();
        resolve();
      });
      socket.once('error', () => {
        socket.destroy();
        setTimeout(attempt, opts.interval ?? 250);
      });
    }

    attempt();
  });
}
```

### Pattern 5: Claude Code Agent SDK (Streaming Input Mode)

**What:** Spawn Claude Code session using Agent SDK with async generator for multi-turn messaging
**When to use:** Eagerly at startup (D-10), session persists for the lifetime of `clawdesign start`

```typescript
// src/cli/utils/claude.ts
import { query, type Query } from '@anthropic-ai/claude-agent-sdk';

export async function spawnClaudeSession(cwd: string): Promise<{
  query: Query;
  sendMessage: (msg: any) => void;
  close: () => void;
}> {
  // Create an async generator that yields messages over time
  let resolveNext: ((msg: any) => void) | null = null;
  const messageQueue: any[] = [];

  async function* messageStream() {
    while (true) {
      if (messageQueue.length > 0) {
        yield messageQueue.shift()!;
      } else {
        yield await new Promise<any>((resolve) => {
          resolveNext = resolve;
        });
      }
    }
  }

  const q = query({
    prompt: messageStream(),
    options: {
      cwd,
      systemPrompt: {
        type: 'preset',
        preset: 'claude_code',
        append:
          'You are being used by claw-design, a visual web development ' +
          'tool. The user will provide screenshots and DOM context of ' +
          'regions of their website along with change instructions. ' +
          'Edit the source code to implement their requested changes.',
      },
      allowedTools: ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash'],
      settingSources: ['project'],
    },
  });

  function sendMessage(msg: any) {
    if (resolveNext) {
      const resolve = resolveNext;
      resolveNext = null;
      resolve(msg);
    } else {
      messageQueue.push(msg);
    }
  }

  return {
    query: q,
    sendMessage,
    close: () => q.close(),
  };
}
```

### Pattern 6: Graceful Shutdown Coordination

**What:** Ordered teardown of all child processes on SIGINT/SIGTERM/uncaught exception
**When to use:** Registered once at startup, triggered by any exit signal

```typescript
// src/cli/utils/process.ts
import kill from 'tree-kill';

interface ManagedProcesses {
  devServer?: { pid: number };
  claudeSession?: { close: () => void };
  electronProcess?: { pid: number };
}

let shuttingDown = false;

export function registerShutdownHandlers(processes: ManagedProcesses) {
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;

    console.log(`\n  Shutting down (${signal})...`);

    // 1. Close Claude session (graceful)
    try {
      processes.claudeSession?.close();
    } catch {
      /* ignore */
    }

    // 2. Kill Electron process tree
    if (processes.electronProcess?.pid) {
      kill(processes.electronProcess.pid, 'SIGTERM');
    }

    // 3. Kill dev server process tree
    if (processes.devServer?.pid) {
      kill(processes.devServer.pid, 'SIGTERM');
    }

    // 4. Force exit after 5s if still alive
    setTimeout(() => process.exit(1), 5000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err);
    shutdown('uncaughtException');
  });
}
```

### Anti-Patterns to Avoid

- **Do not use `process.kill(pid)` without tree-kill:** Dev servers (especially Webpack, Vite, Next.js) spawn child processes. `process.kill()` only kills the parent, leaving orphans. Always use tree-kill.
- **Do not use `child_process.exec()` for dev servers:** exec buffers stdout/stderr and has a maxBuffer limit. Long-running dev servers will hit this. Use `spawn()` with `stdio: 'pipe'`.
- **Do not parse port from stderr only:** Some frameworks print readiness to stdout, others to stderr. Capture and parse both streams.
- **Do not use synchronous file I/O in the CLI:** `readFileSync` blocks the event loop during startup. Use `readFile` (async) to keep spinners animated.
- **Do not import Electron modules in the CLI entry:** The CLI runs in plain Node.js. Electron modules are only available inside the Electron process. Keep the CLI independent.

## D-11 Resolution: Agent SDK (Recommended)

The `@anthropic-ai/claude-agent-sdk` (v0.2.91) is the correct choice over raw CLI subprocess spawning.

**Evidence:**

1. **Streaming input mode** (official docs, verified): Supports `AsyncIterable<SDKUserMessage>` prompt, enabling multi-turn conversations as a long-lived process. This is exactly what claw-design needs -- a persistent session that receives new instructions over time.

2. **Image content blocks** (official docs, verified): Streaming input mode supports image attachments via `{ type: "image", source: { type: "base64", media_type: "image/png", data: "..." } }` content blocks. Single message mode does NOT support images. This means we MUST use streaming input mode.

3. **Session management** (official docs, verified): Sessions persist automatically to disk. `continue: true` or `resume: sessionId` enables multi-turn context. Claude retains full context from previous interactions.

4. **Process lifecycle**: `query.close()` cleanly terminates the underlying process. `query.interrupt()` cancels in-progress work. `AbortController` support via options.

5. **Claude Code preset**: `systemPrompt: { type: 'preset', preset: 'claude_code', append: '...' }` gives us Claude Code's full system prompt with our custom instructions appended.

6. **Tool configuration**: `allowedTools` controls which tools are auto-approved. `permissionMode: 'bypassPermissions'` available but not recommended for user-facing tool.

**Confidence: HIGH** -- All claims verified against official platform.claude.com documentation.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Process tree killing | PID tracking + recursive kill | tree-kill | macOS, Linux, Windows all have different process tree APIs. tree-kill handles all three. |
| CLI argument parsing | Manual argv parsing | commander | Option validation, help generation, version flag, error messages all handled. |
| Terminal spinners | Custom ANSI escape sequences | ora | Handles terminal width, line clearing, concurrent output, Windows Terminal compatibility. |
| Claude Code integration | Raw `child_process.spawn('claude', ...)` with stdin/stdout parsing | @anthropic-ai/claude-agent-sdk | SDK handles message framing, session persistence, process spawning, streaming, error recovery. Raw subprocess would require parsing unstructured CLI output. |
| Port readiness check | External `wait-on` / `detect-port` package | `net.createConnection()` polling | 10 lines of code, zero dependencies. `wait-on` (9.0.4) is 90KB+ with 7 dependencies for something trivial. |

**Key insight:** The only non-trivial piece here is Claude Code integration -- the Agent SDK exists specifically to avoid reimplementing the message protocol.

## Common Pitfalls

### Pitfall 1: Dev Server Spawned Without Shell

**What goes wrong:** `spawn('npm run dev')` without `shell: true` fails because `npm` is resolved through PATH by the shell, not by Node.js directly.
**Why it happens:** `spawn()` defaults to `shell: false` for security. But npm scripts require shell interpretation.
**How to avoid:** Always use `spawn(command, { shell: true })` for npm scripts. Or split: `spawn('npm', ['run', 'dev'])`.
**Warning signs:** `ENOENT` error on spawn.

### Pitfall 2: Orphan Processes After Ctrl+C

**What goes wrong:** User presses Ctrl+C, main process exits, dev server keeps running. Port stays occupied.
**Why it happens:** SIGINT is only sent to the foreground process group. Child processes spawned with `spawn()` may not receive it. Process trees (npm -> node -> webpack) require recursive killing.
**How to avoid:** Use tree-kill on every managed child process PID. Register handlers for SIGINT, SIGTERM, and `beforeExit`.
**Warning signs:** "Port already in use" error on next `clawdesign start`.

### Pitfall 3: ora Spinner + stdout Interleaving

**What goes wrong:** Dev server stdout (when `--verbose`) interleaves with ora spinner, producing garbled terminal output.
**Why it happens:** ora uses ANSI escape codes to redraw the current line. If another stream writes to stdout simultaneously, the cursor position gets corrupted.
**How to avoid:** When `--verbose`, stop the spinner before piping dev server output, or use ora's `text` property to display status alongside output. Better: route dev server output to stderr or a separate log panel.
**Warning signs:** Broken/duplicated spinner text in terminal.

### Pitfall 4: Port Detection Regex False Positives

**What goes wrong:** Port regex matches a port number from an unrelated log line (e.g., "Connected to database on port 5432").
**Why it happens:** Generic regex patterns like `port\s+\d+` match too broadly.
**How to avoid:** Order patterns from most specific (full URL with localhost) to least specific. Stop at first match. Validate with TCP connect before declaring ready.
**Warning signs:** CLI reports ready but site is not accessible.

### Pitfall 5: Agent SDK Requires Claude Code Installed

**What goes wrong:** Agent SDK spawns a Claude Code subprocess internally. If `claude` is not in PATH or not installed, it throws an error.
**Why it happens:** The SDK is a programmatic wrapper around Claude Code, not a standalone API client.
**How to avoid:** Check for `claude` in PATH at startup (D-12). Use a PATH lookup before attempting to use the SDK.
**Warning signs:** Cryptic spawn error from Agent SDK internals.

### Pitfall 6: ESM-Only Packages in CLI Build

**What goes wrong:** `ora` v9 is ESM-only. If the CLI is compiled to CJS (`"type": "commonjs"`), importing ora fails with `ERR_REQUIRE_ESM`.
**Why it happens:** Node.js CJS cannot `require()` ESM modules (without experimental flags).
**How to avoid:** Set `"type": "module"` in package.json. The electron-vite build system supports ESM natively. Compile CLI entry with ESM output format.
**Warning signs:** `ERR_REQUIRE_ESM` at runtime.

### Pitfall 7: `npm run` Script Detection Misses Package Managers

**What goes wrong:** User uses `yarn`, `pnpm`, or `bun` but we spawn with `npm run`.
**Why it happens:** Hardcoding `npm run <script>`.
**How to avoid:** The `--cmd` flag is the escape hatch. For auto-detection, use `npm run` as default since it works in almost all setups (yarn/pnpm projects still have npm available). Document that `--cmd` exists for non-npm setups.
**Warning signs:** `npm: command not found` (very rare -- if Node.js is installed, npm is too).

## Code Examples

### Example 1: Complete Start Command Flow

```typescript
// src/cli/commands/start.ts
import {
  detectDevServerScript,
  spawnDevServer,
} from '../utils/dev-server.js';
import {
  extractPortFromOutput,
  waitForPort,
} from '../utils/port-detect.js';
import { spawnClaudeSession } from '../utils/claude.js';
import { registerShutdownHandlers } from '../utils/process.js';
import ora from 'ora';
import pc from 'picocolors';

interface StartOptions {
  cmd?: string;
  port?: string;
  verbose?: boolean;
}

export async function startCommand(options: StartOptions) {
  const cwd = process.cwd();

  // Step 1: Detect dev server
  const spinner = ora('Detecting dev server...').start();
  let command: string;

  if (options.cmd) {
    command = options.cmd;
    spinner.succeed(`Using custom command: ${pc.cyan(command)}`);
  } else {
    try {
      const detected = await detectDevServerScript(cwd);
      command = `npm run ${detected.name}`;
      spinner.succeed(
        `Detected: ${pc.cyan(`npm run ${detected.name}`)} ` +
        `(from package.json)`
      );
    } catch (err) {
      spinner.fail('No dev server detected');
      console.error(pc.red((err as Error).message));
      process.exit(1);
    }
  }

  // Step 2: Spawn dev server
  const devSpinner = ora('Starting dev server...').start();
  const devServer = spawnDevServer(command, options.verbose ?? false);

  // Step 3: Detect port (from stdout or --port flag)
  let port: number;
  if (options.port) {
    port = parseInt(options.port, 10);
  } else {
    // Accumulate stdout, try to extract port
    port = await detectPortFromStdout(devServer);
  }

  // Step 4: Wait for port readiness
  devSpinner.text = `Waiting for localhost:${port}...`;
  try {
    await waitForPort(port, { timeout: 30_000 });
    devSpinner.succeed(
      `Dev server ready on ${pc.cyan(`http://localhost:${port}`)}`
    );
  } catch {
    devSpinner.fail(`Timeout: port ${port} not ready after 30s`);
    console.error(
      pc.dim('  Try: clawdesign start --verbose')
    );
    console.error(
      pc.dim('  Try: clawdesign start --port <port>')
    );
    process.exit(1);
  }

  // Step 5: Check Claude Code is installed (D-12)
  const claudeSpinner = ora('Launching Claude Code...').start();
  if (!isClaudeInstalled()) {
    claudeSpinner.fail('Claude Code not found');
    console.error(
      pc.red('  Claude Code CLI is not installed or not in PATH.')
    );
    console.error(
      pc.dim(`  Install: ${pc.cyan('https://claude.ai/download')}`)
    );
    process.exit(1);
  }

  // Step 6: Spawn Claude Code session (D-10: eager)
  const claude = await spawnClaudeSession(cwd);
  claudeSpinner.succeed('Claude Code session ready');

  // Register shutdown handlers
  registerShutdownHandlers({
    devServer: { pid: devServer.pid! },
    claudeSession: claude,
  });

  // Phase 1 complete output
  console.log();
  console.log(pc.green('  Ready!'));
  console.log(
    pc.dim(`  Dev server: http://localhost:${port}`)
  );
  console.log(pc.dim('  Press Ctrl+C to stop'));
}
```

### Example 2: Port-in-Use Detection (D-14)

```typescript
// src/cli/utils/port-detect.ts (port-in-use check)
import { execFileSync } from 'node:child_process';

export function getProcessOnPort(
  port: number
): { pid: number; name: string } | null {
  try {
    // macOS/Linux: lsof to find process on port
    const output = execFileSync('lsof', ['-i', `:${port}`, '-t'], {
      encoding: 'utf-8',
    }).trim();
    if (!output) return null;

    const pid = parseInt(output.split('\n')[0], 10);
    const name = execFileSync('ps', ['-p', String(pid), '-o', 'comm='], {
      encoding: 'utf-8',
    }).trim();
    return { pid, name };
  } catch {
    return null;
  }
}
```

### Example 3: Claude Code Installed Check (D-12)

```typescript
// src/cli/utils/claude.ts
import { execFileSync } from 'node:child_process';

export function isClaudeInstalled(): boolean {
  try {
    execFileSync('which', ['claude'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@anthropic-ai/claude-code` | `@anthropic-ai/claude-agent-sdk` | 2026 Q1 | Package renamed. Must install new package name. |
| BrowserView (deprecated) | BaseWindow + WebContentsView | Electron 30 (2024) | Affects Phase 2, not Phase 1. Architecture confirmed correct. |
| Electron Forge | electron-vite (standalone) | 2024-2025 | Forge's Vite support is experimental. electron-vite is lighter for npm-distributed tools. |
| chalk | picocolors | 2023+ | chalk went ESM-only v5. picocolors is smaller, faster, dual CJS/ESM. |
| Single-shot Agent SDK queries | Streaming input mode | Agent SDK v0.2.x | Streaming is now the recommended mode. Required for image uploads. |

## Open Questions

1. **Electron Version Update**
   - What we know: CLAUDE.md specifies ^36.x. Current supported versions are 39, 40, 41. v36 is out of maintenance window.
   - What's unclear: Whether user wants to stay on ^36 or upgrade. Phase 1 does not launch Electron, so this is not blocking.
   - Recommendation: Proceed with ^36.x for Phase 1 (it installs fine, just will not receive security patches). Raise to user before Phase 2.

2. **Agent SDK Permission Mode**
   - What we know: `bypassPermissions` is available but requires `allowDangerouslySkipPermissions: true`. Default mode prompts for each tool use.
   - What's unclear: How permission prompts surface in streaming mode when embedded in claw-design. Probably via `canUseTool` callback or `allowedTools`.
   - Recommendation: Use `allowedTools` to auto-approve standard tools (Read, Write, Edit, Glob, Grep, Bash). This avoids permission prompts for normal operations without bypassing all safety.

3. **CLI Build Strategy**
   - What we know: electron-vite builds main/preload/renderer. The CLI entry is separate.
   - What's unclear: Whether to add a separate esbuild/tsc step for CLI, or configure electron-vite to also build the CLI.
   - Recommendation: Use a simple `tsc` compilation for the CLI entry. Keep it decoupled from electron-vite. The CLI is small, no bundling needed.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Runtime | Yes | v24.4.1 | -- |
| npm | Package management | Yes | 11.4.2 | -- |
| Claude Code CLI | D-12 check, Agent SDK | Yes | 2.1.91 | -- (must be installed) |
| Electron (binary) | Phase 2+ (not Phase 1) | N/A | Installed per-project | -- |

**Missing dependencies with no fallback:** None. All Phase 1 dependencies are available.

**Missing dependencies with fallback:** None.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.x |
| Config file | None -- Wave 0 creates `vitest.config.ts` |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CLI-01 | `clawdesign start` launches workflow | integration | `npx vitest run tests/cli/start.test.ts -t "start command"` | No -- Wave 0 |
| CLI-02 | Auto-detect dev server from package.json | unit | `npx vitest run tests/cli/dev-server.test.ts -t "detect script"` | No -- Wave 0 |
| CLI-03 | `--cmd` flag overrides detection | unit | `npx vitest run tests/cli/dev-server.test.ts -t "cmd override"` | No -- Wave 0 |
| CLI-04 | Spawn dev server + port detection | unit + integration | `npx vitest run tests/cli/port-detect.test.ts` | No -- Wave 0 |
| CLI-05 | Spawn Claude Code session | unit (mocked) | `npx vitest run tests/cli/claude.test.ts` | No -- Wave 0 |
| PROC-01 | All processes shut down on exit | integration | `npx vitest run tests/cli/shutdown.test.ts` | No -- Wave 0 |
| PROC-02 | Process tree fully killed | unit | `npx vitest run tests/cli/process.test.ts -t "tree kill"` | No -- Wave 0 |
| PROC-03 | SIGINT/SIGTERM handlers | unit | `npx vitest run tests/cli/process.test.ts -t "signal"` | No -- Wave 0 |
| FRAME-01 | Works with any framework | unit | `npx vitest run tests/cli/port-detect.test.ts -t "patterns"` | No -- Wave 0 |
| FRAME-02 | No framework-specific config | manual-only | Architecture review -- no test needed (verified by absence of framework detection code) | N/A |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `vitest.config.ts` -- project-level Vitest configuration
- [ ] `tsconfig.json` + `tsconfig.cli.json` -- TypeScript configs
- [ ] `tests/cli/dev-server.test.ts` -- covers CLI-02, CLI-03
- [ ] `tests/cli/port-detect.test.ts` -- covers CLI-04, FRAME-01
- [ ] `tests/cli/claude.test.ts` -- covers CLI-05 (mocked Agent SDK)
- [ ] `tests/cli/process.test.ts` -- covers PROC-01, PROC-02, PROC-03
- [ ] `tests/cli/start.test.ts` -- covers CLI-01 (integration)
- [ ] Framework install: `npm install -D vitest@^4.0.0`

## Sources

### Primary (HIGH confidence)
- [Anthropic Agent SDK TypeScript Reference](https://platform.claude.com/docs/en/agent-sdk/typescript) -- full API reference, Options type, query() function, message types
- [Anthropic Agent SDK Sessions](https://platform.claude.com/docs/en/agent-sdk/sessions) -- session management, continue/resume/fork patterns
- [Anthropic Agent SDK Streaming](https://platform.claude.com/docs/en/agent-sdk/streaming-vs-single-mode) -- streaming vs single input mode, image support confirmation
- [Commander.js GitHub](https://github.com/tj/commander.js) -- v14 API, TypeScript support, command/option patterns
- [electron-vite Getting Started](https://electron-vite.org/guide/) -- project structure, configuration, scaffolding
- [tree-kill GitHub](https://github.com/jub3i/tree-kill) -- platform-specific kill strategies, callback API

### Secondary (MEDIUM confidence)
- [Electron Releases](https://releases.electronjs.org/) -- version 41 current, 39/40/41 maintained
- [npm registry](https://www.npmjs.com/) -- package version verification (all verified 2026-04-03)
- [Node.js net module docs](https://nodejs.org/api/net.html) -- createConnection for port polling
- [Node.js child_process docs](https://nodejs.org/api/child_process.html) -- spawn, signal handling

### Tertiary (LOW confidence)
- Dev server stdout patterns (community knowledge, not formally documented by frameworks)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all packages verified on npm, APIs confirmed from official docs
- Architecture: HIGH -- follows CLAUDE.md Key Technical Decisions, electron-vite conventions documented
- Claude Code integration (D-11): HIGH -- Agent SDK streaming mode with images verified from official Anthropic docs
- Port detection: MEDIUM -- stdout regex patterns are community knowledge; TCP polling is reliable
- Pitfalls: HIGH -- all based on well-known Node.js process management issues

**Research date:** 2026-04-03
**Valid until:** 2026-05-03 (30 days -- stable domain, Agent SDK may update frequently but API is stable)

## Project Constraints (from CLAUDE.md)

**Enforced directives affecting this phase:**
- Binary name: `clawdesign` (CLAUDE.md + D-03)
- CLI spawns Electron, not the other way around (CLAUDE.md Key Technical Decision #1)
- Renderer loads user's localhost directly (CLAUDE.md Key Technical Decision #2)
- Distribution via npm `bin` field, not native installers (CLAUDE.md Distribution section)
- Platform: Electron for browser window (CLAUDE.md Constraints)
- Node.js >= 20.x LTS required (CLAUDE.md Runtime)
- TypeScript ~5.7 (CLAUDE.md Language)
- `tree-kill` for process cleanup, not naive `process.kill()` (CLAUDE.md + STATE.md)
- `commander` ^14 for CLI (CLAUDE.md CLI Framework)
- `picocolors` + `ora` for terminal UI (CLAUDE.md Terminal UI)
- `child_process.spawn()` for process management (CLAUDE.md Process Management)
- Never create .env.backup files (user global CLAUDE.md)
- GSD workflow must be used for changes (CLAUDE.md GSD section)
