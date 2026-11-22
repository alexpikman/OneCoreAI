# Development Plan

## Phase 1 — Stabilization and encoding
- [x] Restore UTF-8 Russian strings in the affected frontend files.
- [x] Add an automated encoding regression check.
- [x] Preserve existing feature changes and user-data compatibility.

## Phase 2 — Local API security
- [x] Validate loopback Host, Origin, and Fetch Metadata headers.
- [ ] Complete the authenticated session/token model, including process-authenticated session issuance.
  - [x] Require short-lived bearer sessions for protected API routes and journal streaming.
  - [x] Use a Rust-generated CSPRNG token for the packaged backend and expose it to the frontend only through a Tauri command.
  - [ ] Replace origin-trusted bootstrap in browser development/Tauri debug mode; it does not authenticate arbitrary local processes.
- [x] Keep primary AI provider API keys in server-side Vault references; `/api/settings` returns blank secret fields plus configured metadata. `/api/providers/*` and agent chat resolve credentials by validated provider ID.
- [x] Extend server-side secret resolution to global and role-scoped subagent providers; add explicit replace/revoke controls in Settings → Security.
- [x] Move GitHub PAT, Telegram gateway tokens, cloud-fallback key, primary provider keys, and global/role-scoped subagent keys behind explicit server-side secret APIs; settings GET/PUT responses expose no secret values.
- [x] Resolve provider base URLs and API keys from server-side configuration by validated provider ID/scope; ignore client-supplied provider URLs and credentials.
- [ ] Audit any remaining secret-bearing browser state and define SSH agent/passphrase lifecycle; SSH private-key files remain path references, not copied into the settings manifest.
- [ ] Verify all browser-to-local API request paths in Tauri and browser development modes.
- [ ] Ensure secrets are never exposed in logs or plain manifests.

## Phase 3 — Workspace path security
- [x] Canonicalize project roots.
- [x] Reject absolute paths, traversal, and symbolic-link components.
- [x] Revalidate destinations after directory creation and before writes.
- [x] Add Windows-specific path edge-case tests for drive-relative/absolute paths, UNC paths, reserved device names, alternate data streams, trailing dots/spaces, and invalid characters.
- [ ] Close remaining filesystem race windows with handle-relative filesystem operations.

## Phase 4 — Permission Manager
- [x] Add a central project tool permission manager for file reads/writes, terminal, Git, and code search.
- [x] Require explicit approval for terminal commands, mutating Git operations, file writes, and undo.
- [x] Keep agent-generated file diffs and commands pending until user confirmation.
- [x] Add route-level approval checks to the currently covered side effects: model download/pause/resume/import/activation/deletion, directory creation, project deletion, SSH connection tests, browser search/read, GitHub/Telegram verification, file writes, terminal execution, undo, and mutating Git operations.
- [ ] Complete a route-by-route audit of every API endpoint and close remaining approval gaps; coverage is not yet universal.
- [ ] Replace client-boolean approval with one-time Approval Tickets bound to the authenticated session, exact action/payload, and expiry.
- [ ] Record authoritative approval identity, scope, decision, and result in the operation log.

## Phase 5 — Secret storage
- [x] Use Windows Credential Manager through the native Windows Credential API.
- [x] Use macOS Keychain where supported.
- [x] Implement Linux Secret Service storage.
- [x] Store subagent provider API keys under separate OS-vault references; do not persist them in the JSON settings manifest.
- [x] Version fallback vault encryption with a per-vault random salt and higher-cost scrypt derivation.
- [x] Migrate legacy vault entries only after successful decryption of every entry; preserve the original file on corruption or migration failure.
- [ ] Add user-controlled recovery/export and cross-machine migration; the current fallback remains bound to the same OS user and machine context.

## Phase 6 — Quality gates and documentation
- [x] Add CI for encoding checks, type-check, integration tests, and production build on Linux and Windows.
- [x] Restrict Windows installer publishing to version tags or manual dispatch.
- [x] Add working rules, development plan, current state, and continuation prompt.
- [x] Confirm Linux and Windows CI; encoding, type-check, integration tests, and production build pass on both runners.

## Phase 7 — UI consistency
- [x] Set the first-run theme to light Mica and align browser/PWA startup colors without overriding saved preferences.
- [x] Keep the agent header visible across all application routes and show provider, model, and active mode.
- [x] Restrict role-switcher buttons to chat and replace the old chat/code toolbar selector with ACT/PLAN.
- [x] Reorder chat tools and display the active project path.
- [x] Group provider, local model/runtime, roles/pipeline, and skills/subagents settings under MODELS.
- [x] Enforce one active LOCAL, CLOUD, COMPATIBLE, or LLAMASERVER source for the primary agent.
- [x] Gate right-side local runtime controls on a connected selected LLAMASERVER provider.
- [x] Add separate LOCAL/CLOUD/COMPATIBLE/LLAMASERVER provider and model settings for the subagent subsystem.
- [ ] Audit all routes, navigation actions, modal flows, and responsive layouts.
- [ ] Preserve the light-first One Core visual direction.
- [x] Replace remote Google Fonts loading with bundled local Manrope / DM Mono assets.
- [ ] Audit small text sizes and establish consistent readable typography tokens.
- [ ] Verify spacing, focus states, and keyboard accessibility across every page.

