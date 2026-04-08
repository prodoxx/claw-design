---
phase: 05-polish-distribution
plan: 05
subsystem: distribution
tags: [npm, package-json, readme, license, electron, cli]

# Dependency graph
requires:
  - phase: 05-03
    provides: toast notifications and happy-dom dev dependency
provides:
  - npm-ready package.json with electron in dependencies
  - files whitelist for secure npm publishing
  - unified build script (CLI + Electron)
  - prepublishOnly hook for automatic builds
  - README.md with installation and usage docs
  - MIT LICENSE file
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - prepublishOnly hook ensures build before npm publish
    - files whitelist (dist/, out/, LICENSE) controls published content

key-files:
  created:
    - README.md
    - LICENSE
    - tests/cli/package.test.ts
  modified:
    - package.json
    - src/cli/commands/start.ts
    - tests/cli/start.test.ts

key-decisions:
  - "Removed runtime buildElectron() from start command -- pre-built output shipped in npm package"
  - "files whitelist limits published content to dist/, out/, LICENSE only"

patterns-established:
  - "Distribution pattern: pre-build via prepublishOnly, ship compiled output, no runtime compilation"

requirements-completed: [ELEC-03]

# Metrics
duration: 3min
completed: 2026-04-06
---

# Phase 05 Plan 05: npm Distribution Packaging Summary

**Package.json restructured for npm global install with electron in dependencies, files whitelist, unified build, README, and MIT LICENSE**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-06T12:01:34Z
- **Completed:** 2026-04-06T12:04:35Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Moved electron from devDependencies to dependencies so `npm install -g claw-design` pulls the Electron binary
- Added files whitelist (`dist/`, `out/`, `LICENSE`) to prevent source, tests, and planning docs from leaking to npm
- Unified build script (`tsc -p tsconfig.cli.json && electron-vite build`) compiles CLI and Electron in one command
- Removed runtime `buildElectron()` call from start command -- pre-built output included in package
- Added prepublishOnly hook to auto-build before `npm publish`
- Created README.md with installation, usage, CLI options, viewport switching, and framework support
- Created MIT LICENSE file

## Task Commits

Each task was committed atomically:

1. **Task 1: Restructure package.json, remove runtime build, unify build scripts** (TDD)
   - `e0a92f3` (test) - failing package.json structure tests
   - `52d1285` (feat) - implementation passing all tests
2. **Task 2: Create README.md and LICENSE files for distribution** - `38ec9c1` (docs)

## Files Created/Modified
- `package.json` - Moved electron to deps, added files/repo/keywords/author/prepublishOnly
- `src/cli/commands/start.ts` - Removed buildElectron() import and call, simplified Electron launch
- `tests/cli/start.test.ts` - Removed buildElectron mock (no longer called)
- `tests/cli/package.test.ts` - New test validating package.json structure (9 tests)
- `README.md` - User-facing documentation with install, usage, how-it-works
- `LICENSE` - MIT license text

## Decisions Made
- Removed runtime `buildElectron()` from start command -- pre-built output shipped via npm package. The `out/` directory is included in the `files` whitelist.
- Kept `buildElectron()` function in `src/cli/utils/electron.ts` (not deleted) since it may be useful for dev mode or future use.

## Deviations from Plan

None -- plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None -- no external service configuration required.

## Threat Mitigations Applied

- **T-05-09 (Information Disclosure):** `files` whitelist in package.json limits published content to `dist/`, `out/`, `LICENSE`. Source code, tests, planning docs, and config files are excluded.

## Next Phase Readiness
- Package is structurally ready for `npm publish`
- All 5 plans of Phase 05 complete

## Self-Check: PASSED

All 4 files verified present. All 3 commits verified in git log.

---
*Phase: 05-polish-distribution*
*Completed: 2026-04-06*
