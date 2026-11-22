# Current Work

## 1. Current version and project state
- Product: OneCoreAI.
- Repository: `alexpikman/OneCoreAI`.
- Branch: `main`.
- Version: `0.2.1`.
- Stack: React 19, TypeScript, Vite 8, Zustand 5, Express, Tauri 2.
- Product is in active development; it is not production-ready.

## 2. Last confirmed milestone
- The Projects workspace now uses the shared page layout, a full-width project list, a project context panel, and a per-project plan modal.
- Global Tasks and Processes pages now support cross-project lists and project filters; task records remain stored under their owning project ID.
- Project-scoped subagents can list and read approved knowledge documents through the existing agent executor.
- Knowledge documents place YAML frontmatter at byte zero, as required by `server/knowledgeManager.ts`.
- Documentation is organized into separate governance, project, architecture, and runtime knowledge areas; runtime knowledge paths and IDs are preserved.

## 3. Implemented capabilities
- Local API Host/Origin/Fetch Metadata validation, short-lived bearer sessions for protected routes, and canonical project path checks.
- Windows-specific project-path rejection for reserved names, alternate data streams, trailing dots/spaces, and invalid path characters.
- Central project tool permissions and explicit approvals for file writes, terminal commands, mutating Git operations, and undo.
- OS credential storage integrations for Windows Credential Manager, macOS Keychain, and Linux Secret Service.
- Linux/Windows CI for encoding, TypeScript checks, integration tests, and production builds.
- Project Agent task context and task operations, ranked project-file context, provider token/capability reporting.
- Standard chat streaming, request cancellation, parent/child operation registry, operation list/detail/cancel API, and journal terminal-state correlation.
- Verification Gate for persisted file writes, file undo, and command exit/timeout/cancellation outcomes.
- Static/dynamic navigation, independent left/right menu visibility controls, and versioned agent knowledge.
- Project workspace UI: one optional plan per project, edited in a modal; project context cards link to global Tasks and Processes views.
- Global task registry endpoint (`GET /api/tasks`) aggregates project-scoped tasks without duplicating storage; task create/edit/delete continues to use the owning project's API.
- Global project history endpoint (`GET /api/project-history`) aggregates the existing per-project operation logs; task and plan mutations are recorded with explicit operation kinds.
- Global Processes view reads journal events and filters them by `projectId`, status, and search.
- Global Project History aggregates per-project action logs without moving their storage; it filters by project, operation kind, date range, and text. The Projects context panel links to it, and Tasks, Processes, and Project History expose the number of represented projects in the right context panel.
- ProjectModal uses one fixed-size project workspace with four internal tabs: Project, Files, Tasks, and Actions. The Project tab orders creation date and task/action counts, name/model, description, folder path selection, permissions, and plan. The Files tab contains the local/SSH/GitHub source selector and the project's file list. Tasks and Actions retain their existing project-scoped views. Save and Delete actions stay in the top bar; deletion requires typing `удалить` and removes the project's workspace data, action log, AI journal events, and stored SSH/GitHub secret references without deleting the user's project folder. The modal's central content scrolls independently while its outer geometry stays fixed.
- Multi-agent roles and procedures are available as knowledge; full Manager/Dispatcher orchestration is not implemented.

## 4. Unfinished work
- Packaged Tauri now uses a Rust-generated CSPRNG bearer token delivered through native IPC; browser development and Tauri debug still use origin-trusted bootstrap and do not authenticate arbitrary local processes.
- Primary/global/role-scoped subagent provider keys, GitHub PAT, Telegram gateway tokens, and cloud-fallback key use server-side Vault references and Security controls. Provider base URLs are resolved from the settings manifest, not request payloads. SSH private keys remain path references managed by the OS agent; passphrase lifecycle remains to be audited.
- Extend permission enforcement to all remaining side-effect endpoints and replace client-controlled approval booleans with one-time server-issued Approval Tickets.
- Side-effect approvals now cover model download/manage, directory creation, project deletion, SSH tests, browser network calls, GitHub/Telegram verification, project file writes, terminal commands, mutating Git, and undo; decisions are journaled with actor/scope/resource/result.
- Approval identity is currently inferred from an authenticated local request plus an affirmative client flag; it is not yet a cryptographically bound consent ticket.
- Complete one-time Approval Tickets, optimistic file conflict detection, parent-waits-for-children semantics, Windows process-tree cancellation, and restart recovery.
- Extend Verification Gate to task acceptance criteria, Git post-state, and pipeline artifacts; make server operation events authoritative across all execution paths.
- Implement or explicitly disable unsupported SSH/Docker execution paths and remaining agent tools.
- Complete Project Agent/Subagent streaming and end-to-end delegation.
- Finish UI/accessibility audit and Windows Tauri packaging/runtime verification.
- Audit SSRF, file browser, model downloads, provider proxies, request validation, and rate limits.

