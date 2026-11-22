# Architecture Implementation Status

This is a source-based snapshot, not a promise of feature completeness. Update it after checking the current `main` code and tests.

## Implemented

- React/TypeScript frontend with Zustand state.
- Express/TypeScript local API and Tauri 2 desktop shell.
- Prompt routing into chat, browser, terminal, and project categories.
- PLAN/ACT mode inference and UI state.
- Standard provider chat streaming.
- Server-side provider request cancellation when the downstream client disconnects, provider response timeout, and streaming idle timeout.
- Project workspace records, one optional plan per project, project-scoped task storage, and project action logs.
- Global Tasks UI/API aggregation over project-owned task records, with project/status/search filters and project-scoped CRUD.
- Global Processes UI with a live operation/event timeline and a separate flat journal view. The map combines the in-memory operation snapshot with persisted journal events and consumes the journal SSE stream; filters apply to both views.
- Projects UI with a full-width project list, right-side context cards, and a modal editor for the project's single plan.
- Project tool allowlist checks.
- Bearer-session API authentication: 12-hour sessions, SHA-256 token-hash storage, protected-route checks, and native-issued token access in packaged Tauri. Browser development/Tauri debug bootstrap remains Origin-trusted and is not equivalent to authenticating an arbitrary local process.
- Approval checks on a growing set of side-effect routes, including file writes, terminal commands, mutating Git, undo, selected model-management actions, project deletion/directory creation, selected SSH checks, browser search/read, and GitHub/Telegram verification. The client confirmation signal is still a boolean/header, not a cryptographically bound approval ticket.
- Agent journal event recording, bounded persistence, SSE publication, and optional typed trace metadata.
- Isolated local external-reference library with HTTP/HTTPS URL validation, bounded text fields, and CRUD API. External records are stored under the ONE CORE user-data home and are not loaded as agent knowledge.
- Model capability reporting separated from actual application tool availability.

## Partial

- **Processes view:** the live map and flat journal are projections over the existing operation registry and agent journal. There is still no separate persisted Process domain entity. Live journal updates use the existing shared SSE stream; the operation registry snapshot itself refreshes when the map is reloaded.

- **Operation registry and journal:** journal events have operation IDs and running/completed/failed/cancelled statuses plus optional parent-operation, session, and chat-message links. Main chat, subagent, and browser slash-command requests propagate those links; project file reads and logged project actions inherit request-scoped context; chat renders a per-message SSE activity timeline. A bounded in-memory API operation registry tracks request lifecycle separately from persisted journal history and supports operation lookup/cancellation plus parent/child links. Full orchestration-wide lifecycle semantics and restart recovery remain incomplete.
- **Cancellation:** standard chat cancellation is implemented end-to-end through a UI stop action, AbortController, upstream provider disconnect, and cancelled journal/registry status. Project tasks, pipeline stages, subagents, and subprocess trees do not yet share this cancellation contract.
- **Subagents:** runs and journal events exist, but they are not yet a general child-operation runtime with shared tool execution and independent cancellation semantics.
- **Pipeline:** stages are sequenced and status is displayed; stage completion currently follows a successful model response, not verification of a declared artifact.
- **Project agent:** reads a bounded subset of files and returns structured results, but this is not a general autonomous tool loop.
- **Verification Gate:** post-action checks exist for persisted file writes, file undo/removal outcomes, and command exit/timeout/cancellation results. This is partial coverage, not a universal verification gate; Git post-state, model/runtime changes, pipeline artifacts, and task acceptance criteria are not uniformly verified.
- **Permissions and API security:** loopback Host/Origin/Fetch Metadata guards, bearer-session authentication, and a project tool allowlist exist. Browser development/Tauri debug session bootstrap still trusts Origin; packaged Tauri obtains a native-issued token. Selected side-effect routes check client-supplied approval signals (`approved: true` or `X-OneCore-Approval: user-confirmed`), which are not cryptographically bound to a session and payload. No one-time Approval Ticket protocol exists. The endpoint-by-endpoint audit is in API_SECURITY_MATRIX.md.
- **File integrity:** project path containment exists, but file writes do not use server-computed optimistic concurrency fingerprints or stale-write 409 responses.
- **Execution environments:** configuration includes Local/SSH/Docker concepts; actual execution semantics must be checked per route before treating each mode as supported.

## Performance requirements

- Security middleware, token/ticket checks, and payload hashing must stay off disk/network I/O on the request hot path.
- Save/apply latency must be measured before and after changes; do not report success before the required persistence guarantee is met.
- Journal persistence should be bounded and must not block unrelated API requests or silently discard failures.
- Preserve streaming timeouts and disconnect cancellation while optimizing.

## Planned

- Complete the operation lifecycle across all orchestrators and external-operation types.
- Enforce parent/child completion semantics and scoped cancellation consistently.
- Cancellation of provider reads and subprocess trees with Windows-aware process termination.
- Idle and total timeouts for every long-running external operation.
- Replace Origin-trusted browser development/Tauri debug bootstrap with a process-authenticated session mechanism.
- One-time, session- and payload-bound Approval Tickets for Class C operations.
- Optimistic locking for file diff application.
- Extend verification gates to Git post-state, model/runtime changes, pipeline artifacts, and project-task acceptance criteria.
- Recovery policy for interrupted operations and idempotent retries.
- Explicit unsupported-mode errors for execution backends that are not implemented.

## Unverified in this documentation pass

- Runtime behavior of all cancellation and timeout edge cases on Windows.
- Process-tree termination and absence of orphaned descendants.
- Exact behavior of every SSH/Docker execution path.
- Runtime behavior of the proposed Local Session Token bootstrap in Tauri desktop and browser development.
- Full endpoint-by-endpoint authorization and approval coverage; see API_SECURITY_MATRIX.md.
- Crash recovery behavior for in-progress journal entries.

## Important distinction

A planned lifecycle state, capability, or safeguard described in these documents must not be shown in the UI or reported to users as implemented until code and tests prove it.


## Live system map coverage

- **Implemented, partial coverage:** the system-map API joins current in-memory operation records with persisted journal events. Processes renders operation groups and chronological events, with live journal updates over the existing SSE endpoint.
- The current project-agent routes emit structured events for context preparation, provider request rounds, and tool calls. Reading an approved knowledge document records its stable ID and version when returned by the knowledge tool.
- Existing events without trace metadata remain valid. The UI displays missing actor, instruction, handoff, input, or output data as not recorded.
- **Not implemented / not instrumented:** standard provider chat tracing, full task/pipeline/subagent route coverage, complete instruction-to-stage binding, authoritative model/tool payload provenance, and Manager/Dispatcher orchestration. The live map must not present these as active stages.

## External research library

- **Implemented:** «КАК У ДРУГИХ» is available inside AI-ресурсы → Справочники, separately from the versioned ONE CORE knowledge catalog.
- External records are stored in `external-references.json` under the configured user-data home. The API validates absolute HTTP/HTTPS URLs and bounds text fields and tags.
- External research records are not scanned by `server/knowledgeManager.ts`, are not returned by approved-knowledge retrieval, and are not exposed through the agent knowledge tools.
- **Not implemented:** automatic source crawling, diagram extraction, attachment ingestion, or promotion workflow from an external reference into approved ONE CORE instructions.
