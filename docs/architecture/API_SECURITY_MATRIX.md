# API Security Matrix

## 1. Scope and audit method

Source-based inventory of routes registered in **server/app.ts**, checked against:
- **src/store/useOneCoreStore.ts** for first-party store call sites;
- **server/permissionManager.ts** and route handlers for permission/approval checks;
- **server/projectAgent.ts** for project filesystem and execution behavior;
- **tests/integration.test.ts** for observed integration coverage.

Audit baseline: **main**, 2026-11-15. Route inventory below retains the original source-audit context; implementation deltas are recorded in section 3.

**Important:** bearer authentication protects API routes except `/api/health` and `/api/auth/session`. Packaged Tauri uses a native-issued token; browser development/Tauri debug bootstrap remains Origin-trusted. The route table's “current controls” column is an earlier baseline and has not yet been rewritten row-by-row; use the implementation delta below for current side-effect approval coverage.

Risk classes:
- **Read** — read-only route; still requires authentication in the target design.
- **A** — bounded event/metadata mutation.
- **B** — application/resource state mutation.
- **C** — execution, destructive, or externally consequential side effect requiring one-time approval.
- **Mixed** — route combines multiple effects and must be split or enforce per-effect policy.

## 2. Route inventory

| Route | Target class | Current server-side controls confirmed | First-party caller / execution path | Test evidence |
|---|---|---|---|---|
| GET /api/agent-journal | Read | Reads server journal and legacy project logs; excluded from generic API audit middleware | Journal UI; Processes SSE snapshot | No focused access-control test identified |
| GET /api/system-map | Read | Authenticated read-only snapshot of in-memory operation records and persisted journal events; generic API audit middleware applies | Processes → Живая карта | Trace metadata compatibility and system-map API integration tests added; runtime smoke test pending |
| GET /api/knowledge | Read | Authenticated read-only metadata catalog from the four runtime knowledge categories; does not return document bodies | Directories → Знания ONE CORE AI | Existing knowledge-loader tests and catalog route assertion added |
| GET /api/external-references | Read | Authenticated read of local user-data records | Directories → КАК У ДРУГИХ | CRUD list/create/update/delete API integration test added |
| POST /api/external-references | B | Authenticated local record creation; server validates absolute HTTP/HTTPS URL and bounded text; no remote fetch | Directories → КАК У ДРУГИХ | URL validation and store isolation tests added |
| PUT /api/external-references/:id | B | Authenticated local record update; server validation; updates only the matching record | Directories → КАК У ДРУГИХ | CRUD integration coverage pending |
| DELETE /api/external-references/:id | B | Authenticated deletion of the local record only; no remote or arbitrary file deletion | Directories → КАК У ДРУГИХ | Store deletion exercised by isolation test |
| GET /api/agent-journal/stream | Read | SSE subscription; excluded from generic API audit middleware | Journal UI; exact component call site not established in this pass | No focused access-control test identified |
| POST /api/agent-journal/events | A | Basic field/type/length validation; excluded from generic API audit middleware; accepts client-supplied operation metadata | Store agent/subagent journal publishers | No focused trust-boundary test identified |
| GET /api/health | Read / public probe | Returns service status; excluded from generic API audit middleware | Runtime health checks | No focused security test identified |
| GET /api/settings | Read | Calls readAppSettings() | Settings initialization/UI; call site not fully traced in this pass | Existing settings persistence tests do not establish auth |
| PUT /api/settings | B | Calls saveAppSettings(); no route-level authentication or approval | Settings UI/store; exact call site not fully traced in this pass | Settings persistence and secret-exclusion coverage |
| GET /api/hardware | Read | Optional directory input passed to hardware detection | Model/hardware UI; call site not fully traced | No focused security test identified |
| POST /api/hardware/recommend | A | Computes recommendations from request models/hardware | Model/hardware UI; call site not fully traced | No focused security test identified |
| GET /api/models/local | Read | Reads local model state | Model UI/store; call site not fully traced | No focused security test identified |
| POST /api/models/download | B | Calls model download manager; request fields parsed in handler | Model UI/store; call site not fully traced | No focused download authorization test identified |
| POST /api/models/download/:id/pause | B | Calls pauseModelDownload() | Model UI/store; call site not fully traced | No focused authorization test identified |
| POST /api/models/download/:id/resume | B | Calls resumeModelDownload() | Model UI/store; call site not fully traced | No focused authorization test identified |
| POST /api/models/ollama/pull | B | Calls startOllamaModelPull() | Model UI/store; call site not fully traced | No focused authorization test identified |
| POST /api/models/import | B | Calls importLocalModelFile() with client path | Model UI/store; call site not fully traced | No focused path/authorization test identified |
| POST /api/models/local/:id/activate | B | Calls activateLocalModel() | Model UI/store; call site not fully traced | No focused authorization test identified |
| DELETE /api/models/local/:id | C | Calls deleteLocalModel(); no explicit approval | Model UI/store; call site not fully traced | No focused delete confirmation test identified |
| GET /api/hf/models | Read | Server-side Hugging Face proxy and cache | Model search UI; call site not fully traced | No focused security test identified |
| GET /api/hf/model | Read | Validates basic owner/model shape; server-side Hugging Face proxy/cache | Model detail UI; call site not fully traced | No focused security test identified |
| GET /api/fs/browse | Read | Delegates to browseDirectory(); errors mapped to 400 | Folder/project selection UI; call site not fully traced | No focused authorization test identified |
| POST /api/fs/mkdir | B | Delegates to createDirectory(); basic string extraction only | Folder/project selection UI; call site not fully traced | No focused path/authorization test identified |
| POST /api/fs/pick-native | A | Opens native folder picker | Project/folder selection UI; call site not fully traced | No focused security test identified |
| GET /api/projects | Read | Returns project list | Store refreshProjects | Project lifecycle integration coverage |
| POST /api/projects | B | Calls createOrUpdateProject(); records project memory | Store project creation action; exact call site not fully traced | Project creation covered in integration tests |
| PUT /api/projects/:id | B | Calls createOrUpdateProject() with route ID | Store project update action; exact call site not fully traced | No focused authorization test identified |
| POST /api/projects/activate | B | Updates active project ID | Store project selection action; exact call site not fully traced | Project lifecycle integration coverage |
| POST /api/projects/:id/activate | B | Updates active project ID | Store project selection action; exact call site not fully traced | Project lifecycle integration coverage |
| DELETE /api/projects/:id | B | Deletes project record; no approval check | Store deleteProject | Test explicitly requires workspace directory and user files to remain |
| GET /api/projects/:id/workspace | Read | Reads project workspace data | Store refreshProjectWorkspace | Project workspace integration coverage |
| POST /api/projects/:id/tasks | B | Saves project task and records project memory | Store task actions; exact call site not fully traced | Project task behavior covered |
| PUT /api/projects/:id/tasks/:taskId | B | Saves task by route ID and records project memory | Store task actions; exact call site not fully traced | Project task behavior covered |
| DELETE /api/projects/:id/tasks/:taskId | B | Verifies task exists, deletes it, records memory | Store task actions; exact call site not fully traced | No focused deletion authorization test identified |
| PUT /api/projects/:id/plan | B | Saves project plan | Store saveProjectPlan | No focused authorization test identified |
| DELETE /api/projects/:id/plan | B | Clears project plan | Store saveProjectPlan | No focused authorization test identified |
| GET /api/projects/:id/files | Read | Calls project file listing, with project path checks in project agent | Store refreshProjectFiles | Project path traversal/symlink tests |
| GET /api/projects/:id/file | Read | Calls readProjectFile(); project path containment | Store selectFile | Project path traversal/symlink tests |
| PUT /api/projects/:id/file | C | Requires approved === true, write_file allowlist, and project path checks; no expected-hash comparison | Store writeProjectFile currently sends approved: true | Tests reject missing approval and verify approved write; no stale-write test |
| GET /api/projects/:id/search | Read | Requires search_code allowlist | Store/project search action; exact call site not fully traced | No focused security test identified |
| POST /api/projects/:id/exec | C | Requires approved === true, run_command allowlist; executes through execProjectCommand() | Store runProjectCommand currently sends approved: true | Tests reject missing approval, deny disallowed tool, and execute approved command |
| POST /api/projects/:id/git | Mixed | Validates action allowlist and project git permission; requires approved === true for commit/fetch/push/init | Store runProjectGit currently sends approved: true | Project integration tests exercise Git/action log behavior; per-action approval matrix not complete |
| GET /api/projects/:id/logs | Read | Reads project action log | Store refreshProjectLogs | Project action log integration coverage |
| POST /api/projects/:id/undo | C | Requires approved === true and write_file allowlist; restores/deletes last written file | Store undoProjectAction currently sends approved: true | Tests reject missing approval and verify undo removes newly created file |
| POST /api/projects/:id/task | Mixed | Checks approved === true only for prompt /undo; delegates to executeProjectTask() | Store project-agent task submission | Tests cover proposed command and task behavior. In ACT mode, model-returned create/update task actions are persisted inside executeProjectTask() without a separate approval ticket |
| GET /api/browser/search | Read | Server-side public web search | Store/chat browser tool; exact call site not fully traced | No focused security test identified |
| GET /api/browser/read | Read | Server-side public page read | Store/chat browser tool; exact call site not fully traced | No focused security test identified |
| POST /api/ssh/test | A | Attempts outbound SSH/path validation; no route-level auth | SSH settings UI; call site not fully traced | No focused security test identified |
| GET /install.ps1 | Read / public artifact | Returns installer script | External/manual installation flow | No focused security test identified |
| POST /api/github/verify | A | Uses GitHub PAT resolved from server-side Vault; token is not accepted from browser payload | GitHub settings UI | Secret management integration tests; verification network test remains needed |
| POST /api/providers/models | A | Resolves provider ID to server-stored base URL and Vault secret; ignores client-supplied URL/key | Store fetchProviderModels | Provider proxy tests; explicit malicious-URL regression assertion still needed |
| POST /api/providers/capabilities | A | Resolves provider ID to server-stored base URL and Vault secret; checks project allowlist when supplied | Store checkModelCapabilities | Model capability reporting tests |
| POST /api/providers/chat | A | Resolves primary/subagent provider ID and role scope to server-stored base URL and Vault secret; request timeouts and disconnect abort | Store chat/subagent requests | Provider forwarding, usage, timeout/disconnect tests |
| POST /api/gateway/telegram/verify | A | Basic Telegram token shape check and outbound Telegram API call | Store verifyTelegramGateway | No focused security test identified |