## 5. Known problems and limitations
- Packaged Tauri uses a native-issued bearer token. Browser development/Tauri debug still use origin-trusted session bootstrap and do not authenticate arbitrary local processes.
- Primary provider secrets are no longer returned by `/api/settings`; provider proxy routes resolve them by configured provider ID. Subagent provider resolution is now included; GitHub PAT, Telegram gateway tokens, cloud-fallback key, and provider/subagent keys have server-side Vault APIs; SSH agent/passphrase lifecycle and broader request-path/SSRF audit remain unfinished.
- Parent-directory swap races are not fully eliminated by current Node path revalidation.
- Fallback vault migration uses per-vault salt and scrypt N=32768; the machine-bound seed remains weaker than OS keychain storage and cannot be recovered on another machine without re-entering secrets.
- Cancellation now propagates through registered API parent/child operations and selected provider/agent/project-command paths; pipeline/subagent coverage and Windows process-tree termination remain incomplete.
- Verification checks currently cover file persistence/undo and command exit/timeout/cancellation, not semantic task acceptance or Git/pipeline outcomes.
- Knowledge documents define target team workflows, but runtime handoff validation and Manager/Dispatcher control flow remain incomplete.
- Some navigation destinations still share routes or placeholder content; see the navigation architecture document.
- Processes currently use the existing agent journal event model and manual refresh; there is not yet a separate persisted Process domain entity or dedicated live stream for the Processes page.

## 6. Latest verification
- CI run `43728396368` for commit `6a1eaeb` passed on Ubuntu and Windows: encoding, TypeScript check, integration tests, and production build.
- CI run `43728876162` for commit `dac0a2d` passed on Ubuntu and Windows: encoding, TypeScript check, integration tests, and production build.
- CI run `43730271200` for commit `4e07cf7` passed on Ubuntu and Windows after bearer-session and Windows path validation changes.
- CI run `43730730930` for commit `c4125a3` passed on Ubuntu and Windows: operation lifecycle, cancellation propagation, and verification gate checks.
- CI run `43730842871` for commit `2a28491` passed on Ubuntu and Windows: journal status now matches cancelled operation outcomes.
- CI run `43731143045` for commit `9ea46a3` passed on Ubuntu and Windows: native packaged API token validation and client retrieval.
- CI run `43732132097` for commit `81f11df` passed on Ubuntu and Windows: expanded side-effect approval checks, permission audit events, vault migration tests, encoding, TypeScript, integration tests, and production build.
- CI run `43982373963` for commit `2ec0901` passed on Ubuntu and Windows: encoding, TypeScript check, integration tests, and production build.
- CI run `43982545913` for commit `371dc9c` passed on Ubuntu and Windows: encoding, TypeScript check, integration tests, and production build.

- No local npm checks or runtime/browser checks were run for this documentation reorganization.

## 7. Next recommended task
- Verify the revised four-tab ProjectModal in browser/runtime: fixed geometry across tab changes, project metadata/counts, local/SSH/GitHub folder configuration, task CRUD, plan save, and permissions in light/dark themes.


## 8. Unified non-chat Layout migration

- Architecture contract is defined in `docs/governance/AI_WORKING_RULES.md`: shared application bounds, PageHeader geometry, PageContent viewport, one default scroll owner, and explicit bounded nested scrolling. Chat remains excluded.
- Shared primitives added: `src/components/layout/pageLayout.ts` (canonical page width/gutters) and `src/components/layout/PageContent.tsx` (bounded content viewport; supports standard scrolling and explicit non-scrolling split-workspace mode).
- `PageHeader` and `PageContent` consume the same `PAGE_CONTAINER_CLASS`.
- Migrated to `PageContent`: Dashboard, Operations Journal, Projects, Tasks, Processes, Project History, Notes, Model Hub, Security, SSH/GitHub settings, Interface, Updates, Local llama.cpp, System, Roles and Pipeline, PlaceholderPage, provider settings, skills/memory settings, and messenger gateway settings.
- Notes and provider settings use the explicit non-scrolling viewport mode because their split panes are independent bounded work areas. Their internal list/detail scrolling remains inside the shared page viewport.
- `SystemView` owns one shared PageContent viewport; its execution-environment and GitHub installation views are bounded content children and do not create another page-level scroll owner.
- `OneCoreSettingsSections` skills/memory and gateway branches now have a shared PageHeader/PageContent composition. The gateway page now has its own semantic PageHeader.
- `ProvidersView` is a page-only provider settings surface using PageContent non-scrolling mode; the former modal host has been removed.
- The unconnected `ArchitecturePortalView` is not part of the active App route map; it remains outside this migration until its route/ownership is explicitly defined.
- Verification performed so far is static GitHub source inspection, JSX tag-balance checks, and scroll-owner/layout composition checks. Local lint, TypeScript, tests, production build, and browser/responsive checks have not been run for this migration.

