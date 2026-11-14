# Development Plan

## Phase 1 — Stabilization and encoding
- Restore UTF-8 Russian strings in source files affected by the encoding regression.
- Add regression checks so mojibake is caught during review.
- Keep user data and existing settings compatible.

## Phase 2 — Local API security
- Keep the backend bound to loopback only.
- Validate Host, Origin, and Fetch Metadata headers.
- Add an explicit authenticated session/token model for all API calls; origin validation is not authentication against other local processes.
- Ensure secrets are never exposed in logs or plain manifests.

## Phase 3 — Workspace path security
- Canonicalize project roots.
- Reject absolute paths, traversal, and symbolic-link components.
- Revalidate destinations after directory creation and before writes.
- Add tests for Windows and POSIX path edge cases.

## Phase 4 — Permission Manager
- Centralize authorization for terminal execution, Git mutations, file writes, SSH, and other side effects.
- Separate proposal, user approval, execution, and verification.
- Enforce permissions in the backend, not only in UI controls.
- Record approvals and results in the operation log.

## Phase 5 — Secret storage
- Use native OS credential storage where supported.
- Keep the encrypted local vault as a documented fallback.
- Define recovery and migration behavior without losing existing credentials.

## Phase 6 — Quality gates and documentation
- Run type-check, integration tests, and production build on every push to main.
- Publish Windows installers only from version tags or an explicit release workflow.
- Keep the architecture, working rules, plan, and current state synchronized.

## Phase 7 — UI consistency
- Audit all routes, navigation actions, modal flows, and responsive layouts.
- Preserve the light-first One Core visual direction.
- Verify typography, spacing, focus states, and keyboard accessibility across every page.
