# Architecture Audit and Stabilization Roadmap

Audit basis: source and documentation fetched from main on 2026-11-14; follow-up implementation checked on 2026-11-15.
Scope: compare target contracts with current implementation and define small, independently verifiable work packages.
Application code changes: none.

This is a focused audit of operation lifecycle, cancellation, approvals, file safety, verification, journal, and execution environments. It is not a complete penetration audit of every API route.

## 1. Executive summary

The application already has useful foundations: provider streaming, downstream-disconnect cancellation on the standard provider endpoint, project-root path checks, a project tool allowlist, explicit approval checks on several side-effect routes, action logs, and an SSE-backed agent journal.

The main gap is that these safeguards are implemented locally in individual paths. They do not yet form one end-to-end operation contract shared by chat, project tasks, pipeline stages, subagents, terminal commands, and Git.

Confirmed gaps:

1. Local API trust: Host/Origin checks exist, but session/token authentication remains an open item in DEVELOPMENT_PLAN.md. The settings route returns readAppSettings(); secret minimization also remains open.
2. Process termination: project command timeout calls child.kill('SIGTERM'). It does not implement Windows process-tree termination or verify descendant exit.
3. File concurrency: file writes capture previous content for the action log but do not compare a source fingerprint at apply time. Stale proposals can overwrite newer edits.
4. Cancellation: the standard provider route supports downstream disconnect and timeout cancellation, but the main chat reader, pipeline calls, and subagent calls do not pass an AbortSignal.
5. Operation model: journal events have operation IDs and statuses, but there is no operation registry, parent/child relationship, cancelled status, or recovery protocol.
6. Verification: a pipeline stage becomes done after the model returns non-empty text. Its declared output artifact is not checked.
7. Execution environment: /env ssh and /env docker update client-side selection. The inspected command action still calls the local project exec route, whose executor launches PowerShell or /bin/sh.
8. Approval coverage: file writes, terminal commands, selected mutating Git operations, and undo have checks. Project deletion and task CRUD handlers do not show equivalent approval checks. The development plan already lists extending permission coverage as unfinished.

## 2. Findings by target contract

### 2.1 Operation identity and lifecycle

Evidence:
- src/types/onecore.ts defines AgentJournalEvent with id, operationId, timestamp, optional parentOperationId/sessionId/messageId, and statuses running/completed/failed/info.
- server/agentJournal.ts records events, maintains a bounded cache, asynchronously persists a JSON snapshot, and publishes SSE events. Request-scoped AsyncLocalStorage propagates operation metadata into server-side project events.
- Main chat and subagent requests send operation/message/session identifiers; project file reads and project action-log events inherit the originating operation context.
- CenterAgentPane renders matching journal events as an expandable activity timeline under the originating assistant message; AgentJournalView exposes parent-operation and message IDs.
- server/operationRegistry.ts maintains a bounded in-memory lifecycle record for API requests with parent/session/message metadata, start/finish timestamps, duration, and running/completed/failed/cancelled status. The journal remains the persisted event history.

Assessment: PARTIAL. Chat-level event correlation and per-message display are implemented for the main chat, subagents, project file/action events, and browser slash-command requests. Standard chat now supports user cancellation through AbortController; the provider connection is closed and the server records cancelled state in both the journal and in-memory operation registry. Project tasks, pipeline stages, subagents, restart recovery, and complete parent/child lifecycle semantics remain outside this slice.

Next: Stage 4 standard-chat acceptance is covered by integration tests. Proceed to Stage 5 — pipeline and subagent child operations — one operation family at a time.

### 2.2 Cancellation and timeout propagation

Evidence:
- server/app.ts provider chat route creates an AbortController, aborts when the downstream response closes, applies a 30-second provider response timeout and a 60-second streaming idle timeout.
- src/store/useOneCoreStore.ts standard chat creates an AbortController, passes its signal to the provider request, and exposes a stop action while that request is active.
- The server middleware marks a request cancelled when the downstream connection closes before the response finishes; the operation registry and journal receive the terminal cancelled state.
- Pipeline and subagent provider calls do not pass a signal.
- server/projectAgent.ts execProjectCommand spawns PowerShell on Windows or /bin/sh elsewhere. On timeout it calls child.kill('SIGTERM'); no tree-aware termination or descendant verification is implemented.
- runProjectGit applies a timeout to the main Git invocation, but git add -A in the commit path has no explicit timeout in the inspected call.