## 9. Shared horizontal page navigation

- Added one authoritative navigation catalog and route-state helpers in `src/data/appNavigation.ts`; the left navigation and page-level navigation consume the same definitions.
- Added `PageSubNavigation`, a horizontal row beneath the page header for the active section's destinations. It is not sticky/fixed; it is composed inside the scrolling page content.
- Standard `PageContent` pages receive the row centrally. Specialized non-chat pages compose the same component at their page-content boundary.
- The active group is derived from the current tab/settings subsection so external navigation keeps the left and horizontal navigation synchronized.
- Chat remains excluded.
- CI run 44030401538: source-encoding checks passed on Ubuntu and Windows. TypeScript checks failed on both runners due to four errors in untouched files (`SettingsView.tsx`: missing `Download`; `ProjectModal.tsx`: missing `setConfirmDelete`, `setDeleteConfirmation`, and `AlertTriangle`). This blocker was subsequently fixed; see the verification record in the next section. Browser/responsive verification remains outstanding.


## 10. Navigation P0 corrections and agent history

- Removed the obsolete `SETTINGS_ITEMS` sidebar submenu from `AppNavigation`. The primary `NAV_GROUPS` catalog is now the only sidebar source for destinations; the five Integration destinations remain unchanged.
- Added `AgentHistoryView` and connected `agent-journal` to it in `App.tsx`. The page reads existing chat sessions and messages and presents user prompts, agent replies, role/provider/model metadata, subagent metadata, available token usage, timestamps, and archived sessions.
- `operations-log` continues to render `AgentJournalView`; technical operation events and intellectual agent conversation history remain separate.
- Added an integration regression check that rejects the legacy settings submenu and requires separate renderers for agent history and operations log.
- Updated the left contextual description for the agent history destination.
- Changes were made on `main`; source files were statically re-read after updates. CI, browser, responsive, and local runtime checks for this change set are pending.


## 11. Navigation visibility and remaining Layout migration

- Replaced the obsolete nested-settings visibility tree with a mirror of the real `NAV_GROUPS` catalog. Stable IDs were added to navigation groups and items; both the left menu and horizontal page navigation apply group/item visibility. The left menu also applies icon and label visibility.
- A group is omitted when disabled or when it has no visible destinations. Its dynamic submenu and horizontal page navigation are hidden with it. Selecting a group opens the first destination that is actually visible.
- Removed stale visibility entries for chat-session history from the left workspace menu; chat history remains in the right inspector.
- Added regression coverage that verifies all six group IDs and all 33 item IDs match the visibility catalog, rejects obsolete settings/session keys, and verifies the menu consumes the visibility settings.
- Migrated the remaining active page compositions in this pass: System and its bounded children, Roles and Pipeline, PlaceholderPage, provider split view, skills/memory, and messenger gateway. The Chat workspace and three-column shell were not changed.
- Static GitHub inspection confirms all six group IDs and 33 item IDs match the visibility catalog, all statically referenced left/right visibility keys exist, and the migrated PageContent/PageHeader/PageTransition tags are balanced. Regression tests were added for navigation catalog parity, both navigation renderers, and page scroll ownership. No local TypeScript/test/build or browser/responsive run has been performed; CI must be checked before claiming validation.

## 5. Provider and external API architecture recovery

- The normative provider/runtime/API contract is documented in `docs/architecture/AI_PROVIDER_AND_SERVER_ARCHITECTURE.md`.
- The contract preserves managed llama.cpp, externally managed Ollama and LM Studio, user-managed remote endpoints, generic OpenAI-compatible endpoints, and cloud providers.
- It requires per-agent/task provider routing and a first-class OpenAI-compatible API exposed by ONE CORE AI to external clients.
- These are product requirements, not claims of completed implementation. The provider audit and implementation work are tracked in Phase 12 of `DEVELOPMENT_PLAN.md`.
- The repository history available for the architecture index begins with the initial documentation upload; it does not establish whether the requirements existed in an earlier pre-upload version. No historical deletion point is claimed.
## 6. Managed llama.cpp runtime — installer added, verification pending