## 3. Current implementation delta (2026-11-15)

- Bearer sessions protect API routes; packaged Tauri obtains its 256-bit token through native IPC. Browser development/Tauri debug still use Origin-trusted bootstrap.
- `X-OneCore-Approval` is allowed by CORS and is used by browser search/read calls.
- `evaluateSideEffectApproval` records actor, scope, resource, decision, and timestamp in the agent journal.
- Explicit approval is now checked for model download/manage, filesystem directory creation, project-record deletion, SSH connection tests, browser network reads/searches, GitHub/Telegram verification, project file writes, terminal execution, mutating Git, and undo.
- First-party UI/store call sites supply affirmative approval after the corresponding user action. This remains a client-controlled boolean/header, not a one-time ticket; a caller with a valid API token can forge it.
- Fallback vault format v2 uses a per-vault random salt and scrypt N=32768. Legacy migration decrypts every entry before atomic rewrite; parse/decryption failures preserve the source file.

## 4. Cross-cutting controls and gaps

| Control | Current status | Evidence / gap |
|---|---|---|
| Loopback Host restriction | Implemented | Global middleware in server/app.ts |
| Origin and Fetch Metadata checks | Implemented | Global middleware in server/app.ts; exact supported launch modes still need verification |
| Local Session Token | Partial | Bearer auth; packaged Tauri token is native-issued; dev/debug bootstrap remains Origin-trusted |
| CORS custom auth headers | Not prepared | Current allow-header list is Content-Type, Authorization |
| Project tool allowlist | Partial | Enforced for selected project tools; not a universal API policy |
| Explicit approval | Broader coverage / weak | Client boolean/header checked across project, model, SSH, browser/network, and selected external verification actions; not a server-issued ticket |
| One-time Approval Ticket | Missing | No ticket registry, binding, expiry, replay protection, or consent endpoint/flow |
| File optimistic concurrency | Missing | File write does not accept expected fingerprint or return 409 on stale state |
| Project path containment | Implemented for project file operations | Keep existing checks; test Windows-specific path/symlink edge cases |
| API request schema validation | Partial | Handlers mostly extract values ad hoc; no common schema layer |
| Server-observed audit | Partial | Permission decisions are recorded in the agent journal; client event ingestion remains spoofable and journal persistence is best-effort |
| Rate limiting | Not confirmed | No common API rate limiter identified in the audited server |
| External URL / SSRF policy | Requires separate audit | Provider URL proxy, browser tools, SSH test, and model import paths need dedicated review |