Assessment: PARTIAL. Standard chat cancellation is end-to-end from the UI to the provider connection and terminal journal/registry state. Project tasks, pipeline/subagent calls, and process-tree cancellation remain unimplemented.

Next: implement Stage 5 child-operation cancellation and parent/child lifecycle semantics for pipeline and subagents. Keep subprocess tree termination as a separate platform-specific work package.

### 2.3 Parent/child operations and subagents

Evidence:
- Subagent runs are stored in Zustand and journaled through the agent-journal API.
- The subagent request is a direct provider call; it has no parent operation ID, cancellation signal, or shared tool-execution context in the inspected path.
- SubagentRun has no cancelled terminal status.
- Pipeline stages run sequentially but are not represented as child operations of a pipeline operation.

Assessment: PARTIAL UI/run tracking; NOT IMPLEMENTED as a hierarchical runtime.

Next: implement parent/child metadata and cancellation tests in the operation layer. Do not grant subagents new tools as part of this step.

### 2.4 Approval and permission enforcement

Evidence:
- server/permissionManager.ts centralizes project allowlist checks for read_file, write_file, run_command, git, and search_code.
- server/app.ts checks explicit approval for file writes, terminal execution, selected mutating Git actions, and undo.
- The client sends approved: true from actions invoked after the user accepts a proposal. The backend checks the boolean, but it is not a cryptographically bound approval record tied to an authenticated session and concrete action payload.
- Project DELETE and task create/update/delete handlers do not show equivalent explicit approval checks in the inspected routes.
- DEVELOPMENT_PLAN.md explicitly leaves model management, SSH, browser/network actions, project deletion, and remaining side effects for permission audit.

Assessment: PARTIAL. Existing checks are useful, but coverage is incomplete and local API callers are not authenticated by a session/token layer.

Next: inventory every mutating route and classify it read-only, user-confirmed, or internal-only. Add route-level regression tests before changing behavior.

### 2.5 File-write optimistic locking

Evidence:
- writeProjectFile reads current file content for the action log, creates the parent directory, revalidates the path, then writes new content.
- The write API accepts path/content/summary/approved; it does not accept an expected SHA-256 fingerprint.
- DiffProposal contains old/new content but no source hash.
- The write path does not compare current content with the content from which the proposal was generated.

Assessment: NOT IMPLEMENTED. Path containment exists; stale-write protection does not.

Next: add an additive fingerprint field to the proposal contract, test conflict behavior, then wire the client apply action. On mismatch, return HTTP 409 and leave the file untouched. Represent a previously absent file explicitly so new-file proposals remain supported.

### 2.6 Verification gate

Evidence:
- Terminal results include exit code and timeout flag; Git returns stdout/stderr/exit code; project file writes are action-logged.
- Pipeline stage status changes to done after a successful non-empty model response. The declared outputArtifact is included in the prompt but is not checked by the stage action.
- Project task status remains todo/in-progress/done; no evidence or acceptance-criteria field is present in the shared type.
- Journal completed status records an event, not proof that an operation-specific acceptance condition passed.

Assessment: PARTIAL for individual command results; NOT IMPLEMENTED as a shared verification gate.

Next: define verification adapters for existing result types without changing task persistence. Start with pipeline output criteria and command result classification.

### 2.7 Execution environments

Evidence:
- ExecutionEnvKind is local/ssh/docker and the store can change activeEnv.
- The /env command changes this client-side selection.
- The inspected execDirectCommand always posts to /api/projects/:id/exec.
- execProjectCommand chooses local PowerShell or /bin/sh; it does not branch on selected SSH/Docker environment.

Assessment: UI configuration exists; execution routing is NOT IMPLEMENTED in the inspected command path.