- Added a Node-side `LlamaCppRuntime` that starts the configured `llama-server` executable without a shell, uses the active ready GGUF file, validates the GGUF signature, applies the configured GPU layer/context values, binds only to `127.0.0.1`, and waits for the local `/health` endpoint before reporting `ready`.
- Added authenticated local API endpoints for runtime status, start, stop, and automatic installation. Startup cancellation, process termination confirmation, bounded stdout/stderr diagnostics, and backend-shutdown cleanup remain implemented.
- Added an automatic Windows x64 installer using stable releases from the official `ggml-org/llama.cpp` GitHub repository. It prefers a matching CUDA runtime package when NVIDIA hardware is detected, otherwise uses the CPU build; executable and CUDA dependency archives require GitHub SHA256 asset digests before extraction.
- The installer bounds archive size, rejects ZIP path traversal, validates `llama-server.exe --version`, installs into a versioned user-data directory under `%LOCALAPPDATA%\\OneCoreAI\\runtimes\\llama.cpp`, serializes concurrent installs, and keeps the previous version until the new binary passes validation. Manual executable paths are preserved; the managed path is written automatically when no manual override exists.
- The AI settings page now exposes automatic install/update while retaining the editable executable path.
- Default application data and GGUF downloads now use one clean profile root: `~/.onecoreai` and `~/.onecoreai/models` (Windows: `%USERPROFILE%\\.onecoreai` and `%USERPROFILE%\\.onecoreai\\models`). No previous product profile is auto-detected or imported; settings and chat history can be copied manually.
- The encrypted fallback vault and OS keychain now use the OneCoreAI service namespace. Previous secret-store formats and keychain entries are not imported; users re-enter API keys and tokens in the new profile.
- Switching or deleting the model currently used by llama.cpp stops that runtime first. Selecting a model no longer falsely marks the inference server as ready.
- Removed the Tauri `externalBin` requirement because the repository did not contain the target-specific llama-server sidecar and the existing prepare script did not create it. Tauri now asks the managed Node backend to stop llama.cpp before closing that backend.
- **Not complete:** automatic installation currently supports Windows x64 only. Linux/macOS/ARM selection, visible byte-level download progress/cancellation, and an actual inference smoke test remain outstanding.
- **Verification status:** source changes were inspected through GitHub. No local `npm run lint`, `npm test`, `npm run build`, Rust/Tauri Windows build, or real Windows llama.cpp start/stop/chat test has been run. Do not mark Phase 12 complete until those checks pass.
- **Next step:** run repository CI and a Windows runtime smoke test on the user's PC with a real GGUF model, confirming the selected CUDA/CPU package, startup, inference, and shutdown.


## 12. Live system map and «КАК У ДРУГИХ» — first implementation slice

- Added `docs/architecture/LIVE_SYSTEM_MAP_AND_EXTERNAL_REFERENCES.md` as the contract for evidence-backed execution tracing and the isolated external research library.
- Extended persisted agent-journal events with optional typed trace metadata. Existing events without trace fields remain valid.
- Instrumented the existing project-agent orchestration entry points: project-context preparation, provider request rounds, and actual tool calls. Approved knowledge document ID/version is attached only when the corresponding read tool returns it.
- Added `GET /api/system-map`, which combines the in-memory operation snapshot with persisted journal events and explicitly reports route coverage.
- Reworked the Processes page into **Живая карта** and **Журнал событий** views. The live view groups events by actual operation ID, uses the existing SSE stream, and displays absent trace fields as not recorded.
- Added `server/externalReferences.ts` and CRUD endpoints for a local external-reference library stored in `~/.onecoreai/external-references.json` (or the configured `ONECORE_HOME`). Only HTTP/HTTPS source URLs are accepted; record content is size-bounded.
- Connected the library to **AI-ресурсы → Справочники**. The page displays the versioned ONE CORE knowledge catalog separately from **«КАК У ДРУГИХ»**. External records are not scanned by `knowledgeManager` and are not available to agent knowledge tools.
- Added integration tests for trace metadata compatibility and external-reference isolation.
- Updated the navigation and architecture indexes plus Phase 13 in the development plan.
- **Verification not yet performed:** no local TypeScript/lint, integration test, production build, or browser/runtime check has been run after these code changes. The checkboxes in Phase 13 describe implemented source changes, not passing runtime verification.
- **Known coverage limit:** the live map currently traces the project-agent orchestration routes only. Standard provider chat, broader task/pipeline/subagent execution, complete instruction binding, and Manager/Dispatcher orchestration remain uninstrumented or unimplemented.
- **Next step:** run `npm run check:encoding`, `npm run lint`, `npm test`, and `npm run build`; then exercise a real project-agent request and external-reference CRUD in the app.