### 3.1 Project terminal permission identifier

The canonical project tool ID for terminal execution is `run_command`, as defined by `server/permissionManager.ts` and enforced by `server/app.ts` / `server/projectAgent.ts`. The ProjectModal previously persisted the UI-only alias `exec_command`, so the visible terminal toggle did not match backend authorization. The UI now uses `run_command` and normalizes the legacy `exec_command` value when loading an existing project. No backend alias was added: unknown IDs remain ineffective, and server authorization continues to check only `run_command`.

Regression coverage in `tests/integration.test.ts` asserts the canonical UI identifier and legacy-value normalization.

## 4. High-priority findings

1. **Development bootstrap remains weak:** packaged Tauri has native-issued bearer authentication, but browser development/Tauri debug still trusts matching Origin.
2. **Client-controlled approval:** `approved: true` / `X-OneCore-Approval` can be forged by any caller holding a valid API token; one-time tickets remain required.
3. **Unmediated task side effects:** executeProjectTask() can create/update project tasks from model output in ACT mode. The /task route only gates the special /undo prompt. This needs a policy decision: either task metadata changes are explicitly Class B operations with bounded validation, or they must be surfaced as proposals and separately confirmed.
4. **Journal trust boundary:** client-submitted journal events must not be treated as authoritative security evidence.
5. **No stale-write protection:** file writes can overwrite content changed after the UI read or diff proposal.
6. **Deletion semantics differ:** deleting a project record intentionally preserves the workspace directory; this behavior is asserted by integration tests and must not be changed accidentally.
7. **Approval coverage is not uniform yet:** settings credential mutation is authenticated and explicitly user-triggered; project metadata/task mutations and remaining outbound actions still need a complete route-to-caller audit.