Next: until real executors and contracts exist, prevent SSH/Docker selections from silently executing locally. The exact UX (disable, warning, or explicit NotImplemented response) needs agreement before UI changes.

### 2.8 Journal persistence and recovery

Evidence:
- server/agentJournal.ts stores up to 5,000 events, writes snapshots asynchronously through a promise queue, and publishes events to SSE subscribers.
- Persistence errors are swallowed by the queue catch.
- Event status has no cancelled state.
- There is no inspected startup reconciliation for events left running after a crash, idempotency-key contract, or operation retry policy.

Assessment: PARTIAL event journal; NOT IMPLEMENTED recovery.

Next: specify persistence-failure visibility and restart reconciliation before using the journal as operation truth.

## 3. Prioritized implementation sequence

Each package is intended to be independently reviewable and revertible. Do not combine a data migration, UI redesign, and runtime rewrite in one package.

### Stage 0 — Baseline and contract freeze

Changes: documentation and tests only.
- Record current CI status and baseline test results.
- Enumerate API routes that create side effects.
- Map each operation family to client action, route, backend executor, and tests.
- Freeze existing public request/response contracts before adding optional fields.

Acceptance: route inventory and baseline checks are recorded; no application behavior changes.

### Stage 1 — Local API authentication and secret boundary

Scope: local API session/token design, settings API, provider secret flow, and all frontend API callers.
- Design a session/token mechanism compatible with browser development and Tauri startup.
- Preserve installer, PWA, and local development flows.
- Stop returning secret values from settings responses; return presence/masked metadata and resolve secrets server-side where feasible.
- Add tests for unauthenticated, invalid-token, expired-session, and authorized requests.
- Audit logs and error responses for secret leakage.

Acceptance: protected API routes reject unauthenticated local callers; supported clients obtain and renew a session; secrets are not returned in plain settings responses or logs.

Risk: HIGH. This is a broad API/client boundary. Implement only after mapping every API caller and startup mode.

### Stage 2 — Windows-safe process lifecycle

Scope: execProjectCommand and Git subprocess helpers.
- Add tree-aware termination on Windows, such as taskkill /PID <pid> /T /F, and an appropriate process-group strategy on other supported OSes.
- Use bounded graceful-stop then force-stop behavior where applicable.
- Wait for and verify process exit; distinguish timeout from normal non-zero exit.
- Add explicit timeout to every Git subprocess, including git add -A.
- Preserve stdout/stderr limits and current response fields unless an additive field is required.

Acceptance: Windows integration test starts a shell that spawns a child/grandchild; timeout leaves no descendants; result reports timeout only after termination is confirmed. Linux/macOS behavior remains covered.

Risk: HIGH. OS process semantics. Isolate this from chat cancellation and operation-registry work.

### Stage 3 — File optimistic concurrency

Scope: diff proposal type, proposal creation, apply route, and store apply action.
- Add optional expected source SHA-256 and explicit expected-absence marker.
- Compute the fingerprint when the proposal is created.
- Recompute immediately before writing.
- Return HTTP 409 on mismatch without changing the file or recording a successful write.
- Require refresh/review against new content before retry.

Acceptance: unchanged source applies; modified/deleted/recreated source conflicts; conflict never overwrites newer content; new-file proposals still work.

Risk: MEDIUM. Existing chat messages may contain older proposal shapes. Keep the field additive and define compatibility for pending proposals from older versions.

### Stage 4 — Operation registry and standard chat cancellation

Scope: a small server-side operation registry and standard chat path first.
- Introduce operation IDs and explicit terminal outcomes without replacing the journal.
- Connect frontend request lifecycle to AbortController and a cancel action.
- Propagate cancellation to provider fetch and stream reader.
- Finalize UI streaming state, server status, and operation state on success, failure, timeout, and cancellation.
- Do not add parent/child fan-out yet.

Acceptance: cancel one chat request; provider connection closes; UI stops streaming; a terminal cancelled outcome is recorded; a subsequent chat request works normally.

