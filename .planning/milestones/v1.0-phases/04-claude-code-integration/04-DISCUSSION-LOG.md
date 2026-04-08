# Phase 4: Claude Code Integration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-04
**Phase:** 04-claude-code-integration
**Areas discussed:** Status feedback UX, Concurrent edit model, Error & retry UX

---

## Status Feedback UX

### Where should status feedback appear?

| Option | Description | Selected |
|--------|-------------|----------|
| Task list panel | Small panel showing all in-flight edits with status badges. Scales to concurrent edits. | |
| Inline near selection | Floating badge near where selection was drawn. Simpler but harder to track multiple edits. | |
| Toast notifications | Brief toast popups in a corner for state changes. Minimal but easy to miss. | |
| Right sidebar | Vertical panel on the right with room for instruction text and detailed status. | ✓ |

**User's choice:** Task list panel initially, then clarified as right sidebar.
**Notes:** User chose right sidebar over bottom bar for more room.

### Sidebar visibility behavior

**User's choice:** Custom (described in free text)
**Notes:** Sidebar should be partially hidden by default showing only a small icon on the right side. Only appears after first submit. It's an overlay (doesn't reduce site width). Minimized state shows compact badge like "3/5 tasks done" partially visible on the right edge. Animated collapse — when minimizing, it slides back to the initial icon position.

### Sidebar rendering layer

**User's choice:** NOT part of the overlay WebContentsView
**Notes:** User identified that the overlay bounds toggle (shrink to 48x48 when inactive) would hide the sidebar along with it. Sidebar must persist across overlay state changes. Claude decides the rendering approach.

### Status states per task

| Option | Description | Selected |
|--------|-------------|----------|
| Simple 3-state | Sending -> Editing -> Done. Errors replace any state. | ✓ |
| Detailed 4-state | Capturing -> Sending -> Editing -> Done. Includes capture step. | |
| You decide | Claude picks the granularity. | |

**User's choice:** Simple 3-state

### Task cleanup behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Fade out after delay | Completed tasks fade out after ~5s. Errors persist until dismissed. | |
| Persist until dismissed | All tasks stay. User manually clears them. | ✓ |
| You decide | Claude picks. | |

**User's choice:** Persist until dismissed

### Panel visual style

| Option | Description | Selected |
|--------|-------------|----------|
| Match dark overlay | Same rgba(10,10,10,0.88) background, white text, rounded corners. | ✓ |
| Light/glass style | Frosted glass or light translucent background. Visually distinct. | |

**User's choice:** Match dark overlay

### Auto-expand on new task submission

| Option | Description | Selected |
|--------|-------------|----------|
| Stay minimized, counter updates | Badge counter increments, sidebar stays collapsed. | |
| Auto-expand briefly on new task | Sidebar slides out ~2s when submitted, then auto-minimizes. | ✓ |
| You decide | Claude picks. | |

**User's choice:** Auto-expand briefly on new task

### Badge notification on completion

| Option | Description | Selected |
|--------|-------------|----------|
| Pulse animation on change | Brief pulse/glow on badge when task completes or errors. | ✓ |
| Counter update only | Number changes silently. | |
| You decide | Claude picks. | |

**User's choice:** Pulse animation on change

### Task row content

| Option | Description | Selected |
|--------|-------------|----------|
| Text + status only | Instruction text (truncated) and status badge. Compact. | ✓ |
| Thumbnail + text + status | Small screenshot thumbnail next to each task. | |

**User's choice:** Text + status only

### Auto-minimize during selection

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-minimize during selection | Collapses when user enters selection mode. Re-expands after submit. | ✓ |
| Stay expanded | Stays open during selection. | |
| You decide | Claude picks. | |

**User's choice:** Auto-minimize during selection

### Icon position

| Option | Description | Selected |
|--------|-------------|----------|
| Middle-right | Vertically centered on the right edge. | ✓ |
| Top-right | Near window controls. | |
| Bottom-right | Near existing Claw indicator. | |

**User's choice:** Middle-right

---

## Concurrent Edit Model

### How should multiple in-flight instructions be handled?

**User's choice:** Custom (described in free text)
**Notes:** User wants parallel execution by default — no queuing unless there's a dependency between tasks. Referenced that Claude may have a "team" or inter-agent communication feature in the SDK. Key principle: independent edits run in parallel, dependent edits queue. Queuing only makes sense when a task depends on the completion of another.

### Dependency detection

| Option | Description | Selected |
|--------|-------------|----------|
| Claude infers from instruction text | Detects references to prior edits and queues accordingly. | ✓ |
| Always parallel, user manages | Every instruction spawns immediately. User handles conflicts. | |
| You decide | Researcher figures out best approach. | |

**User's choice:** Claude infers from instruction text

### Max parallel agents

| Option | Description | Selected |
|--------|-------------|----------|
| Cap at 3-4 parallel agents | Reasonable limit. Additional instructions queue. | ✓ |
| Unlimited | Every independent instruction gets its own agent. | |
| You decide | Researcher determines limit. | |

**User's choice:** Cap at 3-4 parallel agents

### Context sharing between agents

| Option | Description | Selected |
|--------|-------------|----------|
| Share initial context only | Each agent gets system prompt + summary of other in-flight instructions. | |
| Fully independent | Each agent knows nothing about others. | |
| You decide | Researcher investigates SDK capabilities. | ✓ |

**User's choice:** You decide (Claude's discretion based on SDK research)

---

## Error & Retry UX

### Error display

| Option | Description | Selected |
|--------|-------------|----------|
| Inline in sidebar task | Task row shows error state, message, retry/dismiss buttons. | ✓ |
| Toast notification + sidebar | Toast pops up immediately, task also shows error in sidebar. | |
| You decide | Claude picks. | |

**User's choice:** Inline in sidebar task

### Error notification when minimized

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-expand on error | Sidebar slides out to show error with retry/dismiss. | |
| Pulse badge, stay minimized | Badge pulses with error color. User opens when ready. | ✓ |
| You decide | Claude picks. | |

**User's choice:** Pulse badge, stay minimized

### Retry behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Resend same instruction immediately | One click, same data sent again. | |
| Prefill instruction for editing | Opens instruction input prefilled. Submit sends fresh capture. | ✓ |
| You decide | Claude picks. | |

**User's choice:** Prefill instruction for editing (fresh screenshot + DOM on resubmit)

---

## Claude's Discretion

- Prompt assembly format
- Sidebar rendering architecture (must persist across overlay state changes)
- Agent SDK configuration for parallel agents
- Dependency detection implementation
- Animation timing and easing
- Context sharing strategy between parallel agents
- Sidebar width when expanded
- "Queued" state display in sidebar

## Deferred Ideas

None — discussion stayed within phase scope
