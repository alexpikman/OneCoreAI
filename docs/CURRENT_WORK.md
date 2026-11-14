# Current Work

## Repository
- Project: ONE CORE AI
- Branch: `main`
- Version: `0.2.1`
- Stack: React 19, TypeScript, Vite 8, Zustand 5, Express, Tauri 2.

## Completed in the current stabilization batch
- Restored corrupted Russian text in the affected frontend files; added a CI encoding guard for mojibake, invalid UTF-8 replacement characters, and UTF-8 BOMs.
- Removed UTF-8 BOMs from the header component and Windows installer script.
- Added loopback Host validation and stricter same-origin checks using Origin and Fetch Metadata.
- Added canonical project path validation and rejection of absolute paths, traversal, and symbolic-link components; paths are rechecked before writes and undo restoration.
- Added a central project tool permission manager and enforced `read_file`, `write_file`, `run_command`, `git`, and `search_code` permissions in agent operations.
- Terminal commands, mutating Git operations, file writes, and undo now require explicit API approval.
- Agent-generated file changes and terminal commands remain pending until the user applies or runs them.
- Added regression tests for untrusted origins, path traversal, symlink escapes, unapproved actions, and project tool allowlists.
- Added Windows Credential Manager access through the native Windows Credential API, macOS Keychain support, and Linux Secret Service integration; application settings now use OS credential storage where available.
- Added CI on Linux and Windows for encoding checks, type-checking, integration tests, and production builds.
- Restricted Windows installer release workflow to version tags or manual dispatch.
- Changed the first-run UI default to the light Mica preset and aligned the browser/PWA startup colors; existing saved theme preferences remain intact.
- Bundled Manrope and DM Mono locally and removed remote Google Fonts requests.
- Added project governance and continuation documents.
- Reworked the global header: the agent avatar/name remains visible across routes, active provider/model and ACT/PLAN are shown, and role switching is limited to chat.
- Replaced the old chat/code toolbar selector with ACT/PLAN; moved the project path and Browser, Terminal, Subagent, Areas & Style, and Checkpoints actions into the requested order.
- Grouped provider/API model settings, local model/runtime settings, roles/pipeline, and skills/memory/subagents under one MODELS section.
- Made LOCAL, CLOUD, and RUNTIME mutually exclusive for the primary agent and synchronized the active provider/model with the selected category.
- Removed the duplicate provider selector from the right inspector; local runtime telemetry and inference controls now appear only for a connected selected RUNTIME provider.
- Added a separate LOCAL/CLOUD/RUNTIME provider/model configuration for the subagent subsystem; subagent API keys are stored under separate OS-vault references and blanked in the JSON settings manifest.
- Removed obsolete mascot/provider-card visibility toggles after consolidating the header and provider controls.

- Added the project-agent contract defining a project as a persistent workspace with source files, plan, task list, permissions, and action history. The shared contract and active project metadata are injected into both the global primary agent context and the dedicated project-agent prompt.
- Requests to list, create, and execute project tasks route to the project agent. ACT-mode structured responses can create tasks and update existing task statuses; PLAN mode is explicitly read-only. Task state refreshes after agent actions. File edits and shell commands remain pending approval proposals.
- Project context retrieval ranks files against the current request and includes the most relevant files instead of relying only on alphabetical order.
- Added provider-reported prompt/completion/total token usage, session totals, and a model capability self-assessment endpoint that runs automatically when the selected model or project changes. The right inspector separates model-reported claims from actual OneCoreAI tool availability and project permissions; file deletion, SSH execution, and direct GitHub actions remain unavailable until dedicated tools are implemented.
- Added right-inspector indicators for project/task state, token usage, estimated file context, model-reported and configured context windows, and local memory telemetry. VRAM is explicitly labelled as a model-profile estimate, system RAM as OS-wide usage, and exact per-process model memory as not yet measured. Cloud model memory is not observable.

## Verification status
- Changes are committed directly to `main`; no feature branch or pull request was created.
- GitHub Actions run `43575007954` completed successfully on both `ubuntu-latest` and `windows-latest`.
- Both CI jobs passed encoding checks, TypeScript type-checking, integration tests, and production builds. The added tests cover provider token usage, model capability probing, project-task intent routing, and task-state refresh.
- The malformed command string in an existing integration test was corrected so the CI type-check could run.
- Local npm commands were not run in this environment; verification was performed by the Linux and Windows CI runners.

## Remaining work
- Implement a session/token authentication layer for local API requests. Origin validation protects browser boundaries but is not authentication against other local processes.
- Stop returning secret values in `/api/settings`; route provider requests through server-side secret references instead.
- Extend centralized permission enforcement to model management, SSH, browser/network actions, project deletion, and all other side-effect endpoints.
- Strengthen fallback vault key derivation for environments without an available OS credential service; preserve existing encrypted-vault migration compatibility.
- Verify Windows Tauri startup, sidecar bundling, installer generation, Credential Manager persistence, and runtime behavior.
- Audit remaining SSRF, file browser, model download, and provider proxy routes.
- Complete UI route, navigation, responsive, typography, and accessibility audit.

Do not mark the project production-ready until the remaining security work and Windows packaging checks are complete.
