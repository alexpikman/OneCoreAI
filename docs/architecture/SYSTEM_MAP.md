# ONE CORE AI — System Map

## 1. Runtime topology

ONE CORE AI currently uses the following technology boundaries:

- **Desktop shell:** Tauri 2.
- **Frontend:** React 19, TypeScript, Vite, Zustand, Tailwind CSS.
- **Local backend:** Node.js 22+, Express, TypeScript.
- **Model connectivity:** provider adapters/endpoints in the local backend; local model runtimes and cloud-compatible HTTP APIs are configured through provider profiles.
- **Persistence:** local application data managed by server-side modules; project workspace data, settings, action logs, and the agent journal have separate responsibilities.

The desktop shell and local Node backend are separate runtime concerns. Do not assume that a frontend state change is itself a persisted operation.

## 2. Main components

| Area | Current source | Responsibility |
|---|---|---|
| Application composition | `src/App.tsx` | Selects the active application view and shared layout |
| Shared client state | `src/store/useOneCoreStore.ts` | UI/application state and client actions |
| Shared contracts | `src/types/onecore.ts` | TypeScript types for sessions, projects, tasks, tools, roles, and journal events |
| Agent routing | `src/utils/agentRouter.ts` | Classifies prompts into chat, browser, terminal, or project routes; infers PLAN/ACT mode |
| Agent policy and pipeline defaults | `src/data/rolesAndRules.ts` | Role/rule defaults, general-agent instructions, pipeline stage definitions |
| HTTP API | `server/app.ts` | Express routes and request-level validation/orchestration |
| Project operations | `server/projectAgent.ts` | Project file access, project task execution, terminal and Git operations |
| Project persistence | `server/projectsManager.ts` | Project records and project workspace state |
| Permission checks | `server/permissionManager.ts` | Project tool allowlist checks and explicit approval predicate |
| Agent journal | `server/agentJournal.ts` | Event cache, persistence, and SSE publication |
| Integration tests | `tests/integration.test.ts` | API and cross-module regression tests |

This map is intentionally a navigation aid, not a complete dependency graph.

## 3. Current request/data flow

### Standard chat

1. The UI calls the client action in the Zustand store.
2. `routeAgentPrompt` classifies the prompt.
3. The selected provider/model configuration is sent to the local API.
4. `server/app.ts` proxies the provider request.
5. The store updates the active session and assistant message as response data arrives.

The standard provider chat endpoint supports streaming. The server owns the upstream provider request and currently aborts it when the downstream client disconnects, with a provider response timeout and a streaming idle timeout.

### Project task flow

1. The client routes project-related work through the project-agent API.
2. The backend resolves the project and workspace data.
3. Project tool allowlists are checked for relevant operations.
4. The project agent gathers a bounded set of project files and workspace context.
5. The model response may include a reply, task updates, a proposed file diff, or a proposed command.
6. File writes and commands requiring confirmation remain subject to the corresponding API approval path.

A model response is not proof that a proposed side effect has been applied. The UI and backend must distinguish proposals from executed operations.

### Project file and command flow

- Project file operations are implemented server-side and scoped to a project root.
- File write proposals are applied through the store action after the user confirms.
- Command proposals are run through a separate store action after confirmation.
- Git operations are exposed through project API routes; mutating Git actions require explicit approval at the route boundary.

### Agent journal flow

1. Server-side code records an event in the journal cache.
2. The journal persists a bounded snapshot asynchronously.
3. Connected SSE subscribers receive the event.
4. The UI reads journal events through the API and renders the activity history.

The journal is currently an event history and delivery mechanism. It is not yet a complete durable operation scheduler or a recovery engine.

## 4. Important boundaries

- **Model capability is not application capability.** A model's self-reported ability does not grant tools or permissions.
- **UI controls are not security boundaries.** The backend must validate permissions and approvals independently.
- **Project task status is not verification.** A task marked `done` does not by itself prove its acceptance criteria.
- **Execution environment configuration is not proof of execution location.** A configured Local/SSH/Docker choice must be checked against the actual executor before claiming remote/container execution.
- **Journal events are not operation control.** Logging `running` or `completed` does not provide cancellation, deduplication, or crash recovery by itself.

## 5. Architectural direction

Preserve the existing React/Zustand + Express/Node + Tauri topology. Stabilization should strengthen contracts across existing boundaries rather than introduce a parallel runtime or duplicate sources of truth.
