# Phase 2: Electron Shell - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-03
**Phase:** 02-electron-shell
**Areas discussed:** Window chrome & sizing, Site navigation, Overlay layer design

---

## Window Chrome & Sizing

### Frame Style

| Option | Description | Selected |
|--------|-------------|----------|
| Standard OS frame | Native title bar with traffic lights (macOS) / window controls (Windows). Familiar, zero custom code. | ✓ |
| Frameless with custom titlebar | No native chrome. Custom-drawn title bar. Sleeker but more code and platform quirks. | |
| Minimal frame (titleBarStyle: hidden) | Native traffic lights inset into content, no visible title bar. macOS-native pattern. | |

**User's choice:** Standard OS frame
**Notes:** None

### Default Window Size

| Option | Description | Selected |
|--------|-------------|----------|
| 1280x800 | Common laptop viewport. Fits on 13" MacBook. | ✓ |
| 80% of screen | Percentage-based, scales to display. | |
| Maximized | Full screen (not fullscreen mode). | |

**User's choice:** 1280x800
**Notes:** None

### Window Title

| Option | Description | Selected |
|--------|-------------|----------|
| "claw — localhost:PORT" | Short product name + URL. | |
| "claw-design" | Just the product name. | |
| "claw — PROJECT_NAME" | Product name + package.json name. | |

**User's choice:** Custom — "claw-design — PROJECT_NAME — localhost:PORT"
**Notes:** User wanted all three identifiers combined.

### Resizability

| Option | Description | Selected |
|--------|-------------|----------|
| Freely resizable | Standard behavior. Phase 5 adds viewport presets later. | ✓ |
| Resizable with minimum size | Free resize but enforce a floor (e.g., 800x600). | |

**User's choice:** Freely resizable
**Notes:** None

---

## Site Navigation

### In-Site Link Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Allow all navigation | User clicks links freely. SPA and multi-page both work. | ✓ |
| Allow, restrict to localhost | Navigation within localhost free, external blocked/redirected. | |
| Lock to initial URL | Window stays on original URL. All clicks intercepted. | |

**User's choice:** Allow all navigation
**Notes:** None

### External URLs

| Option | Description | Selected |
|--------|-------------|----------|
| Open in default browser | External URLs open in system browser. Standard Electron pattern. | ✓ |
| Block external navigation | External links do nothing. | |
| You decide | Claude picks. | |

**User's choice:** Open in default browser
**Notes:** None

### DevTools Access

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, via keyboard shortcut | Cmd+Opt+I / F12 opens DevTools. | ✓ |
| Hidden by default, --devtools flag | Disabled unless flag passed. | |
| You decide | Claude picks. | |

**User's choice:** Yes, via keyboard shortcut
**Notes:** None

### Browser-Like Navigation

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, standard shortcuts | Cmd+R refresh, Cmd+[/] back/forward. | ✓ |
| Refresh only | Cmd+R only, no back/forward. | |
| You decide | Claude picks. | |

**User's choice:** Yes, standard shortcuts
**Notes:** None

---

## Overlay Layer Design

### Overlay Architecture

| Option | Description | Selected |
|--------|-------------|----------|
| Two WebContentsViews | BaseWindow with stacked views: site (bottom) + overlay (top). Clean isolation. | ✓ |
| Single view + injected overlay | One view, overlay injected via executeJavaScript. Simpler but CSS conflict risk. | |
| You decide | Researcher evaluates. | |

**User's choice:** Two WebContentsViews
**Notes:** None

### Mouse Event Passthrough

| Option | Description | Selected |
|--------|-------------|----------|
| Full passthrough | Overlay transparent to mouse when inactive. Site interacts normally. | ✓ |
| Always capture, relay to site | Overlay intercepts and relays events programmatically. | |

**User's choice:** Full passthrough
**Notes:** None

### Overlay HTML Source

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal HTML page | Loads overlay.html from src/renderer/ with own CSS/JS entry point. | ✓ |
| Empty transparent document | Loads about:blank, Phase 3 injects everything. | |
| You decide | Claude picks. | |

**User's choice:** Minimal HTML page
**Notes:** None

### Compositing Fallback

| Option | Description | Selected |
|--------|-------------|----------|
| Fall back to injected overlay | If two-view compositing fails, switch to injection approach. | ✓ |
| Investigate workarounds first | Exhaustively try workarounds before falling back. | |
| You decide | Researcher picks. | |

**User's choice:** Fall back to injected overlay
**Notes:** None

### Overlay Indicator

| Option | Description | Selected |
|--------|-------------|----------|
| No indicator | Clean viewport, invisible overlay. | |
| Subtle corner badge | Small icon/dot in corner. | |
| You decide | Claude picks. | |

**User's choice:** Custom — Small indicator in bottom-right corner, plus activation button for selection mode
**Notes:** User wants a visible indicator that Claw is active, AND a button to activate selection mode. Bottom-right placement chosen to avoid interfering with site content.

### Indicator Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Bottom-right | Avoids nav bars, sidebars. Common for FABs. | ✓ |
| Top-right | Visible but may overlap site navigation. | |
| Bottom-left | Less common, avoids chat widgets. | |

**User's choice:** Bottom-right
**Notes:** None

---

## Claude's Discretion

- Exact indicator visual design (icon, size, opacity)
- Electron security configuration details (CSP, sandbox flags)
- IPC channel naming and preload script API surface
- How the CLI spawns the Electron process

## Deferred Ideas

None — discussion stayed within phase scope
