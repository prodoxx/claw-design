# Phase 3: Selection Overlay & Capture - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-04
**Phase:** 03-selection-overlay-capture
**Areas discussed:** Selection modes & switching, Selection drawing feel, Instruction input UX, Iterative refinement

---

## Selection Modes & Switching

### Default Mode
| Option | Description | Selected |
|--------|-------------|----------|
| Rectangle first | Click select -> crosshair -> draw a box. Element click is secondary. | ✓ |
| Element click first | Click select -> elements highlight on hover -> click to select. | |
| Unified mode | One mode auto-detects: click = element, drag = rectangle. | |

**User's choice:** Rectangle first
**Notes:** Matches core value prop of "point at an area."

### Mode Switching
| Option | Description | Selected |
|--------|-------------|----------|
| Hold modifier key | Hold Alt/Option to switch to element hover+click. | |
| Toggle in toolbar | Second button in toolbar to switch modes. Persistent. | ✓ |
| You decide | Claude picks based on constraints. | |

**User's choice:** Toggle in toolbar
**Notes:** None

### Cancel Selection
| Option | Description | Selected |
|--------|-------------|----------|
| Escape key | Press Escape to cancel and return to inactive. | |
| Click toolbar button again | Toggle off with same button. | |
| Both Escape + toolbar | Either Escape or toolbar button cancels. | ✓ |

**User's choice:** Both Escape + toolbar
**Notes:** None

### Hover Scope
| Option | Description | Selected |
|--------|-------------|----------|
| Top-level only | elementsFromPoint on main document. Simpler, covers 90%+. | ✓ |
| Include shadow DOM | Traverse into shadow roots for web components. | |
| You decide | Claude decides based on two-view architecture. | |

**User's choice:** Top-level only
**Notes:** None

---

## Selection Drawing Feel

### Rectangle Style
| Option | Description | Selected |
|--------|-------------|----------|
| Dashed border + tinted fill | 2px dashed blue border with semi-transparent fill. | |
| Solid border only | Clean 2px solid border, no fill tint. | |
| Marching ants | Animated dashed border, no fill. | |
| You decide | Claude picks professional style. | |

**User's choice:** Other — Rounded border with tint overlay (Gemini reference)
**Notes:** User provided screenshot of Gemini's inline selection UI showing rounded rectangle border with semi-transparent tint. This is the target visual feel, not a standard OS-style selection.

### Color Scheme
| Option | Description | Selected |
|--------|-------------|----------|
| Blue | Blue border + blue tint. Universal selection color. | |
| Match toolbar dark | Dark/white scheme matching toolbar aesthetic. | |
| You decide | Claude picks colors with good contrast. | |

**User's choice:** Other — Match the Gemini reference style (light/subtle rounded border with tint)
**Notes:** User provided reference image showing light blue/white subtle border with semi-transparent fill. Not a hard blue OS-style selection.

### Element Hover Highlight
| Option | Description | Selected |
|--------|-------------|----------|
| Same style | Rounded border + tint, matching rectangle selection. | ✓ |
| Outline only | Just a border, no fill tint. | |
| You decide | Claude picks for hover vs committed selection. | |

**User's choice:** Same style
**Notes:** Consistent visual language across both modes.

---

## Instruction Input UX

### Input Placement
| Option | Description | Selected |
|--------|-------------|----------|
| Below selection | Dark input bar below the selected region. | |
| Fixed bottom bar | Docked to bottom of window. | |
| Above or below (smart) | Below if room, above if selection is near bottom. | ✓ |

**User's choice:** Above or below (smart)
**Notes:** None

### Multi-line Handling
| Option | Description | Selected |
|--------|-------------|----------|
| Auto-expand | Single-line, grows as user types (up to max). | ✓ |
| Fixed textarea | Always shows 3-4 row textarea. | |
| You decide | Claude picks for inline placement. | |

**User's choice:** Auto-expand
**Notes:** None

### Submit Method
| Option | Description | Selected |
|--------|-------------|----------|
| Enter to submit | Enter sends, Shift+Enter for new line. | ✓ |
| Submit button only | Enter creates lines, explicit button required. | |
| Both | Enter submits + visible submit button. | |

**User's choice:** Enter to submit
**Notes:** Standard chat/prompt convention.

### Input Style
| Option | Description | Selected |
|--------|-------------|----------|
| Dark bar | Dark background ~88% opacity, white text, rounded. | ✓ |
| Light/neutral bar | Light background, dark text. | |
| You decide | Claude picks matching toolbar aesthetic. | |

**User's choice:** Dark bar
**Notes:** Matches existing toolbar and Gemini reference.

---

## Iterative Refinement

### After Submit
| Option | Description | Selected |
|--------|-------------|----------|
| Clear and reset | Selection/input disappear. Overlay returns to inactive. | ✓ |
| Keep selection active | Selection stays, input clears. | |
| Keep with history | Selection stays, previous instruction shown as chip. | |

**User's choice:** Clear and reset
**Notes:** Clean slate each time.

### Selection Memory
| Option | Description | Selected |
|--------|-------------|----------|
| No memory | Each selection independent. No history/ghosts. | ✓ |
| Visual ghost of last | Faded outline of previous selection remains. | |
| You decide | Claude decides on complexity vs UX value. | |

**User's choice:** No memory
**Notes:** Claude Code's conversation context provides continuity.

### During Claude Processing
| Option | Description | Selected |
|--------|-------------|----------|
| Blocked with status | Selection disabled while Claude works. | |
| Allow queuing | User can make new selections while Claude works. | |
| You decide | Claude picks simplest for v1. | |

**User's choice:** Other — Allow concurrent edits via Claude subagents
**Notes:** User wants multiple edits simultaneously. Each instruction spawns a subagent. Need task progress UI (deferred to Phase 4). After submit, immediately reset so user can select again.

---

## Claude's Discretion

- Exact border color/opacity values for selection rectangle and hover highlight
- Crosshair cursor implementation approach
- Smart input bar positioning algorithm
- DOM extraction depth and serialization format
- DPI-aware screenshot coordinate calculation
- Element hover detection across the two-view boundary

## Deferred Ideas

- Task progress UI for concurrent in-flight edits (Phase 4)
- Claude subagent orchestration for parallel edits (Phase 4)