## 5. Required regression coverage

### Authentication
- Missing, malformed, expired, and incorrect token.
- Token is not accepted from query parameters.
- Allowed and disallowed Origin/Fetch Metadata combinations.
- Tauri desktop and browser development bootstrap.
- Journal read, SSE, and event ingestion access policy.
- No token value in logs, settings files, or URLs.

### Approval Ticket
- Pre-flight creates a ticket and produces no side effect.
- Exact same action with valid ticket executes once.
- Missing, expired, unknown, consumed, wrong-session, wrong-route, wrong-project, and changed-payload tickets are rejected.
- Concurrent replay attempts result in at most one execution.
- Permission revocation or target state change between pre-flight and execution is rechecked.
- A failed/interrupted operation does not restore the ticket.

### File integrity
- Existing file unchanged: write succeeds.
- Existing file changed: HTTP 409, no overwrite.
- Missing file remains missing: create succeeds only with explicit absent fingerprint.
- File appears after pre-flight: conflict.
- Symlink/path traversal protections remain effective.
- Windows path and case behavior are tested.

### Side effects and journal
- Every rejected Class C operation has no side effect.
- Server records approval and execution outcomes.
- Client-injected journal events cannot impersonate server-observed operation results.
- Persistence failures are observable and do not silently claim durable audit success.

## 6. Classification notes

This matrix is a working source audit, not a permanent policy by HTTP method. In particular:
- POST /api/projects/:id/git must classify each Git action separately.
- POST /api/projects/:id/task is mixed because it can read files, call a model, mutate task metadata, propose file writes/commands, and perform /undo.
- Provider and verification routes make outbound network requests but are not automatically Class C local-destructive operations. They still require authentication, input validation, SSRF controls, and secret handling.
- Project record deletion is currently metadata deletion, not workspace deletion.

Update this matrix only after tracing the actual handler, caller, and tests. Do not infer implementation from UI labels or model capability descriptions.
