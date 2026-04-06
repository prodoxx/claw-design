# Phase 5: Polish & Distribution - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-06
**Phase:** 05-polish-distribution
**Areas discussed:** Viewport controls, Error UX polish, npm packaging, Pre-release polish

---

## Viewport Controls

| Option | Description | Selected |
|--------|-------------|----------|
| In the overlay toolbar | Extend existing vertical toolbar with viewport icons | ✓ |
| Separate top bar | Horizontal bar at top with presets + dimensions | |
| Keyboard-only | No visible UI, Cmd+1/2/3 shortcuts | |

**User's choice:** In the overlay toolbar
**Notes:** Keeps all controls in one place. Toolbar extends with a visual separator.

| Option | Description | Selected |
|--------|-------------|----------|
| Resize the site view only | Window stays full, site constrained with gray bars | ✓ |
| Resize the whole window | Electron window resizes to preset dimensions | |
| You decide | Claude picks | |

**User's choice:** Resize site view only (Chrome DevTools style)

| Option | Description | Selected |
|--------|-------------|----------|
| Three basics | Desktop 1280×800, Tablet 768×1024, Mobile 375×812 | ✓ |
| Five common devices | More granular with laptop and large mobile sizes | |
| Three basics + custom | Presets plus custom input | |

**User's choice:** Three basics

| Option | Description | Selected |
|--------|-------------|----------|
| Highlight active icon | Brighter/accent color on active viewport button | ✓ |
| Highlight + size label | Active icon + dimensions label | |
| You decide | Claude picks | |

**User's choice:** Highlight active icon

---

## Error UX Polish

| Option | Description | Selected |
|--------|-------------|----------|
| CLI terminal only | All errors in terminal | |
| Both CLI + in-window | Startup in terminal, runtime also in overlay | ✓ |
| In-window primarily | Most errors in Electron window | |

**User's choice:** Both CLI + in-window

| Option | Description | Selected |
|--------|-------------|----------|
| Structured | Title + message + suggestion | |
| Conversational | Friendly, approachable messages | |
| You decide | Claude picks | ✓ |

**User's choice:** Claude's discretion

| Option | Description | Selected |
|--------|-------------|----------|
| Toast notification | Auto-dismissing, non-blocking | |
| Persistent banner | Stays until dismissed | |
| Toast + persistent for critical | Auto-dismiss for non-critical, persistent for critical | ✓ |

**User's choice:** Toast + persistent for critical

| Scenario | Priority | Selected |
|----------|----------|----------|
| Dev server crash mid-session | Needs in-window notification | ✓ |
| Claude Code not installed | Startup check | |
| Network/port errors | Basic printError | |
| Electron window errors | Site load failures | |

**User's choice:** Dev server crash is the priority scenario

| Option | Description | Selected |
|--------|-------------|----------|
| Dark overlay aesthetic | Same dark bg, white text, red/orange accent | ✓ |
| Distinct alert colors | Yellow/red backgrounds | |
| You decide | Claude picks by severity | |

**User's choice:** Dark overlay aesthetic

---

## npm Packaging

| Option | Description | Selected |
|--------|-------------|----------|
| Regular dependency | electron in dependencies, auto-downloads | ✓ |
| Peer dependency | Users install electron separately | |
| You decide | Claude picks | |

**User's choice:** Regular dependency

| Option | Description | Selected |
|--------|-------------|----------|
| Full OSS metadata | files, repository, keywords, homepage, author | ✓ |
| Minimal viable | Just files field | |
| You decide | Claude picks | |

**User's choice:** Full OSS metadata

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, basic checks | Electron, Claude Code, Node version | ✓ |
| No pre-flight | Let errors surface naturally | |
| You decide | Claude picks | |

**User's choice:** Yes, basic pre-flight checks

| Option | Description | Selected |
|--------|-------------|----------|
| Full README | Install, usage, how it works, requirements | ✓ |
| Minimal README | Just install + usage | |
| You decide | Claude picks | |

**User's choice:** Full README

| Option | Description | Selected |
|--------|-------------|----------|
| MIT | Most permissive | ✓ |
| Apache 2.0 | Permissive with patent protection | |
| You decide | Claude picks | |

**User's choice:** MIT

| Option | Description | Selected |
|--------|-------------|----------|
| Just version number | "0.1.0" | ✓ |
| Version + runtime info | Version + Node + Electron versions | |
| You decide | Claude picks | |

**User's choice:** Just version number

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, unified build | npm run build does all, prepublishOnly | ✓ |
| Keep separate scripts | Manual multi-step build | |
| You decide | Claude picks | |

**User's choice:** Unified build with prepublishOnly

| Option | Description | Selected |
|--------|-------------|----------|
| Unscoped: claw-design | Published as claw-design | ✓ |
| Scoped: @nebula-core/claw-design | Under org namespace | |
| You decide | Claude picks | |

**User's choice:** Unscoped claw-design

| Option | Description | Selected |
|--------|-------------|----------|
| No, pre-flight enough | Startup checks are sufficient | ✓ |
| Yes, add doctor | Separate diagnostic command | |
| You decide | Claude picks | |

**User's choice:** No doctor command

---

## Pre-release Polish

| Feature | Priority | Selected |
|---------|----------|----------|
| Visual consistency audit | All UI surfaces consistent | ✓ |
| Keyboard shortcuts | Additional shortcuts | |
| Loading/startup polish | Splash screen, transitions | ✓ |
| E2E test coverage | Playwright tests | |

**User's priorities:** Visual consistency audit + Loading/startup polish

| Option | Description | Selected |
|--------|-------------|----------|
| Branded splash screen | claw-design name + loading indicator | ✓ |
| Simple spinner | Centered spinner, no branding | |
| Blank then site | No loading indicator | |
| You decide | Claude picks | |

**User's choice:** Branded splash screen

| Option | Description | Selected |
|--------|-------------|----------|
| Claude's discretion | Audit all surfaces, fix inconsistencies | ✓ |
| Focus on transitions | Polish animations specifically | |
| Focus on dark theme | Ensure exact color/opacity consistency | |

**User's choice:** Claude's discretion for visual audit

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, simple tooltips | Hover labels on toolbar icons | ✓ |
| No tooltips | Keep toolbar clean | |
| You decide | Claude picks | |

**User's choice:** Simple tooltips

| Option | Description | Selected |
|--------|-------------|----------|
| No onboarding | Users are developers, they'll explore | ✓ |
| Brief tooltip tour | 2-3 tooltips on first launch | |
| You decide | Claude picks | |

**User's choice:** No onboarding

| Option | Description | Selected |
|--------|-------------|----------|
| Smooth resize animation | 200-300ms ease transition | ✓ |
| Instant snap | Immediate resize | |
| You decide | Claude picks | |

**User's choice:** Smooth resize animation

| Option | Description | Selected |
|--------|-------------|----------|
| Dark background | Matches dark overlay aesthetic | ✓ |
| Light/neutral gray | Like Chrome DevTools | |
| You decide | Claude picks | |

**User's choice:** Dark background surrounding constrained site view

---

## Claude's Discretion

- Error message style (structured vs conversational)
- Visual consistency audit scope and fixes
- Animation timing details
- Splash screen design
- Tooltip implementation
- Toast notification positioning and timing
- README content depth

## Deferred Ideas

None — discussion stayed within phase scope