## Phase 8 — Project agent, model capabilities, and telemetry
- [x] Define the project workspace contract: files, metadata, plan, tasks, permissions, and action history.
- [x] Inject active project context and task state into the dedicated project-agent prompt and global primary-agent context.
- [x] Route task list/create/execute intents to the project agent; support structured task creation/status updates in ACT mode while keeping PLAN mode read-only.
- [x] Add automatic/manual model self-assessment for file, terminal, Git, SSH, GitHub, web, function-calling, and vision capabilities.
- [x] Separate model claims from actual application tools and project permissions.
- [x] Display provider and session token usage, estimated file context, configured and model-reported context windows, and accurately labelled local memory estimates.
- [ ] Verify capability probes against representative Ollama, LM Studio, cloud, and llama.cpp-compatible providers; unknown responses must remain unknown.
- [ ] Implement file deletion, SSH, and direct GitHub project tools before advertising them as available.


## Chat workspace and agent controls
- [x] Move ACT/PLAN to the global header beside an animated model-state indicator.
- [x] Move Browser and Terminal into the composer as SVG icon-only controls with tooltips; remove the separate toolbar and Areas & Style action.
- [x] Move Checkpoints above the Subagents section in the right inspector.
- [x] Move specialist role toggles into Global AI Settings and support the general-agent mode when all roles are disabled.
- [x] Add the common primary-agent rule to the roles/rules library and inject enabled directives into the system context.
- [x] Add editable, lockable, disableable subagent rules and project-plan binding.
- [x] Stream standard provider chat responses and render user/assistant placeholders immediately.
- [ ] Add incremental streaming to project-agent task execution and subagent responses.
- [ ] Finish Cline-inspired file/terminal/browser panels, resizing, and task timeline behavior.

## Phase 9 — Navigation taxonomy and shell structure
- [x] Define the six static navigation sections and their ordered dynamic subsections.
- [x] Split the sidebar into persistent **Статика** and selection-dependent **Динамика** blocks.
- [x] Open the first subsection automatically when a static section is selected.
- [x] Add tab identifiers and shared placeholder rendering for unfinished destinations.
- [x] Document route mappings, shared settings destinations, and known implementation gaps.
- [ ] Give Dashboard and Chat distinct destinations/content if they are intended to be separate workspaces.
- [ ] Synchronize the selected static section with navigation changes originating outside the sidebar.
- [ ] Complete and verify consistent use of the official Tabler Icons Outline set across navigation and controls.
- [ ] Run lint, tests, production build, and browser/runtime checks for the completed navigation behavior.


## Phase 10 — Independent menu visibility
- [x] Add a two-column visibility editor to Settings → Interface for the left navigation/workspace sidebar and right inspector.
- [x] Add persistent, backward-compatible navigation visibility settings.
- [x] Expose individual visibility controls for primary navigation items and applicable icons/text labels.
- [x] Wire visibility settings to the left and right menu renderers.
- [ ] Run lint, tests, production build, and browser/runtime verification for menu visibility behavior.


## Operation Lifecycle and Verification Gate
- [x] Add an abort controller per registered API operation and preserve terminal operation records.
- [x] Add parent-to-child cancellation propagation while keeping child cancellation independent from siblings.
- [x] Expose authenticated operation list, detail, and cancellation API routes.
- [x] Propagate cancellation to general-agent/provider chat and project command execution paths.
- [x] Align journal terminal status with the operation registry cancellation result.
- [x] Verify persisted file-write content and file undo outcomes.
- [x] Record command exit, timeout, and cancellation checks in a verification report.
- [ ] Enforce parent-waits-for-required-children completion semantics across all orchestrators.
- [ ] Propagate cancellation through all pipeline/subagent paths and terminate Windows process trees.
- [ ] Add optimistic file conflict detection and Approval Tickets.
- [ ] Verify Git post-state, pipeline artifacts, and project-task acceptance criteria before marking work complete.
- [ ] Add restart recovery, idempotency, and authoritative server-side operation events.


