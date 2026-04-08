# Phase 1: CLI Foundation & Process Lifecycle - Context

**Gathered:** 2026-04-03
**Status:** Ready for planning

<domain>
## Phase Boundary

CLI entry point (`clawdesign start`) that auto-detects and spawns the user's dev server, spawns a Claude Code session, opens the Electron window, and manages clean shutdown of all child processes. This phase delivers the orchestration foundation everything else depends on.

</domain>

<decisions>
## Implementation Decisions

### CLI Startup Experience
- **D-01:** Step-by-step progress output with spinners: detecting dev server -> starting server -> waiting for port -> launching Claude Code -> opening Electron. Clean, structured terminal output.
- **D-02:** Dev server stdout/stderr hidden by default. Visible with `--verbose` flag.
- **D-03:** Binary name is `clawdesign` (matches npm package name exactly).
- **D-04:** Phase 1 supports `clawdesign start`, `clawdesign --version`, and `clawdesign --help`. No other subcommands yet.

### Dev Server Detection
- **D-05:** Auto-detect dev server script from package.json in priority order: `dev` > `start` > `serve`. First match wins.
- **D-06:** When no matching script found, print clear error listing what was looked for and suggest `--cmd` flag. Do not prompt interactively for this.
- **D-07:** Port detection: parse dev server stdout for common port patterns (e.g., "localhost:3000", "port 3000"). If nothing detected, prompt user interactively to specify the port.
- **D-08:** `--port` flag available for convenience (skip auto-detection entirely).
- **D-09:** 30-second timeout waiting for dev server readiness. Show spinner with elapsed time.

### Claude Code Session
- **D-10:** Spawn Claude Code session eagerly at startup (during the startup sequence, not lazily on first selection). Session is ready the instant the user makes their first selection.
- **D-11:** Agent SDK vs CLI subprocess: defer to researcher. Both approaches should be investigated before planning. STATE.md leans toward Agent SDK but this needs verification of current capabilities (multi-turn streaming, image content blocks).

### Failure & Edge Cases
- **D-12:** Claude Code not installed: check for `claude` in PATH at startup. If missing, print error with installation link (https://claude.ai/download) and exit immediately.
- **D-13:** Dev server crash mid-session: notify in terminal that dev server exited. Keep Electron window open. User restarts with Ctrl+C and re-runs `clawdesign start`.
- **D-14:** Port already in use: detect occupied port, show PID and process name if possible, suggest `kill <pid>` or `--port <other>`.
- **D-15:** Startup timeout: after 30s without port readiness, show timeout error with suggestions (check dev server output with --verbose, specify port with --port).

### Claude's Discretion
- Terminal color scheme and exact spinner styles (using picocolors + ora)
- Exact stdout parsing patterns for port detection
- Internal process management implementation details

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Technology Stack
- `CLAUDE.md` -- Full technology stack decisions (commander, tree-kill, picocolors, ora, electron-vite, etc.)

### Architecture
- `CLAUDE.md` "Key Technical Decisions" section -- CLI spawns Electron (not the other way around), renderer loads localhost directly

### Requirements
- `.planning/REQUIREMENTS.md` -- CLI-01 through CLI-05, PROC-01 through PROC-03, FRAME-01, FRAME-02

### Project State
- `.planning/STATE.md` -- Prior decisions: Agent SDK for Claude Code, tree-kill for cleanup, BaseWindow + WebContentsView

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None -- greenfield project, no existing code

### Established Patterns
- None yet -- Phase 1 establishes the patterns for the project

### Integration Points
- npm `bin` field in package.json will point to CLI entry
- electron-vite builds main/preload/renderer processes
- commander handles CLI argument parsing

</code_context>

<specifics>
## Specific Ideas

- Terminal output style matches the step-by-step progress mockup: version header, checkmark/spinner for each step, "Ready!" message with port and Ctrl+C hint
- Error output style matches the structured error mockup: cross mark, description, actionable suggestion with example command

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 01-cli-foundation-process-lifecycle*
*Context gathered: 2026-04-03*
