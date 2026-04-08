---
status: awaiting_human_verify
trigger: "Electron default branding still appears in macOS menu bar and About dialog"
created: 2026-04-08T00:00:00Z
updated: 2026-04-08T00:00:00Z
---

## Current Focus

hypothesis: macOS menu bar shows "Electron" because (1) package.json lacks `productName` field, (2) no `app.setName()` call in main process, and (3) no custom application menu is set -- Electron falls back to its default menu with its own name
test: Check package.json for productName, check main process for app.setName() or Menu.setApplicationMenu(), check for any icon assets
expecting: Missing productName, no setName, no custom menu, no icon assets
next_action: Read code to confirm these omissions, then apply fixes

## Symptoms

expected: macOS menu bar should say "Claw Design" (About Claw Design, Hide Claw Design, Quit Claw Design). About dialog should show "Claw Design" with a custom icon. Dock icon should be a custom icon, not the Electron atom.
actual: Menu bar says "Electron", About dialog says "Electron Version 36.9.5" with the Electron atom icon. Dock shows default Electron icon.
errors: None -- branding/configuration issue, not a runtime error.
reproduction: Run `clawdesign start` in any project, look at macOS menu bar and About dialog.
started: Always been this way -- Phase 07 rebrand only changed CLI strings and window title.

## Eliminated

## Evidence

- timestamp: 2026-04-08T00:01:00Z
  checked: package.json
  found: Has `name: "claw-design"` but no `productName` field. Electron reads `productName` for display name.
  implication: Electron falls back to its own default name "Electron" when productName is missing.

- timestamp: 2026-04-08T00:01:30Z
  checked: src/main/index.ts
  found: No call to `app.setName()` or `app.name =` anywhere in the main process entry.
  implication: App name is not being overridden at runtime.

- timestamp: 2026-04-08T00:02:00Z
  checked: src/main/index.ts and src/main/window.ts
  found: No `Menu.setApplicationMenu()` call anywhere. No custom menu is set. Electron uses its default menu which says "Electron".
  implication: The default Electron menu is used, which contains "About Electron", "Hide Electron", "Quit Electron".

- timestamp: 2026-04-08T00:02:30Z
  checked: BaseWindow constructor in window.ts
  found: BaseWindow has `title` set to `Claw Design -- projectName -- localhost:port` but no `icon` property.
  implication: Window title is branded but the dock/About icon uses Electron default.

## Resolution

root_cause: Three missing configurations cause Electron default branding: (1) No `productName` in package.json, (2) no custom application menu via Menu.setApplicationMenu() in the main process, (3) no icon assets or app.dock.setIcon() call. In dev/npx mode (not packaged), Electron reads productName from package.json for the app name but falls back to "Electron" when absent. The macOS menu bar is populated from the default Electron menu template which uses this name.
fix: (1) Added `productName: "Claw Design"` to package.json. (2) Created src/main/menu.ts with a custom macOS application menu that uses "Claw Design" in all menu items (About, Hide, Quit). (3) Added `app.setName('Claw Design')` in main process before window creation. (4) Added `app.setAboutPanelOptions()` with branded name, version, and icon. (5) Added `app.dock.setIcon()` call for macOS dock icon. (6) Created resources/icon.png and resources/icon.icns as branded "CD" icon assets. (7) Added `resources/` to package.json `files` array for npm distribution.
verification: Build succeeds (electron-vite build). All 234 tests pass. Icon path resolution verified from runtime perspective (out/main/ -> ../../resources/icon.png resolves correctly). Awaiting human verification of visual branding in running app.
files_changed: [package.json, src/main/index.ts, src/main/menu.ts, resources/icon.png, resources/icon.icns]