## Phase 11 — Project workspace and global registries
- [x] Replace the nested project sidebar/tabs with a full-width project list using the shared page layout.
- [x] Add selected-project context cards for Tasks, Plan, and Actions in the right panel.
- [x] Keep exactly one optional plan per project and edit it in a dedicated modal; do not create a global plans registry.
- [x] Add a global Tasks endpoint that aggregates project-owned tasks without duplicating persistence.
- [x] Add global Tasks UI with project/status/search filters and project-scoped create, update, and delete.
- [x] Add global Processes UI over agent-journal events with project/status/search filters.
- [x] Add global Project History over per-project action logs with project/type/date/search filters.
- [x] Record task and plan mutations in the project action log with distinct operation kinds.
- [x] Show the number of projects represented by the filtered Tasks, Processes, and Project History lists in the right context panel.
- [ ] Verify Projects, Tasks, Processes, and plan modal in browser/runtime across themes and responsive widths.
- [ ] Decide whether Processes should remain a filtered journal view or become a separate persisted domain model.

## Phase 12 — Provider-agnostic runtimes and external API

The normative requirements are defined in [AI Providers, Model Runtime, and External API Contract](../architecture/AI_PROVIDER_AND_SERVER_ARCHITECTURE.md).

- [x] Replace the modal-based provider editor entry point with the unified Providers page.
- [x] Split provider connections into Local, Cloud, Compatible, and LlamaServer categories; move custom OpenAI-compatible endpoints out of the legacy runtime category.
- [x] Migrate legacy persisted `runtime` provider selections by provider kind without changing provider IDs or credentials.
- [x] Keep managed llama.cpp process/installation controls separate from user-managed Compatible endpoints.
- [x] Keep agent-role activation on the Agents and Roles page rather than mixing it into provider connection management.
- [x] Support multiple independently persisted Compatible endpoint profiles with a dedicated list and compact add form.
- [x] Add a LlamaServer model workspace with GGUF cards, real process/model status, load/unload/delete actions, and primary/role-scoped subagent model assignment.
- [ ] Add llama-server external-client/request telemetry before displaying external connection counts.
- [ ] Extend the Model Router beyond current primary and role-scoped provider selections to task-aware routing, concurrency, runtime isolation, and resource-aware scheduling.
- [ ] Extend the existing **Провайдеры / Модели** surface into a dedicated Model Router workspace for agent/model assignments, routing priorities, fallback policy, capability constraints, and resource-aware scheduling. Keep GGUF discovery/import under LlamaServer → Поиск моделей; do not implement routing policy in the LlamaServer installation/search subsections.
- [ ] Audit current provider adapters and map each provider class to implemented/partial/missing capabilities.
- [ ] Make provider connection, model discovery, health, and inference diagnostics truthful and consistent.
- [ ] Complete the managed llama.cpp runtime lifecycle: binary acquisition/verification, platform packaging, launch arguments, process supervision, readiness, inference smoke test, stop/restart, and crash reporting.
- [ ] Preserve independently managed Ollama, LM Studio, remote OpenAI-compatible endpoints, and cloud providers; do not take over their lifecycle implicitly.
- [ ] Verify provider/model selection and routing independently for the primary agent, project agent, specialist agents, and task/workflow overrides.
- [ ] Verify capability reporting and graceful unsupported-feature handling across representative providers.
- [ ] Implement the ONE CORE OpenAI-compatible API gateway: model discovery, chat completions, SSE streaming, stable model IDs/aliases, and routing through the shared provider registry.
- [ ] Add API key creation, secure storage, revocation, scopes/allowlists, request audit, and loopback-first network exposure controls.
- [ ] Decouple API service lifetime from the UI where supported; implement and verify platform-specific background service behavior.
- [ ] Add integration and runtime smoke tests for local managed, local external, remote, and cloud provider classes, including API authentication, streaming, cancellation, and key revocation.


## Phase 13 — Live system map and external research library

The architecture contract is defined in [Live System Map and External References](../architecture/LIVE_SYSTEM_MAP_AND_EXTERNAL_REFERENCES.md).

- [x] Define separate authority, storage, and UI boundaries for live execution evidence and external research material.
- [x] Add optional typed trace metadata to journal events without invalidating existing persisted events.
- [x] Instrument the current project-agent orchestration route, context preparation, provider rounds, and actual tool calls.
- [x] Expose a read-only system-map snapshot by joining the operation registry and journal.
- [x] Add a live operation/event timeline to Processes using the existing journal SSE stream; retain the flat journal view.
- [x] Add an isolated local external-reference store with server-side validation and CRUD API.
- [x] Expose the versioned knowledge catalog separately and display both catalogs without mixing their authority.
- [x] Add integration coverage for trace metadata and external-reference isolation.
- [ ] Run source-encoding check, TypeScript/lint, integration tests, and production build on the current commit.
- [ ] Verify the live map with a real project-agent request and verify reference CRUD in the running app, including light/dark themes and responsive widths.
- [ ] Extend instrumentation to standard provider chat, task/pipeline execution, subagents, verification stages, and explicit instruction handoffs before claiming complete route coverage.
- [ ] Add evidence-backed role/instruction binding and safe redacted input/output summaries to every supported execution path.
- [ ] Evaluate local attachment support and reviewed source capture as a separate follow-up; do not add automatic crawling in this phase.