Risk: HIGH. Core chat behavior. Keep existing message format and provider API response contract stable.

### Stage 5 — Pipeline and subagent child operations

Scope: extend the Stage 4 operation contract.
- Give pipeline runs and stages distinct operation identities.
- Give subagents child operation identities and parent links.
- Implement child-local cancellation and parent cancellation without cancelling unrelated siblings.
- Ensure parent completion waits for required children.
- Add cancelled status to runtime/UI types only after persistence and compatibility are defined.

Acceptance: cancel one child while a sibling continues; cancel parent and all active children stop; no orphaned running status remains after normal cancellation.

Risk: HIGH. Concurrency and UI state consistency. Do not change subagent tool permissions in this stage.

### Stage 6 — Verification adapters

Scope: verify current operation results without changing project task persistence.
- Command: exit code, timeout/cancellation, and bounded output.
- Git: inspect repository state after mutating actions.
- File write: verify resulting content and source fingerprint.
- Pipeline: define and check stage output artifact criteria.
- Journal: distinguish execution completion from verified completion.

Acceptance: failed verification cannot produce a verified-completed outcome; tests cover positive and negative cases for each adapter.

Risk: MEDIUM. Acceptance criteria must be explicit and deterministic.

### Stage 7 — Permission coverage and execution-environment truth

Scope: route inventory from Stage 0, remaining side effects, and Local/SSH/Docker selection.
- Add missing permission/approval checks based on agreed route classification.
- Tie approvals to authenticated sessions and concrete action scope after Stage 1.
- Make SSH/Docker either invoke real dedicated executors or return an explicit unsupported result.
- Ensure selected non-local environment never silently falls through to local shell execution.

Acceptance: every mutating route has a documented authorization rule and regression test; each environment's observed executor matches the UI selection.

Risk: HIGH. Broad security and user-facing behavior. Implement by route groups, not in one large patch.

### Stage 8 — Journal recovery and idempotency

Scope: journal persistence and operation startup recovery.
- Surface persistence failures instead of silently treating them as successful writes.
- Reconcile stale running operations on startup.
- Define safe retry classes and idempotency keys for side effects.
- Reconcile incomplete approvals and orphaned child operations.

Acceptance: restart tests prove interrupted operations are not presented as successfully completed and unsafe side effects are not blindly replayed.

Risk: MEDIUM/HIGH. Persistence compatibility and recovery semantics.

## 4. Regression gates for every code package

Run from the repository root:

    npm run lint
    npm test
    npm run build
    npm run check:encoding

For process, startup, packaging, or Tauri changes, also run the relevant Windows Tauri build and inspect the generated artifact. CI must include Windows and Linux for cross-platform runtime changes.

Do not mark a package complete based only on a successful model response or documentation update. Record exact commands, runner OS, and results.

## 5. Implementation rules

- Work directly on main, using the repository's existing workflow.
- Before each package, re-fetch current files and inspect related types, callers, routes, and tests.
- Make one focused change set per package; do not combine roadmap stages without explicit approval.
- Preserve existing API and persisted-data compatibility. Prefer additive contracts and migration tests.
- Never replace real logic with mocks. Mocks may be test fixtures around real boundaries.
- Do not change UI behavior where the expected interaction is unspecified; ask before implementation.
- Update this audit when implementation evidence changes a finding's status.

## 6. Sources inspected

src/types/onecore.ts; src/store/useOneCoreStore.ts; src/data/oneCoreSeed.ts; server/app.ts; server/projectAgent.ts; server/agentJournal.ts; server/permissionManager.ts; tests/integration.test.ts; package.json; docs/governance/AI_WORKING_RULES.md; docs/project/DEVELOPMENT_PLAN.md; docs/project/CURRENT_WORK.md; docs/architecture/OPERATION_LIFECYCLE.md; docs/architecture/SECURITY_AND_APPROVALS.md; docs/architecture/IMPLEMENTATION_STATUS.md; docs/architecture/TEST_MAP.md.

This audit was performed by source inspection. It did not run the test suite or exercise Windows runtime behavior.
