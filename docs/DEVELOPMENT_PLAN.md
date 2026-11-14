# Development Plan

## Phase 1 — Stabilization and encoding
- [x] Restore UTF-8 Russian strings in the affected frontend files.
- [x] Add an automated encoding regression check.
- [x] Preserve existing feature changes and user-data compatibility.

## Phase 2 — Local API security
- [x] Validate loopback Host, Origin, and Fetch Metadata headers.
- [ ] Add an authenticated session/token model for all API calls; origin validation is not authentication against other local processes.
- [ ] Verify all browser-to-local API request paths in Tauri and browser development modes.
- [ ] Ensure secrets are never exposed in logs or plain manifests.

## Phase 3 — Workspace path security
- [x] Canonicalize project roots.
- [x] Reject absolute paths, traversal, and symbolic-link components.
- [x] Revalidate destinations after directory creation and before writes.
- [ ] Add Windows-specific path edge-case tests and close remaining filesystem race windows.

## Phase 4 — Permission Manager
- [x] Add a central project tool permission manager for file reads/writes, terminal, Git, and code search.
- [x] Require explicit approval for terminal commands, mutating Git operations, file writes, and undo.
- [x] Keep agent-generated file diffs and commands pending until user confirmation.
- [ ] Extend permission checks to model management, SSH, browser/network actions, project deletion, and all remaining side effects.
- [ ] Record approval identity, scope, and results in the operation log.

## Phase 5 — Secret storage
- [x] Use Windows Credential Manager through the native Windows Credential API.
- [x] Use macOS Keychain where supported.
- [x] Implement Linux Secret Service storage.
- [ ] Strengthen fallback vault key derivation and define recovery/migration behavior without losing existing credentials.

## Phase 6 — Quality gates and documentation
- [x] Add CI for encoding checks, type-check, integration tests, and production build on Linux and Windows.
- [x] Restrict Windows installer publishing to version tags or manual dispatch.
- [x] Add working rules, development plan, current state, and continuation prompt.
- [ ] Confirm the first CI run and fix all failures.

## Phase 7 — UI consistency
- [x] Set the first-run theme to light Mica and align browser/PWA startup colors without overriding saved preferences.
- [ ] Audit all routes, navigation actions, modal flows, and responsive layouts.
- [ ] Preserve the light-first One Core visual direction.
- [ ] Replace remote Google Fonts loading with bundled local font assets; use the approved Manrope / DM Mono typography system.
- [ ] Audit small text sizes and establish consistent readable typography tokens.
- [ ] Verify spacing, focus states, and keyboard accessibility across every page.
