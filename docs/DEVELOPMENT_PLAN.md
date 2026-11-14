# Development Plan

## Phase 1 — Stabilization and encoding
- [x] Restore UTF-8 Russian strings in the six source files affected by the encoding regression.
- [ ] Add an automated encoding regression check.
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
- [x] Require an explicit approval flag for terminal commands and mutating Git operations.
- [ ] Centralize authorization for terminal execution, file writes, Git, SSH, browser actions, model management, and other side effects.
- [ ] Separate proposal, user approval, execution, and verification for every side effect.
- [ ] Record approvals and results in the operation log.

## Phase 5 — Secret storage
- [ ] Use native OS credential storage where supported.
- [ ] Keep the encrypted local vault as a documented fallback.
- [ ] Define recovery and migration behavior without losing existing credentials.

## Phase 6 — Quality gates and documentation
- [x] Add CI for type-check, integration tests, and production build on pushes to main.
- [x] Restrict Windows installer publishing to version tags or manual dispatch.
- [x] Add working rules, development plan, current state, and continuation prompt.
- [ ] Confirm the first CI run and fix all failures.

## Phase 7 — UI consistency
- [ ] Audit all routes, navigation actions, modal flows, and responsive layouts.
- [ ] Preserve the light-first One Core visual direction.
- [ ] Verify typography, spacing, focus states, and keyboard accessibility across every page.
