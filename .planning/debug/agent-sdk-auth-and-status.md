---
status: awaiting_human_verify
trigger: "Agent SDK auth failure shows as Done instead of Error; no OAuth/auth flow exists; need key storage strategy"
created: 2026-04-04T00:00:00Z
updated: 2026-04-04T00:10:00Z
---

## Current Focus

hypothesis: CONFIRMED - three-part root cause identified and fixed
test: All 186 tests pass, TypeScript compiles clean
expecting: User confirms real-world auth error now shows Error badge + helpful message
next_action: Awaiting human verification in real Electron environment

## Symptoms

expected: When Claude Code Agent SDK returns an auth error, the sidebar task should show "Error" status with a human-readable message. Also, the Agent SDK should be properly authenticated before making queries.
actual: Task shows "Done" badge (green) when it actually failed with "Invalid API key". The log viewer shows: "Claude connected, starting edits... / Invalid API key - Fix external API key / Completed". The "Done" status is misleading -- the auth error was captured in logs but the final SDK result was classified as 'success'.
errors: "Invalid API key - Fix external API key" -- this appears in the log viewer but doesn't trigger error status on the task.
reproduction: Start clawdesign, select any region, submit any instruction. Since no auth is configured, every task fails silently with auth error but shows "Done".
started: First time testing real Agent SDK integration. Auth was never implemented -- the AgentManager calls query() without any auth setup.

## Eliminated

(none -- first hypothesis was correct)

## Evidence

- timestamp: 2026-04-04T00:01:00Z
  checked: SDK types for SDKResultMessage, SDKResultSuccess, SDKResultError
  found: SDKResultSuccess has subtype 'success'. SDKResultError has subtype 'error_during_execution' | 'error_max_turns' | 'error_max_budget_usd' | 'error_max_structured_output_retries'. Auth errors are NOT a result subtype -- they appear on SDKAssistantMessage.error ('authentication_failed' | 'billing_error' | 'rate_limit' | etc.) and on SDKAuthStatusMessage (type 'auth_status', has error? field).
  implication: When auth fails, SDK emits result with subtype 'success' because no execution error occurred. The auth error lives on the assistant message or auth_status message, which our code logged as text but never checked for error status.

- timestamp: 2026-04-04T00:02:00Z
  checked: SDK Options type for API key / auth configuration
  found: No apiKey field in Options. SDK inherits Claude Code's auth (OAuth login via `claude login`). The system init message includes apiKeySource field. SDKAuthStatusMessage has isAuthenticating, output[], error? fields. Query interface has accountInfo() method. No way to pass API key directly via SDK options.
  implication: Auth is managed by Claude Code CLI installation. Users must run `claude login` first. `claude auth status --json` provides a pre-flight check.

- timestamp: 2026-04-04T00:03:00Z
  checked: Current agent-manager.ts message handling
  found: Code handles system.init -> 'editing', assistant -> extract tool use (but ignores .error field), result.success -> 'done', result.!success -> 'error'. Does NOT handle type 'auth_status' at all. Does NOT check SDKAssistantMessage.error field.
  implication: Three gaps confirmed: (1) SDKAssistantMessage.error field ignored, (2) SDKAuthStatusMessage ignored, (3) no pre-flight auth check

- timestamp: 2026-04-04T00:05:00Z
  checked: claude auth status --json command
  found: Returns { loggedIn: boolean, authMethod, apiProvider, apiKeySource, email, ... } -- perfect for pre-flight auth check
  implication: Can check auth at startup before launching Electron

- timestamp: 2026-04-04T00:09:00Z
  checked: All 186 tests pass, TypeScript compiles clean
  found: Fix verified via 7 new tests (3 agent-manager, 5 claude, 1 start) + all 186 existing tests pass
  implication: Fix is solid, no regressions

## Resolution

root_cause: Three-part issue: (1) AgentManager ignores SDKAssistantMessage.error field -- auth failures appear as assistant messages with error='authentication_failed' but code only extracts tool_use blocks and text for logging, never checks the error field. When the session ends, SDK emits result with subtype 'success' (no execution error occurred), so the task shows "Done". (2) SDKAuthStatusMessage (type 'auth_status') is not handled at all -- falls through to the "ignored for IPC perf" catch-all. (3) No pre-flight auth check -- SDK piggybacks on Claude Code auth (via `claude login`) but clawdesign never verifies auth before launching.
fix: |
  Issue 1 (agent-manager.ts): Added fatalErrors[] tracking on InternalTask. Now handles SDKAuthStatusMessage (type 'auth_status') -- captures error field. Now checks SDKAssistantMessage.error field against FATAL_ASSISTANT_ERRORS set (authentication_failed, billing_error, invalid_request). When result message arrives, if fatalErrors is non-empty, task is marked 'error' regardless of result.subtype. Updated humanReadableError to point users to `claude login`.
  Issue 2 (claude.ts): Added getClaudeAuthStatus() function that runs `claude auth status --json` and returns parsed auth status.
  Issue 3 (start.ts): Added Step 1b auth check after Claude-installed check. If not authenticated, exits with clear error message pointing to `claude login`.
verification: 186/186 tests pass. 7 new tests added: (a) auth error on SDKAssistantMessage.error overrides success result, (b) auth error on SDKAuthStatusMessage overrides success result, (c) fatal errors logged correctly, (d) getClaudeAuthStatus returns logged-in status, (e) getClaudeAuthStatus returns false on failure, (f) getClaudeAuthStatus handles invalid JSON, (g) start command exits when not authenticated. TypeScript compiles clean.
files_changed:
  - src/main/agent-manager.ts
  - src/cli/utils/claude.ts
  - src/cli/commands/start.ts
  - tests/main/agent-manager.test.ts
  - tests/cli/claude.test.ts
  - tests/cli/start.test.ts
