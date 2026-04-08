# Milestones

## v1.0 MVP (Shipped: 2026-04-08)

**Phases completed:** 7 phases, 21 plans, 44 tasks

**Key accomplishments:**

- Commander-based CLI entry point with dev server auto-detection (dev>start>serve priority), spawning with shell:true, and 7 passing unit tests
- Framework-agnostic port detection with TCP polling, Agent SDK streaming session management, and idempotent tree-kill shutdown -- 33 tests passing
- Complete 7-step startup sequence wiring dev server detection, port readiness, Claude Code session, and shutdown coordination with spinner progress and 47 total tests passing
- Transparent overlay renderer with bottom-right indicator and typed contextBridge IPC API via multi-entry electron-vite config
- BaseWindow with dual WebContentsViews (secure site + transparent overlay), navigation restriction to localhost, and IPC overlay activation scaffold
- CLI spawns electron-vite build then Electron binary with localhost URL, toolbar redesigned as vertical pill with drag handle and selection button
- Pure state machine with 7 selection modes, rectangle drawing, element hover/click detection via cross-view IPC, and accent-blue visual styles per UI spec
- DPI-aware screenshot capture and DOM extraction modules with IPC handlers -- PNG buffer via capturePage and structured JSON via executeJavaScript IIFE injection
- Smart-positioned instruction input bar with parallel capture+DOM submit flow, verified end-to-end with preload CJS fix
- Prompt assembler encodes screenshot/DOM/instruction into Agent SDK content blocks; AgentManager orchestrates max-3 parallel Claude agents with full task lifecycle tracking
- Complete sidebar WebContentsView renderer with dark chrome task panel, status badges, badge pulse animations, accessible HTML shell, and pure state machine with 18 tests
- Full submit-to-sidebar pipeline with floating overlay sidebar, live activity streaming, and expandable log viewer
- RED:
- Node >= 20 and Electron binary pre-flight checks at CLI startup, plus working --version flag via Commander
- Toast notification system with severity-based styling, 5s auto-dismiss, persistent banners, and dev server crash detection wired to in-window error display
- Toolbar tooltips with 400ms hover delay positioned left of buttons, and branded splash screen with CSS spinner during site load
- Package.json restructured for npm global install with electron in dependencies, files whitelist, unified build, README, and MIT LICENSE
- Rewired sidebar retry to prefill overlay textarea with original instruction and activate selection mode instead of silently auto-resubmitting
- Removed 4 dead code items: buildElectron function, CLAW_CWD env var, preload/index.ts stub, renderer/index.html placeholder
- Rebranded all user-facing CLI strings from "Electron" to "Claw Design", updated package.json ownership to prodoxx/claw-design, and updated LICENSE copyright
- Launch-ready README with badges and quick start, plus CONTRIBUTING, CODE_OF_CONDUCT, and GitHub issue/PR templates

---
