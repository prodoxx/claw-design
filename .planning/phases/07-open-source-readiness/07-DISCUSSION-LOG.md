# Phase 7: Open Source Readiness - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-08
**Phase:** 07-open-source-readiness
**Areas discussed:** Branding & CLI strings, README polish, Contributing & community, Ownership & repo transfer

---

## Branding & CLI strings

| Option | Description | Selected |
|--------|-------------|----------|
| Claw Design | Full name everywhere | ✓ |
| Claw | Short form | |
| clawdesign (lowercase) | Match CLI command name | |

**User's choice:** Claw Design
**Notes:** Full name used in all user-facing output and window title.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Neutral technical | No brand in spinners | |
| Lightly branded | Brand only where replacing Electron | |
| Fully branded | Brand name in all major status messages | ✓ |

**User's choice:** Fully branded
**Notes:** All spinners and status messages use "Claw Design".

---

| Option | Description | Selected |
|--------|-------------|----------|
| Claw — {project-name} | Short brand + project | |
| Claw Design — {project-name} | Full brand + project | ✓ |
| {project-name} (Claw) | Project-first | |
| You decide | Claude's discretion | |

**User's choice:** Claw Design — {project-name}

---

| Option | Description | Selected |
|--------|-------------|----------|
| Scrub all user-facing | Replace every Electron ref users see | ✓ |
| Keep technical refs | Keep in error diagnostics | |
| You decide | Claude picks | |

**User's choice:** Scrub all user-facing
**Notes:** No Electron references visible to users anywhere.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Claw Design v0.1.0 | Full brand in version | |
| clawdesign v0.1.0 | Match CLI command | ✓ |
| You decide | Claude's discretion | |

**User's choice:** clawdesign v0.1.0

---

| Option | Description | Selected |
|--------|-------------|----------|
| User-facing only | Only change strings users see | ✓ |
| Rename internal too | Full rebrand of code | |
| You decide | Claude picks | |

**User's choice:** User-facing only
**Notes:** Internal code (variables, file names, comments) stays as-is.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Keep current | Current description | |
| Update for launch | Claude writes new description | ✓ |
| I'll provide copy | User writes it | |

**User's choice:** Update for launch (Claude writes)

---

## README polish

| Option | Description | Selected |
|--------|-------------|----------|
| Launch-ready | Hero, badges, GIF placeholder, polished sections | ✓ |
| Minimal cleanup | Fix wording, keep structure | |
| Full marketing page | Detailed features, architecture, FAQ | |

**User's choice:** Launch-ready

---

| Option | Description | Selected |
|--------|-------------|----------|
| GIF placeholder | Image tag for future demo | ✓ |
| No visual | Text-only | |
| You decide | Claude's discretion | |

**User's choice:** GIF placeholder

---

| Option | Description | Selected |
|--------|-------------|----------|
| Standard set | npm version, license, node version | ✓ |
| Extended | npm, license, node, downloads, stars, CI | |
| None | No badges | |
| You decide | Claude picks | |

**User's choice:** Standard set

---

| Option | Description | Selected |
|--------|-------------|----------|
| Developer-direct | Concise, no-nonsense | ✓ |
| Friendly & inviting | Warm, approachable | |
| You decide | Claude picks | |

**User's choice:** Developer-direct

---

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, brief | 2-3 sentences on the problem | ✓ |
| No | How It Works is sufficient | |
| You decide | Claude decides | |

**User's choice:** Yes, brief

---

| Option | Description | Selected |
|--------|-------------|----------|
| No specific reference | Clean and professional | ✓ |
| I have references | Match a specific project | |
| Include troubleshooting | Add FAQ section | |

**User's choice:** No specific reference

---

## Contributing & community

| Option | Description | Selected |
|--------|-------------|----------|
| Standard | Dev setup, PR process, code style, issue guidelines | ✓ |
| Minimal | Fork, branch, PR basics | |
| Comprehensive | Full open source playbook | |

**User's choice:** Standard

---

| Option | Description | Selected |
|--------|-------------|----------|
| Contributor Covenant v2.1 | Industry standard | ✓ |
| You decide | Claude picks | |
| Custom | User-specified | |

**User's choice:** Contributor Covenant v2.1

---

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, basic set | Bug report + feature request | ✓ |
| No templates | Blank issues only | |
| You decide | Claude's discretion | |

**User's choice:** Yes, basic set

---

| Option | Description | Selected |
|--------|-------------|----------|
| Conventional Commits | feat:, fix:, docs:, etc. | ✓ |
| No convention | Natural commit messages | |
| You decide | Claude picks | |

**User's choice:** Conventional Commits

---

| Option | Description | Selected |
|--------|-------------|----------|
| Yes | PR template with checklist | ✓ |
| No | No template | |
| You decide | Claude's discretion | |

**User's choice:** Yes

---

## Ownership & repo transfer

| Option | Description | Selected |
|--------|-------------|----------|
| prodoxx | Personal GitHub | ✓ |
| nebula-core-org | Keep current org | |
| Different org/user | User specifies | |

**User's choice:** prodoxx

---

| Option | Description | Selected |
|--------|-------------|----------|
| Match repo owner | Same as repo owner (prodoxx) | ✓ |
| A specific name | User provides name | |
| You decide | Claude matches | |

**User's choice:** Match repo owner (prodoxx)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Just the name/org | Simple author field | |
| Name + URL | Name with GitHub URL | ✓ |
| You decide | Claude picks | |

**User's choice:** Name + URL

---

| Option | Description | Selected |
|--------|-------------|----------|
| No scope, keep 'claw-design' | Unscoped npm package | ✓ |
| Add @prodoxx scope | Scoped npm package | |
| Discuss other metadata | Other fields | |

**User's choice:** No scope, keep 'claw-design'

---

## Claude's Discretion

- Exact wording of updated package.json description
- Badge markdown syntax and shield.io URLs
- README section ordering and content structure
- CONTRIBUTING.md technical detail level for dev setup
- Issue template field specifics
- PR template checklist items

## Deferred Ideas

None — discussion stayed within phase scope.