## 12. Project terminal permission identifier consistency

- Fixed the ProjectModal terminal tool ID from `exec_command` to the backend's canonical `run_command` in the visible option, new-project defaults, and reset defaults.
- Existing project records containing the old `exec_command` value are normalized to `run_command` when opened in ProjectModal, preserving the permission selection previously shown to the user.
- Backend authorization remains unchanged and accepts only `run_command`; no compatibility alias was added to the permission manager.
- Added an integration regression assertion for the canonical UI ID and legacy-value normalization.
- Updated `docs/architecture/SECURITY_AND_APPROVALS.md` and `docs/architecture/API_SECURITY_MATRIX.md` with the canonical contract and migration behavior.
- Source changes are committed to `main`. Encoding, lint, tests, build, and runtime checks have not yet been run for this change set.


## 13. Provider settings consolidation and category migration

- The global provider-settings shortcut now navigates to the existing Providers page instead of mounting a modal editor.
- Provider categories are now **Local**, **Cloud**, **Compatible**, and **LlamaServer**. The custom OpenAI-compatible endpoint belongs to Compatible; the managed `llama-cpp` provider belongs to LlamaServer.
- Primary-agent model source and right-inspector runtime telemetry now distinguish the managed LlamaServer from generic compatible endpoints. GGUF model activation selects the LlamaServer category.
- Subagent provider category controls use the same four categories. Legacy persisted `runtime` selections are normalized by inspecting provider kind, including per-role provider profiles; provider IDs and provider records are preserved.
- Provider connection management no longer contains agent-role activation controls; role activation remains on **Агенты и роли**.
- Provider and local runtime model management are presented together as **Провайдеры / Модели**. The separate **LlamaServer** destination contains **Установка llama-server** and **Поиск моделей** subsections; the latter owns GGUF search, direct HTTP Range downloads, local-file import, and the model storage directory. The detected system profile is displayed in the right context panel with a dedicated GPU card and one compact card for the remaining hardware.
- The Model Router workspace within **Провайдеры / Модели** remains planned. It must own routing policy and resource-aware assignment; LlamaServer installation/search must not become a second orchestrator.
- Source changes and regression assertions are committed to `main`. Local encoding, TypeScript/lint, tests, production build, and browser/runtime verification for this change set are pending.


## 14. Compatible connections and LlamaServer model workspace

- Compatible now has a dedicated two-column workspace: existing endpoint profiles on the left and a compact add form on the right. New endpoints receive independent IDs and persist without replacing existing profiles. The compact right-side form supports adding and editing a profile with name, Base URL, optional API key, and optional model ID; leaving the key blank during editing preserves the stored credential. Each new or edited connection is checked after its initial settings save.
- The provider store now exposes `addFreeProvider`; compatible endpoints remain individual `FreeProviderProfile` records and use the existing server-side provider-ID secret storage.
- LlamaServer now has a dedicated workspace with GGUF model cards, model-library and process status indicators, a compact model/agent form, load/unload/delete actions, and refresh polling.
- Model assignment supports the primary agent and existing role-scoped subagent profiles. Loading a GGUF activates the model in the local catalog and starts the managed server without silently changing the primary agent's provider assignment. If the primary agent is already assigned to LlamaServer, its selected model is kept in sync. Agent assignment remains an explicit separate action. Unloading stops the shared server; deleting uses the existing protected local-model API and the application's delete-confirmation flow.
- Model cards distinguish catalog-active, runtime-in-memory, and agent-assigned states. External client counts are explicitly marked unavailable because llama-server client/request telemetry is not currently implemented.
- Runtime limitation: one managed llama-server process currently hosts one GGUF model at a time. Agent assignments do not create isolated runtime instances or implement full task-aware routing. The Model Router remains a separate planned capability.
- Added integration source assertions for the two workspaces, provider append action, agent-profile assignment, and protected model lifecycle actions.
- Changes are committed to `main`. Encoding, TypeScript/lint, integration tests, production build, and desktop/browser runtime verification for this change set are pending.
