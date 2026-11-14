# Development Plan

## Phase 1 — Stabilization and encoding
- [x] Restore UTF-8 Russian strings in the affected frontend files.
- [x] Add an automated encoding regression check.
- [x] Preserve existing feature changes and user-data compatibility.

## Phase 2 — Local API security
- [x] Validate loopback Host, Origin, and Fetch Metadata headers.
- [ ] Add an authenticated session/token model for all API calls; origin validation is not authentication against other local processes.
- [ ] Keep provider/API secrets server-side and return only presence/masked metadata from `/api/settings`.
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
- [x] Store subagent provider API keys under separate OS-vault references; do not persist them in the JSON settings manifest.
- [ ] Strengthen fallback vault key derivation and define recovery/migration behavior without losing existing credentials.

## Phase 6 — Quality gates and documentation
- [x] Add CI for encoding checks, type-check, integration tests, and production build on Linux and Windows.
- [x] Restrict Windows installer publishing to version tags or manual dispatch.
- [x] Add working rules, development plan, current state, and continuation prompt.
- [x] Confirm Linux and Windows CI; encoding, type-check, integration tests, and production build pass on both runners.

## Phase 8 — Project agent, model capabilities, and telemetry
- [x] Define the project workspace contract: files, metadata, plan, tasks, permissions, and action history.
- [x] Inject active project context and task state into the primary project-agent prompt.
- [x] Support structured task creation/status updates in ACT mode while keeping PLAN mode read-only.
- [x] Add model self-assessment for file, terminal, Git, SSH, GitHub, web, function-calling, and vision capabilities.
- [x] Separate model claims from actual application tools and project permissions.
- [x] Display provider token usage, estimated file context, configured context window, and local runtime memory.
- [ ] Verify capability probes against Ollama, LM Studio, cloud, and llama.cpp-compatible providers; unknown responses must remain unknown.
- [ ] Implement file deletion, SSH, and direct GitHub project tools before advertising them as available.

## Phase 7 — UI consistency
- [x] Set the first-run theme to light Mica and align browser/PWA startup colors without overriding saved preferences.
- [x] Keep the agent header visible across all application routes and show provider, model, and active mode.
- [x] Restrict role-switcher buttons to chat and replace the old chat/code toolbar selector with ACT/PLAN.
- [x] Reorder chat tools and display the active project path.
- [x] Group provider, local model/runtime, roles/pipeline, and skills/subagents settings under MODELS.
- [x] Enforce one active LOCAL, CLOUD, or RUNTIME source for the primary agent.
- [x] Gate right-side local runtime controls on a connected selected RUNTIME provider.
- [x] Add separate LOCAL/CLOUD/RUNTIME provider and model settings for the subagent subsystem.
- [ ] Audit all routes, navigation actions, modal flows, and responsive layouts.
- [ ] Preserve the light-first One Core visual direction.
- [x] Replace remote Google Fonts loading with bundled local Manrope / DM Mono assets.
- [ ] Audit small text sizes and establish consistent readable typography tokens.
- [ ] Verify spacing, focus states, and keyboard accessibility across every page.
