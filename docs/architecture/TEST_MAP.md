# Architecture Test Map

## Existing automated checks

The repository's `package.json` defines:

- `npm run lint` — TypeScript type-check (`tsc --noEmit`).
- `npm test` — Node integration tests through `tsx --test tests/integration.test.ts`.
- `npm run build` — frontend Vite build plus backend bundle.
- `npm run check:encoding` — encoding regression check.

The existing CI workflow runs encoding checks, type-checking, integration tests, and production builds on Linux and Windows. See `docs/project/CURRENT_WORK.md` for the recorded CI run and its scope.

## Existing integration-test coverage observed

The integration test file includes coverage for:

- legacy application data directory compatibility;
- rejection of untrusted browser origins;
- project path traversal and symlink escape rejection;
- prompt routing and PLAN/ACT inference;
- settings persistence and secret exclusion from the plain settings file;
- explicit permission decision semantics and rejection of model/project side effects without approval;
- legacy fallback-vault migration to versioned scrypt metadata and preservation of corrupt vault files;
- OpenAI-compatible provider request forwarding and token usage;
- aborting an upstream streaming provider request when the downstream client disconnects;
- model capability reporting and project task behavior (see the full test file for the current set).

## Recommended future test matrix

| Area | Required scenarios |
|---|---|
| Provider request | header timeout, body timeout, idle stream timeout, client disconnect, malformed/aborted stream |
| Operation lifecycle | success, failure, timeout, cancellation, duplicate request, stale operation |
| Parent/child | cancel parent, cancel one child, sibling continues, parent waits for required children |
| Windows process tree | shell spawns child/grandchild; timeout/cancel terminates all descendants; process exit is confirmed |
| File concurrency | unchanged source applies; changed source returns 409; deleted/recreated source conflicts |
| Approval | missing, false, stale, wrong-scope, and repeated approval; no side effect on rejection |
| Pipeline | stage failure stops or follows explicit policy; artifact missing; verification failure prevents completion |
| Journal/recovery | persistence ordering, bounded retention, reconnect snapshot, interrupted running event reconciliation |
| Execution environments | Local executes locally; SSH/Docker either execute through the selected backend or return explicit unsupported errors |

## Verification discipline

For code changes, follow `docs/governance/AI_WORKING_RULES.md`: run `npm run lint`, `npm test`, and `npm run build`. Changes involving Tauri startup, capabilities, bundling, or Rust also require the relevant Windows Tauri build.

Documentation-only changes do not establish runtime correctness. They should be checked for source accuracy, valid links, encoding, and scope. No application tests are claimed as run by this documentation update.
