# Phase 1: CLI Foundation & Process Lifecycle - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-04-03
**Phase:** 01-cli-foundation-process-lifecycle
**Areas discussed:** CLI startup experience, Dev server detection, Claude Code session timing, Failure & edge cases

---

## CLI Startup Experience

### Terminal Output Style

| Option | Description | Selected |
|--------|-------------|----------|
| Step-by-step progress | Show each lifecycle step with spinners. Dev server output hidden unless --verbose. | ✓ |
| Minimal + streaming | Brief status line, then stream dev server stdout/stderr below. | |
| Silent by default | No output unless something goes wrong. --verbose to see steps. | |

**User's choice:** Step-by-step progress
**Notes:** Selected the preview mockup with version header, checkmarks, spinners, and "Ready!" message.

### Dev Server Output Accessibility

| Option | Description | Selected |
|--------|-------------|----------|
| --verbose flag | Hidden by default, visible with --verbose. | ✓ |
| Always stream below | Dev server output always visible below claw status. | |
| Log to file | Output written to temp log file, path printed at startup. | |

**User's choice:** --verbose flag
**Notes:** None

### Subcommands

| Option | Description | Selected |
|--------|-------------|----------|
| Just `start` | Only `clawdesign start` for now. | |
| start + version + help | Add --version and --help for polished CLI feel. | ✓ |
| start + doctor | Add `clawdesign doctor` to check prerequisites. | |

**User's choice:** start + version + help
**Notes:** None

### Binary Name

| Option | Description | Selected |
|--------|-------------|----------|
| claw | Short, easy to type. | |
| clawdesign | Matches npm package name exactly. | ✓ |
| claw-design | Hyphenated like the package name. | |

**User's choice:** clawdesign
**Notes:** None

---

## Dev Server Detection

### Script Priority Order

| Option | Description | Selected |
|--------|-------------|----------|
| dev > start > serve | Most common dev server scripts in priority order. | ✓ |
| start > dev > serve | npm convention order. | |
| You decide | Claude picks based on ecosystem conventions. | |

**User's choice:** dev > start > serve
**Notes:** None

### No Script Found Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Error with suggestion | Print clear error, suggest --cmd flag. | ✓ |
| Interactive prompt | Ask user to type their dev server command. | |
| Try npm start anyway | Fall back to npm start regardless. | |

**User's choice:** Error with suggestion
**Notes:** Selected the preview mockup showing structured error output.

### Port Detection Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Parse stdout + fallback poll | Watch stdout for port patterns, poll common ports as fallback. | |
| Always poll ports | Just poll common ports, no stdout parsing. | |
| --port flag required | User must specify port if not 3000. | |

**User's choice:** Other -- Parse stdout for port patterns. If nothing detected, prompt user interactively to specify port. Also provide --port flag for convenience.
**Notes:** User wanted interactive prompt as fallback instead of polling, plus a --port flag.

---

## Claude Code Session Timing

### Session Spawn Timing

| Option | Description | Selected |
|--------|-------------|----------|
| Eager at startup | Spawn during startup sequence. Ready instantly on first use. | ✓ |
| Lazy on first selection | Spawn on first region selection. Faster startup, brief delay on first use. | |
| You decide | Claude picks based on tradeoffs. | |

**User's choice:** Eager at startup
**Notes:** None

### Communication Method

| Option | Description | Selected |
|--------|-------------|----------|
| Agent SDK | Use @anthropic-ai/claude-code SDK for structured API. | |
| CLI subprocess | Spawn `claude` CLI via child_process.spawn. | |
| Research both first | Let researcher investigate both approaches. | ✓ |

**User's choice:** Research both first
**Notes:** STATE.md leans toward Agent SDK but user wants both investigated before committing.

---

## Failure & Edge Cases

### Claude Code Not Installed

| Option | Description | Selected |
|--------|-------------|----------|
| Error with install link | Check PATH at startup, print error with installation URL if missing. | ✓ |
| Start without Claude | Launch dev server and Electron anyway, warn about missing Claude. | |
| You decide | Claude picks best UX. | |

**User's choice:** Error with install link
**Notes:** Selected preview showing structured error with install URL.

### Dev Server Crash

| Option | Description | Selected |
|--------|-------------|----------|
| Notify and wait | Show terminal message, keep Electron open. User re-runs manually. | ✓ |
| Auto-restart | Automatically restart dev server, max 3 retries. | |
| Shut everything down | Kill all processes and exit on dev server death. | |

**User's choice:** Notify and wait
**Notes:** None

### Port Already in Use

| Option | Description | Selected |
|--------|-------------|----------|
| Error with process info | Show PID, process name, suggest kill or --port. | ✓ |
| Auto-pick next port | Try next available port automatically. | |
| You decide | Claude picks best approach. | |

**User's choice:** Error with process info
**Notes:** Selected preview showing PID-based error with suggestions.

### Startup Timeout

| Option | Description | Selected |
|--------|-------------|----------|
| 30 seconds | Covers most dev servers including slow cold starts. | ✓ |
| 60 seconds | Extra generous for large monorepo projects. | |
| You decide | Claude picks sensible default. | |

**User's choice:** 30 seconds
**Notes:** None

---

## Claude's Discretion

- Terminal color scheme and exact spinner styles
- Exact stdout parsing patterns for port detection
- Internal process management implementation details

## Deferred Ideas

None -- discussion stayed within phase scope
