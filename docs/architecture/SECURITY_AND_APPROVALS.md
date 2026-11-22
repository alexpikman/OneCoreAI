# Security, Permissions, and Approvals

## 1. Purpose and status

This document separates **behavior confirmed in the current source** from **recommended target behavior**. A target safeguard must not be described as implemented until code and tests prove it.

Audit baseline: `main`, 2026-11-15.

Related documents:
- [API security matrix](./API_SECURITY_MATRIX.md)
- [Implementation status](./IMPLEMENTATION_STATUS.md)
- [Test map](./TEST_MAP.md)

## 2. Current source findings

### 2.1 Local API boundary

Confirmed in `server/app.ts`:

- The API accepts only loopback Host values: `localhost`, `127.0.0.1`, and `::1`.
- Browser Origin checks allow the matching loopback host and local port, plus the configured Tauri origins.
- Cross-site Fetch Metadata values are rejected, except for the configured Tauri origins.
- The CORS allow-header list includes `Content-Type`, `Authorization`, and `X-OneCore-Approval`.
- Bearer authentication protects `/api` routes except the intentionally public `/api/health` probe and `/api/auth/session` bootstrap.
- Packaged Tauri generates a 256-bit token in Rust, passes it to the backend process, and exposes it to the frontend only through a native Tauri command.
- Browser development and Tauri debug still use an Origin-trusted bootstrap and do not authenticate arbitrary local processes.

These controls reduce exposure to remote websites and non-loopback network access. They do not authenticate a local process and are not a substitute for a server-issued session credential.

The approval header is explicitly allowed for browser preflight. Any future custom auth or ticket headers must be added to this list.

### 2.2 Journal endpoints

The generic operation-audit middleware skips journal routes, but the earlier bearer-authentication middleware still protects journal reads, SSE, and event ingestion. `/api/health` is exempt from bearer authentication.

The journal read and SSE endpoints expose operational history. The event-ingestion endpoint accepts client-supplied operation identifiers and event metadata. The journal event-ingestion endpoint remains client-writable by any authenticated local API client and can accept fabricated client-reported events. It must not be treated as server-observed proof.

The journal's persistence queue currently swallows write failures. Journal persistence is therefore best-effort and must not be treated as a durable security audit log.

### 2.3 Project permissions and current approval

Confirmed in `server/permissionManager.ts` and `server/app.ts`:

- The project allowlist supports `read_file`, `write_file`, `run_command`, `git`, and `search_code`.
- `run_command` is the canonical terminal permission ID across the ProjectModal and backend. The UI normalizes the previously used `exec_command` value to `run_command` when loading an existing project; the backend accepts only the canonical ID.
- A missing project is denied.
- Legacy projects without an `allowedTools` array receive the legacy default allowlist.
- `evaluateSideEffectApproval` records actor, scope, resource, decision, and timestamp for approved/denied side-effect requests.
- The route-level approval is still a client-controlled `approved: true` boolean or `X-OneCore-Approval: user-confirmed` header. This is an auditable UI convention, not a cryptographically bound consent ticket.

The approval check is currently a client-controlled boolean, not proof of user consent. A caller can send `approved: true` without a separate confirmation ceremony. It is therefore a UI convention, not a strong authorization mechanism.

Confirmed approval checks in `server/app.ts`:
- Model download, pause/resume, import, activation, and deletion routes.
- `POST /api/fs/mkdir` and `DELETE /api/projects/:id`.
- SSH connection tests, browser search/read, GitHub verification, and Telegram verification.
- `PUT /api/projects/:id/file`, `POST /api/projects/:id/exec`, `POST /api/projects/:id/undo`, and `POST /api/projects/:id/task` for `/undo`.
- `POST /api/projects/:id/git` for `commit`, `fetch`, `push`, and `init`.

Git `status`, `diff`, and `log` do not require approval. The project allowlist and approval checks are separate checks and both must remain enforced.

### 2.4 File integrity and path containment

Confirmed in `server/projectAgent.ts`:

