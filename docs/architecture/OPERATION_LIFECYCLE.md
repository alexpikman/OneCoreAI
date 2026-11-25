# Operation Lifecycle

**Status: partially implemented — the runtime slice below is active; the remaining contract is still a target.**

This document defines the lifecycle of long-running operations across chat, project execution, pipeline stages, terminal commands, Git actions, and subagents. It separates implemented behavior from requirements that are not yet guaranteed end-to-end.

## 1. Operation identity

Every independently cancellable unit of work should have:

- a unique `operationId`;
- an optional `parentOperationId`;
- an explicit operation kind and owning project/session where applicable;
- a start timestamp;
- a terminal outcome and completion timestamp;
- a cancellation source/reason when cancelled.

An operation ID identifies one execution, not merely a UI message or reusable task definition.

## 2. Lifecycle

```text
CREATED
  -> QUEUED
  -> RUNNING
       -> WAITING_FOR_APPROVAL
       -> EXECUTING_TOOL
       -> VERIFYING
  -> COMPLETED | FAILED | CANCELLED
```

Not every operation uses every intermediate state. A read-only request may not enter approval; a side effect requiring approval must not execute before approval.

Terminal states are final for that operation instance. A retry creates a new operation instance and links it to the same logical task where applicable.

## 3. State meanings

| State | Meaning |
|---|---|
| `CREATED` | Request accepted and assigned an operation identity |
| `QUEUED` | Waiting for an execution slot |
| `RUNNING` | Work is actively being performed |
| `WAITING_FOR_APPROVAL` | A specific side effect is pending user approval |
| `EXECUTING_TOOL` | An approved tool is executing |
| `VERIFYING` | The system is checking the actual result |
| `COMPLETED` | Operation-specific completion checks passed |
| `FAILED` | Work ended unsuccessfully or verification failed |
| `CANCELLED` | Cancellation was requested and execution has stopped at its supported cancellation boundary |

A timeout is not automatically equivalent to successful cancellation. The runtime must confirm that the underlying request/process has stopped before reporting a fully stopped operation.

## 4. Cancellation propagation

Target requirements:

1. Each operation owns an `AbortController` or equivalent cancellation primitive.
2. A child operation receives a signal linked to its parent while retaining its own local cancellation control.
3. Cancelling one child must not cancel siblings.
4. Cancellation should reach the blocking resource where that resource supports interruption.
5. Streaming reads need an idle timeout between chunks, not only a timeout for receiving response headers.
6. Process cancellation must account for the complete process tree. On Windows, do not assume `child.kill()` terminates descendants; use a tree-aware strategy and verify process exit.
7. Cleanup of timers, listeners, readers, and process handles must run on success, failure, timeout, and cancellation.

Implemented runtime slice: `server/operationRegistry.ts` owns an `AbortController` per registered operation, links registered children to parents, preserves child-local cancellation, and exposes `cancelOperation`. The protected API exposes operation list/detail/cancel routes. Cancellation signals reach general-agent/provider requests, project command execution, and the team Worker execution path. The team Worker combines its child signal with the parent signal; a child-local cancellation does not cancel sibling Workers.

File reads in `server/projectAgent.ts` use synchronous `fs.readFileSync()`. Their `AbortSignal` is checked before the read and immediately after it returns; the synchronous system call itself cannot be interrupted. Team Workers are executed sequentially, not concurrently.

This implementation does not yet guarantee process-tree termination on Windows, streaming idle-timeout enforcement, or cancellation across every pipeline execution path.

## 5. Parent/child operations

Examples:

- A project task may create a model request and then one or more tool operations.
- A pipeline run may own a sequence of stage operations.
- A team run creates a child operation for each Worker execution.

For team execution, the generated Worker `childOpId` is both the child's `operationId` and the internal `workerId` used to scope its Evidence Registry. A `needs_more_context` retry creates a new child operation ID while retaining the same `taskId` and team parent operation ID. Each attempt has an isolated evidence scope. Worker execution is currently sequential.

The parent should not report completion while required children are still active. Parent cancellation requests cancellation of active descendants. Child-local cancellation leaves unrelated siblings running.

## 6. Approval is a pause, not execution

An operation that requires approval enters `WAITING_FOR_APPROVAL`. The approval record should identify:

- the operation and exact proposed action;
- the affected project/resource;
- the requested permission scope;
- the approving user action and timestamp;
- the eventual execution result.

Approval must be revalidated by the backend at execution time. A stale UI state or a model-generated statement is not approval.

## 7. Verification gate

An operation is complete only after its result is checked against operation-specific criteria:

- **File write:** the current gate verifies that the destination is a regular file and its persisted bytes match the requested content. Optimistic concurrency/stale-proposal rejection is still outstanding.
- **Command:** the current gate records verification checks for exit code, timeout, and cancellation. Semantic output/acceptance checks remain operation-specific and are not yet implemented.
- **Git:** post-action repository-state verification remains a target.
- **Pipeline stage:** verify its declared output artifact or explicit acceptance criteria, not only that the model returned text.
- **Project task:** require evidence tied to the task's acceptance criteria before treating it as verified complete.

The current project task status type is `todo | in-progress | done`; this design does not silently change that persisted contract. Task acceptance-criteria evidence and pipeline artifact checks are not yet enforced. A richer verification state requires a separately reviewed migration/API/UI plan.

## 8. Recovery and idempotency

Future runtime work should define:

- how in-progress operations are marked after an application crash;
- which operations can be safely retried;
- how duplicate submissions are detected;
- which side effects require idempotency keys;
- how incomplete approvals and orphaned child operations are reconciled.

The current journal stores events, but should not be described as crash-safe operation recovery until these behaviors are implemented and tested.

## 9. File context provisioning

Team execution prepares bounded file context for each Worker before invoking the general agent. Task-specific `PlannedSubtask.files` take precedence over the project manifest; the manifest is the fallback when the task list is empty. Initial excerpts and subsequent tool reads share the Worker's 40,000-character budget.

The context-provisioning protocol defines the exact limits, SHA-256 fragment deduplication, per-Worker evidence rules, retry policy, and synchronous-read cancellation boundary: [File Content Provisioning Protocol](../knowledge/protocols/file-content-provisioning.md).

The protocol's current runtime constraints include a maximum of 8 handoff files, 16,000 initial excerpt characters, 6,000 excerpt characters per file, 24,000 characters per tool read, a 512-entry cache with a 5-minute TTL, and at most two `needs_more_context` retries per `taskId` within the four-cycle orchestrator cap. Retries require `maxCycles >= 3`; the default is 1.
