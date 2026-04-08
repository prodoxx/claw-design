# Phase 7: Open Source Readiness - Context

**Gathered:** 2026-04-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Prepare claw-design for public release under the prodoxx GitHub account with proper branding, ownership, and community files. All user-facing CLI strings are rebranded, package metadata points to the correct repo, and standard open source community files are in place.

</domain>

<decisions>
## Implementation Decisions

### Branding & CLI strings
- **D-01:** The tool refers to itself as "Claw Design" (full name) in all user-facing CLI output and the Electron window title
- **D-02:** All spinner/status messages are fully branded — e.g. "Starting Claw Design...", "Claw Design ready" instead of "Opening Electron window..."
- **D-03:** Window title format: `Claw Design — {project-name}` (e.g. "Claw Design — my-app")
- **D-04:** Every user-facing "Electron" reference is scrubbed — error messages use "browser component" or similar, never expose "Electron" to the user
- **D-05:** Version output keeps the CLI command name: `clawdesign v0.1.0` (not "Claw Design v0.1.0")
- **D-06:** Internal code (variable names, file names, comments like `spawnElectron`, `electron.ts`) stays as-is — only user-facing strings change
- **D-07:** Package.json description is updated by Claude for a more compelling npm search presence

### README polish
- **D-08:** Launch-ready README with hero section, badges, compelling intro, demo GIF placeholder, and polished sections
- **D-09:** Standard badge set: npm version, license, node version required
- **D-10:** Demo GIF placeholder — an HTML comment or image tag pointing to a future demo.gif
- **D-11:** Developer-direct tone — concise, no-nonsense, like Vite or esbuild READMEs
- **D-12:** Include a brief "Why Claw Design?" section (2-3 sentences on the problem it solves)
- **D-13:** No specific reference project to match — just clean and professional

### Contributing & community
- **D-14:** Standard CONTRIBUTING.md — dev environment setup, PR process, code style expectations, issue reporting guidelines
- **D-15:** Contributor Covenant v2.1 as CODE_OF_CONDUCT.md
- **D-16:** GitHub issue templates: bug report + feature request in `.github/ISSUE_TEMPLATE/`
- **D-17:** Conventional Commits convention (feat:, fix:, docs:, etc.) documented in CONTRIBUTING.md
- **D-18:** PR template at `.github/PULL_REQUEST_TEMPLATE.md` with description, testing, screenshots checklist

### Ownership & repo transfer
- **D-19:** GitHub owner is `prodoxx` — all URLs point to `github.com/prodoxx/claw-design`
- **D-20:** LICENSE copyright holder: `prodoxx` (matches repo owner)
- **D-21:** package.json `author` field includes name + URL: `{ name: "prodoxx", url: "https://github.com/prodoxx" }`
- **D-22:** npm package remains unscoped: `claw-design` (no @prodoxx scope)
- **D-23:** package.json `repository` and `homepage` updated to `prodoxx/claw-design`

### Claude's Discretion
- Exact wording of updated package.json description (D-07)
- Specific badge markdown syntax and shield.io URLs
- README section ordering and exact content structure
- CONTRIBUTING.md level of technical detail for dev setup
- Issue template field specifics
- PR template checklist items

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external specs — requirements fully captured in decisions above. The phase scope comes directly from ROADMAP.md success criteria.

### Key files to modify
- `package.json` — repository, homepage, author, description fields
- `LICENSE` — copyright holder
- `README.md` — full rewrite for launch
- `src/cli/commands/start.ts` — spinner text, error messages (Electron → Claw Design)
- `src/cli/utils/output.ts` — version banner

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/cli/utils/output.ts`: `printBanner()` function — currently shows `clawdesign v${version}`
- `ora` spinners throughout `src/cli/commands/start.ts` — each has text to rebrand

### Established Patterns
- CLI uses `picocolors` for terminal formatting (pc.bold, pc.dim, pc.cyan)
- Spinner pattern: `createSpinner('text').succeed('result')` via ora
- Error output via `printError(title, message, hint?)` utility

### Integration Points
- `src/cli/commands/start.ts:205-207` — "Opening Electron window..." / "Electron window opened" spinners
- `src/cli/commands/start.ts:36-38` — "Electron not found" error message
- `src/cli/commands/start.ts:225` — "Electron window closed." exit message
- `src/main/index.ts` — Electron app title (BrowserWindow title property)

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches within the decisions above.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 07-open-source-readiness*
*Context gathered: 2026-04-08*