- Project file paths are resolved against the project root.
- Path traversal and existing symlink escapes are checked by the path resolver.
- `writeProjectFile` reads the previous file content for the action log and then writes the new content.
- The write API does not accept or validate an expected SHA-256 fingerprint.
- The file write path has no optimistic concurrency contract; concurrent or stale edits can overwrite newer content.

The existing path containment checks must be preserved and tested when adding any new file-integrity layer. A hash check does not replace path validation.

### 2.5 Operation journal

Confirmed in `server/app.ts` and `server/agentJournal.ts`:

- The API middleware starts an agent-journal event for most `/api` requests and completes/fails it based on the HTTP response status.
- The journal supports running, completed, failed, and info statuses.
- The API middleware currently classifies an operation as failed only when the HTTP status is at least 400. A handler that returns HTTP 200 with an application-level `ok: false` can therefore appear completed in this generic API event.
- The journal is bounded to 5,000 events and asynchronously persisted.
- Persistence failures are swallowed, and there is no durable write acknowledgement.

The journal is useful operational telemetry, but the current implementation is not yet a tamper-resistant or guaranteed-durable security audit trail.

### 2.6 Client behavior

Confirmed in `src/store/useOneCoreStore.ts`:

- File writes, direct command execution, Git actions, and undo currently send `approved: true` from the client.
- The client has no Approval Ticket request/confirm/replay flow.
- These call sites must be migrated together with the server contract. Changing only the server would break existing project operations; changing only the client would not establish security.

## 3. Risk classification

Classify by actual effect, not HTTP verb alone.

### Class A — bounded application events

Examples:
- Client-originated journal telemetry.
- Non-destructive task metadata updates where the operation cannot modify files, execute commands, or change external state.

Required controls:
- Local API authentication.
- Strict request schema and size limits.
- Project/session context validation where applicable.
- Rate limits or bounded ingestion for client-originated telemetry.
- Audit metadata that distinguishes client-reported events from server-observed events.

Class A does not mean unauthenticated or trusted.

### Class B — resource and application-state changes

Examples:
- Settings updates.
- Project/task/plan metadata changes.
- Model download, import, activation, and removal.
- Directory creation.
- Project record deletion (the current implementation removes the record; integration tests require the user workspace directory to remain intact).

Required controls:
- Local API authentication.
- Strict input validation.
- Resource existence/state checks.
- Path and destination validation for filesystem operations.
- Explicit, documented deletion semantics.
- Audit start and result.

If an operation has destructive or externally visible consequences, promote it to Class C.

### Class C — execution and destructive side effects

Examples:
- Shell command execution.
- Project file writes.
- File undo/restore.
- Mutating Git operations: commit, fetch, push, init.
- Any project-agent action that can reach one of those executors.

Required controls:
- All Class A/B baseline controls.
- Project tool allowlist and backend permission checks.
- Server-issued, one-time approval bound to the exact operation.
- Context and target validation immediately before execution.
- Optimistic concurrency for file writes and restores where applicable.
- Audit events for approval and execution outcomes.

Read-only Git operations and file reads are not Class C solely because they use a POST or access a project.

## 4. Local Session Token status and remaining design

Packaged Tauri now has a native-issued bearer token boundary. The remaining weakness is browser development/Tauri debug: the session bootstrap still trusts a matching local Origin and does not distinguish OneCoreAI from another local process.

Required properties for the remaining bootstrap work:

- Generate a high-entropy token using Node's cryptographic random generator.
- Keep the token in backend memory; do not store it in ordinary application settings or expose it in URLs.
- Accept it only through a dedicated request header.
- Compare token material safely and reject missing, malformed, or incorrect values without throwing.
- Do not log token values.
- Scope the token to the lifetime of the backend process; restart invalidates old tokens.
- Keep the bootstrap/handshake path narrowly scoped to the actual desktop and development launch modes.
- Do not treat a loopback source address alone as proof that a browser request is trusted.
- Require exact Origin policy and Fetch Metadata checks in addition to authentication for browser-facing requests.
- Preserve a documented path for non-browser local clients and automated integration tests.

