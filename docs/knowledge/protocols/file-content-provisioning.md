---
id: protocol.file-content-provisioning
version: 1.0.0
status: approved
owner_role: architect
triggers:
  - file_context_provisioning
  - task_handoff_context
  - read_project_file
---

# File Content Provisioning Protocol

## Purpose

Defines the implemented file-context provisioning and evidence rules for team Workers, including bounded context, fragment deduplication, retry limits, and cancellation. This protocol describes the runtime behavior implemented in Stages 0–6; it does not change the public `AgentHandoff v1` or `WorkerResult v1` contracts.

## Scope and lifecycle alignment

- Context is assembled during `runTeamExecution()` before each Worker starts. Subsequent file reads use the existing `read_project_file` tool in `executeGeneralAgentTask()`.
- The team operation is the parent. Each Worker receives a newly generated `childOpId`; that value is used as the Worker's `operationId` and as `provisionedContext.workerId` (the Evidence Registry identity).
- The child's `parentOperationId` is the team operation ID. A retry retains the same `taskId` and parent operation, but creates a new child operation ID and a fresh per-Worker evidence scope.
- The implementation uses the existing operation registry and `AbortSignal`; it does not introduce a second operation or cancellation registry.
- See [Operation Lifecycle](../../architecture/OPERATION_LIFECYCLE.md) for operation states and parent/child cancellation.

## Context selection and handoff

1. Dispatcher-provided `PlannedSubtask.files` takes precedence when non-empty.
2. If `task.files` is empty, the project-wide `initialFilesManifest` is used as fallback.
3. Only paths present in the initial manifest can be selected for the task-specific handoff; this stage does not independently discover arbitrary paths from the task list.
4. File excerpts, including their line metadata and content, are preserved in the handoff and Worker prompt.
5. A Worker receiving `provisionedContext` skips the general agent's heuristic initial project discovery. The ordinary `executeGeneralAgentTask()` path without `provisionedContext` retains its existing behavior.
6. Files supplied in the handoff are context provisioned by the application. They are not proof that the Worker independently read those files and are not added to `filesInspected` on that basis.

## Evidence Registry and provenance

The Evidence Registry is an internal, per-Worker execution scope. Its identity is the Worker's `childOpId` (`workerId`). It is not a field in either public v1 schema.

- Each Worker starts with its own confirmed-read and confirmed-search tracking. Parent `verifiedReadPaths` are not copied into the Worker's confirmed-read set.
- `provided` content means an excerpt was supplied in the handoff. It is distinct from a Worker tool read.
- A path is eligible for `filesInspected` only when confirmed by the Worker execution's own successful `read_project_file` call and accepted by `validateWorkerResult()`.
- Search results are tracked separately from confirmed reads. Listing a path or receiving an excerpt does not establish an independent read.
- Workers are currently executed strictly sequentially by `teamOrchestrator.ts`. Evidence scopes are isolated per Worker; parallel Worker execution is not implemented.
- Internal provisioning and evidence state do not mutate `AgentHandoff v1`, `WorkerResult v1`, or their validators' public schemas.

## Budgets and limits

The implemented limits are constants in `server/orchestration/contextBuilder.ts` and the file-reading path:

| Limit | Value | Enforcement |
|---|---:|---|
| Maximum source file size for `readProjectFile()` | 2 MiB | A larger file is rejected before reading |
| Maximum searchable file size in `searchProjectCode()` | 512 KiB | Larger files are not searched |
| Maximum excerpt content per file | 6,000 characters | Excerpts are truncated and omissions recorded |
| Maximum excerpt content per handoff | 16,000 characters | Shared across files in the handoff |
| Maximum files in a handoff | 8 | Additional files are recorded as omitted |
| Maximum output of one file-tool read | 24,000 characters | Tool output is bounded |
| Maximum total Worker context | 40,000 characters | Includes initial excerpts and subsequent file-tool reads |

The remaining Worker budget is initialized as 40,000 minus the actual initial excerpt character count. Subsequent file-tool reads consume that remaining budget. A read with no remaining budget fails rather than silently extending the context.

When a file or excerpt is omitted or truncated, the provisioning context records the path and reason. An excerpt-only handoff does not silently count as a complete file read.

## Fragment hashing and deduplication cache

- A fragment's SHA-256 hash is calculated from the full requested line fragment's UTF-8 content.
- The cache identity is the tuple `(taskId, normalizedPath, startLine, endLine, contentHash)`. The content hash is part of the cache key; the task/path/range identity is also tracked to replace a stale version when the fragment changes.
- The cache is bounded to 512 entries and has a 5-minute TTL. A cache hit refreshes that entry's TTL.
- The file is read and the current fragment hash is calculated before the cache lookup. The cache therefore deduplicates unchanged fragment content; it does not avoid the underlying file read.
- When the hash changes for the same task/path/range, the previous cached fragment is discarded and the current content is returned as a miss.
- The tool response includes `contentHash`, `cacheHit`, and `truncated` metadata.

## File read failures and path safety

- Project-relative paths are validated to remain inside the project root; symbolic links are rejected.
- A path that does not resolve to a regular file is rejected.
- Missing paths, access-denied paths, oversized files, and invalid line ranges produce explicit read errors. These are tool errors, not successful empty reads.
- Search skips binary or unreadable files; cancellation is propagated rather than treated as an ordinary skipped file.

## needs_more_context retry policy

- The orchestrator runs no more than `MAX_CYCLES = 4` cycles. The caller's `maxCycles` is clamped to the range 1–4 and defaults to 1.
- Each `taskId` may request at most 2 additional context attempts. A retry is scheduled for a subsequent cycle and is prioritized ahead of newly planned tasks.
- Reaching two retries requires at least three available cycles (`maxCycles >= 3)); the default `maxCycles = 1` does not provide retry cycles.
- Every retry uses a new `childOpId`/`workerId`, keeps the original `taskId` and team `parentOperationId`, and receives a separate Evidence Registry scope.
- A further `needs_more_context` result after the two permitted retries is converted to `blocked`. The retry count is scoped to the current team execution and keyed by `taskId`.

## Cancellation semantics

- The parent team signal is linked to active Worker execution. A child operation also has its own cancellation signal; cancelling that child does not cancel sibling Workers.
- The Worker passes the child signal (combined with the parent signal when present) to `executeGeneralAgentTask()`.
- `readProjectFile()` checks the signal before path resolution/read and immediately after `fs.readFileSync()`. The synchronous filesystem call itself cannot be interrupted; cancellation is observed at the next check after it returns.
- A cancelled Worker is represented as `cancelled`, not reclassified as `failed` or `blocked`. The operation registry records the terminal `CANCELLED` state.
- Cancellation does not imply that a synchronous read was interrupted mid-call.

## Public contract boundary

The protocol is internal orchestration guidance. `AgentHandoff v1` and `WorkerResult v1` remain the public interchange contracts. Internal context packages, cache state, Evidence Registry identity, and retry bookkeeping are not added to those schemas.
