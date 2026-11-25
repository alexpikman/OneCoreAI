---
id: protocol.file-content-provisioning
version: 1.0.0
status: draft
owner_role: architect
triggers:
  - file_context_provisioning
  - task_handoff_context
  - read_project_file
---

# File Content Provisioning Protocol (Draft)

## Purpose

Defines deterministic file context provisioning, per-worker evidence tracking, budget enforcement, content-aware deduplication, and cancellation handling without mutating public `AgentHandoff v1` or `WorkerResult v1` schemas.

## Scope and Lifecycle Alignment

- Applies to task context assembly before `Worker` execution and to file read tool calls (`read_project_file`) during execution.
- Does not redefine existing `OPERATION_LIFECYCLE.md` states (`EXECUTING_TOOL` remains execution of an approved tool; context provisioning runs as an explicit step within the execution flow).
- Uses existing `operationRegistry.ts` (`operationId`, `parentOperationId`, `AbortSignal`, `cancelOperation`, terminal `CANCELLED`) rather than a separate cancellation mechanism.
- Coordinates `needs_more_context` retries within the existing `MAX_CYCLES = 4` orchestrator loop (at most `2` re-request iterations per subtask).

## Data Flow and Priority

1. `Dispatcher` provides task-specific `files` in `PlannedSubtask`.
2. Context provisioning prioritizes `task.files` over the project-wide manifest (`initialFilesManifest` is fallback only when `task.files` is empty).
3. Prepared file entries and `excerpts` (`startLine`, `endLine`, `content`) are passed to the `Worker` prompt/context rather than stripped to paths and evidence flags alone.
4. When a valid prepared context package is provided (`skipInitialDiscovery`), `Worker` execution does not unconditionally re-run full heuristic initial project context discovery.

## Provenance and Evidence Registry

- Public contracts (`AgentHandoff v1`, `WorkerResult v1`, `validateWorkerResult()`) remain backward-compatible without automatic schema breaking changes.
- An internal `Evidence Registry` tracks per-`Worker` provenance without sharing mutable state across parallel `Worker` instances:
  - `workerId`, `taskId`, `operationId`, `parentOperationId`
  - normalized `path`
  - `provenanceKind`: `provided` | `read` | `searched` | `listed`
  - line range (`startLine`, `endLine`) where applicable
  - `contentHash` computed over the actual fragment content
- `provided` means content was supplied in context; it does not automatically count as independent `read` unless explicitly permitted by `filesInspected` rules. Parent reads (`verifiedReadPaths`) are never copied into a `Worker`'s own read evidence.
- `validateWorkerResult()` checks `filesInspected` against the `Evidence Registry` for the target `Worker`, rejecting unconfirmed paths or cross-worker evidence leakage.

## Budgets and Limits

Configuration separates distinct limits instead of conflating them:

- Source file size cap (`readProjectFile`): `2 MiB` (current `fs.readFileSync` cap).
- Searchable file size cap (`searchProjectCode`): `512 KiB`.
- Single excerpt / tool read output cap: `24 000` chars (with truncation flag/metadata when exceeded).
- Handoff / `Worker` context budget: configurable file count cap, excerpt character cap, and total `Worker` context budget across initial excerpts and tool reads, prioritizing `task.files` over fallback files.

When a budget is exceeded or a file is omitted/truncated:
- Explicitly record omitted/truncated files and reasons instead of silently treating partial context as complete.
- Allow the `Worker` to request needed ranges via the standard file-reading tool within tool round and total context limits.

## Deduplication and Loop Guard

- Cache/deduplication key includes fragment content: `(taskId, normalizedPath, startLine, endLine, contentHash)`.
- Matching `contentHash` for an already-provisioned fragment in the active scope may return an `already_in_context` marker instead of duplicating content.
- Changed `contentHash` (file modified during operation) invalidates stale cached content and provisions the updated fragment.
- Missing/unreadable/out-of-bounds/symlink files return explicit structured errors (`not_found`, `access_denied`, `invalid_path`, `size_exceeded`).
- Bounded cache entry count and TTL prevent unbounded memory growth.
- `needs_more_context` is capped (at most `2` context re-request iterations per subtask within `MAX_CYCLES = 4`); exceeding the cap transitions to `blocked` rather than looping indefinitely.

## Cancellation Semantics

- Child operations inherit cancellation signals linked to the parent operation while keeping local cancellation isolated to that child (`Worker` cancellation does not cancel sibling tasks unless parent cancellation is requested).
- Because `readProjectFile()` uses synchronous `fs.readFileSync()`, cancellation must be checked before starting a read and immediately after completion, alongside async/provider `AbortSignal` handling.
- Cancelled operations transition cleanly to terminal `CANCELLED` (not `FAILED` or `BLOCKED`) and release timers, listeners, and handles.