A token handshake is security-sensitive. It must not become an unauthenticated endpoint that returns the token to any webpage able to reach localhost. The exact Tauri and browser-development bootstrap mechanism must be checked against `server.ts`, Vite configuration, and Tauri startup before implementation.

## 5. Recommended Approval Ticket protocol

The existing `approved: true` flag and `X-OneCore-Approval` header are not sufficient for Class C. The target protocol should use a server-issued, single-use approval ticket.

### Phase 1 — prepare

1. The client submits the proposed operation without a ticket.
2. The server authenticates the session and checks project permissions.
3. The server validates the complete request schema and target context.
4. The server creates a canonical operation description and computes its cryptographic hash.
5. The server stores a random ticket with the hash, session binding, method, route, project/resource identity, creation time, and expiry.
6. The server returns a structured `APPROVAL_REQUIRED` response. No side effect may begin in this phase.

### Phase 2 — user consent

1. The UI displays the operation description returned by the server.
2. The user explicitly confirms or rejects it.
3. The UI must not infer consent from PLAN/ACT mode, model output, or a pre-existing boolean.

### Phase 3 — execute

1. The client repeats the operation with the approval ticket in a dedicated header.
2. The server re-authenticates the session and revalidates permissions and current resource context.
3. The server verifies ticket existence, expiry, single-use state, session binding, method, route, project/resource identity, and canonical payload hash.
4. The server atomically consumes the ticket before handing the operation to the executor.
5. The executor runs the original validated operation; a consumed ticket is never restored after failure or interruption.

### Ticket lifecycle and storage

An in-memory ticket registry is a reasonable first implementation for a single backend process:

- Process restart invalidates every pending ticket.
- Ticket expiration is enforced by the server, not the client.
- Ticket consumption must be atomic within the process so concurrent replays cannot both execute.
- Expired and consumed records must be cleaned up without allowing ticket reuse.
- The ticket must be bound to the authenticated session and exact action scope.

A 30-second TTL is a candidate default, not yet a fixed contract. It should be selected after measuring the actual UI confirmation flow and should remain short.

### Canonical payload requirements

Do not hash raw JSON text: key ordering and equivalent encodings can differ. Hash a deterministic, validated representation of the operation, including at minimum:

- HTTP method and normalized route/action.
- Project/resource identifier.
- Validated operation parameters.
- Target relative path for file operations.
- Content or command bytes as interpreted by the executor.
- Relevant execution options that materially change the effect.

The UI summary must be derived from the same validated operation description that is bound to the ticket. A hash supplied by the client is never authoritative.

### Response semantics

Use a stable machine-readable error code such as `APPROVAL_REQUIRED`, separate from the human-readable message. The final HTTP status should be chosen consistently across all Class C routes and documented in the API contract. The pre-flight response must never be mistaken for a successful execution.

## 6. File optimistic concurrency

For file writes and restores:

1. Read the current target state on the server after path containment validation.
2. Compute SHA-256 from the actual current bytes.
3. Represent a missing file explicitly (for example, a distinct `absent` state), rather than treating it as an empty file.
4. Compare the server-computed fingerprint with the fingerprint reviewed by the user.
5. Return HTTP 409 on mismatch and do not write.
6. Bind the expected fingerprint and proposed new content to the Approval Ticket.
7. Recheck the target state immediately before the write to reduce the race window.

A simple read-hash-then-write sequence still has a time-of-check/time-of-use race against external processes. The implementation should use the strongest practical atomic strategy supported by the target platforms and document any residual limitation.

## 7. Audit event requirements

The security audit trail should distinguish server-observed facts from client-reported telemetry.

For protected operations, record:
- Server-generated operation ID.
- Authenticated session identifier (never the token).
- Risk class and action type.
- Project/resource and normalized target.
- Approval ticket lifecycle result (do not log the ticket secret).
- Start and finish timestamps.
- Outcome: rejected, completed, failed, timed out, or interrupted.
- HTTP status and structured failure code.
- Executor result sufficient for diagnosis, with secrets and sensitive payloads redacted.

A client-submitted journal event must never be accepted as proof that a protected operation actually occurred or succeeded. Server-side operation events are authoritative.

## 8. Implementation order

1. Complete the route-to-caller-to-handler-to-test matrix in `API_SECURITY_MATRIX.md`.
2. Inspect server startup, Vite, and Tauri launch paths; design the Local Session Token bootstrap without breaking supported modes.
3. Add Local Session Token authentication and migrate all first-party API callers.
4. Define and enforce request schemas for protected routes.
5. Implement the Approval Ticket service and migrate Class C routes and UI confirmation flow together.
6. Add server-computed file fingerprints and conflict handling.
7. Harden journal trust boundaries and persistence/error reporting.
8. Add regression tests for authentication, origin handling, ticket expiry/replay/scope mismatch/concurrency, stale writes, and no-side-effect-on-rejection.

Do not combine these stages into one large change. Each stage must be independently testable and preserve existing application behavior unless a behavior change is explicitly approved.

## 10. Performance and responsiveness requirements

Security controls must not introduce avoidable latency into normal UI interactions or project operations. Performance is a correctness requirement, but it must not be achieved by weakening authorization, integrity checks, or durability guarantees.

### 10.1 Measure before optimizing

For each changed path, measure and record:
- Client action to server response latency.
- Server processing time, split by authentication, permission checks, payload hashing, approval-ticket lookup/consume, executor, and journal.
- Disk persistence latency where applicable.
- Streaming time-to-first-byte and inter-chunk idle behavior for streaming endpoints.
- UI time from receiving a response to rendering the resulting state.

Use existing test and runtime infrastructure where possible. Do not add a heavyweight telemetry dependency solely for this work.

### 10.2 Keep the critical path short

- Use in-memory lookup for active session and approval-ticket state; avoid disk reads on every request.
- Compute canonical payload hashes once per validated request and reuse the result.
- Keep approval-ticket consume atomic and constant-time where applicable; do not introduce avoidable network round trips.
- Avoid serializing unrelated journal writes or full-state persistence on the request critical path.
- Do not block the Node.js event loop with synchronous filesystem operations, large JSON transformations, or CPU-heavy work in request handlers.
- Use bounded concurrency and backpressure for background persistence and external operations.
- Avoid repeated project scans or file reads when the validated result can safely be reused within the same request.
- Preserve current provider response timeout, stream idle timeout, and downstream disconnect cancellation behavior.

### 10.3 Save and apply semantics

- A successful save response must mean the required persistence operation has completed according to the documented durability contract.
- If persistence is moved to a background queue, the API must distinguish accepted/queued from durably saved; never report completion before the required guarantee is met.
- Batch independent journal snapshot writes where safe, but do not drop events or hide persistence failures.
- Use atomic file replacement or an equivalent platform-safe approach where required for integrity; do not trade correctness for a faster but unsafe direct write.
- UI state updates should be optimistic only where rollback/error handling already exists or is added and tested in the same change.
- Prevent duplicate submissions while an identical mutation is in flight; do not silently discard distinct user actions.

### 10.4 Performance regression gates

For every security or persistence change:
- Compare before/after timings on representative local operations.
- Add tests for bounded latency only where deterministic and non-flaky; use benchmarks or diagnostic measurements for variable disk/process operations.
- Verify that token validation and ticket validation do not perform synchronous disk/network I/O.
- Verify that journal persistence does not block unrelated API requests.
- Verify that file hashing and conflict checks do not read the same file repeatedly without need.
- Record any intentional latency added by stronger guarantees and explain why it is necessary.

The objective is to reduce avoidable overhead and perceived waiting time while preserving the required security and durability guarantees. No fixed latency target should be invented before measuring the current baseline on supported Windows hardware.

## 9. Non-goals and safety constraints

- Do not create a second Express application or duplicate the API server.
- Do not replace existing executors with mock handlers.
- Do not weaken project allowlists, path containment, Origin checks, or existing cancellation behavior.
- Do not delete project workspaces when deleting project records unless that behavior is separately specified and approved.
- Do not mark a safeguard implemented based only on documentation or a client-side UI.
