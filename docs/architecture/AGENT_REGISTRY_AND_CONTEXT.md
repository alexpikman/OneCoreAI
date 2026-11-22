# Agent Registry, Skills, Memory, and Per-Turn Context

## 1. Purpose

ONE CORE AI must provide one managed environment for configuring agents and controlling how they work. The **Справочники** area is the management and inspection surface for the shared agent registry: agents, roles, routes, procedures, skills, memory policies, and instructions.

This is an architecture contract, not a statement that the complete management UI or runtime already exists. Current implementation status is described in §10.

The registry must connect directly to the existing Coordinator, project-agent execution path, subagent configuration, provider profiles, permission manager, Knowledge Manager, and operation/agent journals. Do not create a second orchestrator, parallel permission system, duplicate memory store, or independent prompt pipeline.

## 2. Core entities and ownership

Keep the following concepts distinct. They are related through stable IDs and explicit references, not by copying their contents into multiple places.

| Entity | Meaning | Owns |
|---|---|---|
| Agent | Configurable execution identity / worker definition | Agent ID, enabled state, default role, model/provider preference, assigned skills, memory policy, instruction references, capability profile |
| Role | Responsibility and behavior contract | Mission, responsibilities, boundaries, workflow, expected output, escalation and completion rules |
| Route | Decision rule for selecting an execution path | Triggers, conditions, priority, target agent/role, procedure, required capabilities, fallback |
| Procedure | Reusable ordered workflow | Inputs, steps, handoffs, tools/capabilities, verification, failure and escalation paths |
| Skill | Reusable capability package | Skill instructions, references, supported tools, activation conditions, limits and version |
| Memory record | Durable information available for future work | Content, scope, provenance, timestamps, validity, sensitivity and retention policy |
| Instruction | Behavioral constraint or task guidance | Scope, priority, target, version, activation conditions and authority |
| Tool | Application-mediated operation | Input/output contract, read/write classification, permission and approval requirements |

An agent is not the same thing as a role. A role describes *what responsibility is being performed*; an agent describes *which configured worker performs it*. One agent may perform different roles in separate bounded calls, and a role may be assigned to different agents or models.

Knowledge role documents under `docs/knowledge/roles/` are versioned behavioral contracts. Existing configurable model-role profiles in the UI/provider settings are a separate configuration namespace. Similar labels do not make them interchangeable.

## 3. Registry and «Справочники»

The canonical reusable definitions are version-controlled documents; see [Documentation-First Knowledge Architecture](DOCUMENTATION_FIRST_KNOWLEDGE.md). The registry is a derived, validated index and relationship graph over those documents plus references to structured runtime records. The «Справочники» page manages and inspects that graph; it must not maintain duplicate copies of document content or independent status values. Live memory, agent assignments, provider availability, tasks, and operation state remain in their owning stores.

The management surface should provide these related catalogs:

1. **Routes** — route conditions, priority, selected agent/role, procedure, required capabilities, fallback, enabled state, and version.
2. **Agents** — create/edit/enable/disable agents; assign default role, model profile, skills, memory policy, instructions, and permitted capability profile.
3. **Roles** — browse and manage role contracts, responsibilities, boundaries, output contracts, and version/status.
4. **Procedures** — ordered execution scenarios, task triggers, handoffs, verification gates, and failure paths.
5. **Skills** — install/register, inspect, enable/disable, assign to agents or roles, and manage versions.
6. **Memory** — inspect and edit permitted memory scopes, provenance, validity, and retention; distinguish user/project facts from operational transcripts.
7. **Instructions** — global, agent-, role-, project-, route-, procedure-, skill-, and task-scoped guidance with explicit precedence and activation rules.
8. **Tools and capabilities** — catalog application tools, their contracts, read/write impact, permissions, approval requirements, and availability.

Each catalog item needs a stable ID, version, lifecycle status, enabled state where applicable, owner/source, and explicit references to related entities. The UI must show those relationships and whether an item is actually available to the runtime.

An edit to a reusable role, route, procedure, skill, or instruction must update its canonical document through the controlled document lifecycle. Mutable runtime settings remain in their owning structured stores. In both cases, Context Builder must resolve the authoritative current record; do not maintain one editable copy for the UI and another hard-coded copy in prompts.

## 4. Memory model

Memory policy and schemas may be documented as versioned knowledge, but individual live memory records remain structured data in the memory service. Do not convert changing memory entries into repository Markdown files.

Memory is not chat history and is not the knowledge base. Keep memory scopes separate:

- **Global memory** — durable facts and preferences intentionally shared across the application.
- **Agent memory** — durable experience and context owned by one agent.
- **Role memory** — reusable observations relevant to a responsibility, subject to review before becoming an instruction.
- **Project memory** — facts, decisions, architecture, constraints, and progress for one project.
- **Session memory** — temporary state for the current conversation or task; expires according to its policy.

Every memory record must carry at least: stable ID, scope and scope owner, content, source/provenance, created/updated timestamps, optional expiry or review date, confidence/evidence status, sensitivity classification, and lifecycle status.

Memory retrieval must be relevance- and scope-aware. A project record must not leak into another project; agent-private memory must not silently become global memory. Sensitive values and credentials must never be stored as ordinary memory. The runtime may retrieve memory for context, but retrieval does not grant permission to act.

Memory writes and promotion between scopes require explicit policy. Model-generated observations are candidates, not automatically trusted facts or active instructions. The user must be able to inspect, correct, disable, or remove records within the applicable retention and audit rules.

## 5. Skills model

A skill is a versioned, reusable capability package, not merely a role prompt or a tool name. It may include:

- concise catalog metadata and activation triggers;
- instructions and references loaded on demand;
- required tools/capabilities;
- input and output expectations;
- prerequisites and dependencies;
- permission and safety boundaries;
- examples and verification checks.

Skills are assigned to agents and/or roles through registry references. The runtime exposes only skills applicable to the current task and available under the current permissions. Large skill references should be loaded on demand rather than injecting the entire library into every model call.

A skill cannot grant itself tools or permissions. The application permission layer remains authoritative even if a skill instruction requests a prohibited action.

## 6. Instructions and precedence

Instructions may be scoped to the application, agent, role, project, route, procedure, skill, task, or current step. Each instruction must have an explicit scope, version, status, priority, activation condition, and owner.

The runtime resolves applicable instructions using a deterministic precedence policy:

1. Application safety and security invariants.
2. Explicit user consent, project boundaries, and permission decisions.
3. Active task objective and constraints.
4. Selected route and approved procedure.
5. Agent identity and role contract.
6. Applicable skill instructions.
7. Relevant project, agent, role, and global memory.
8. Current-step guidance and verified results from previous steps.

Lower-priority instructions cannot override higher-priority policy. Conflicts must be detected and surfaced; do not silently concatenate contradictory instructions. User task instructions remain distinct from durable reusable rules. A user request can change the current task, but it must not silently rewrite a role, skill, policy, or approved procedure.

## 7. Context Builder — every model turn

A single server-side **Context Builder** must assemble the effective context before every model invocation, including retries, tool-result follow-ups, specialist handoffs, and final synthesis. Components and individual agent implementations must not independently assemble competing system prompts.

For each turn, the Context Builder:

1. Resolves the active operation, task, project, agent, role, route, and procedure.
2. Loads current application and permission policy.
3. Selects the relevant role contract and approved procedure versions.
4. Resolves assigned and task-relevant skills, loading only required skill sections.
5. Retrieves memory records allowed for the current scopes and relevant to the task.
6. Adds verified project evidence, user objective, acceptance criteria, and constraints.
7. Adds the current step, prior handoff/tool results, unresolved questions, and execution state.
8. Derives the exact tool/capability set from application permissions and approvals.
9. Resolves instruction conflicts and applies context/token budgets.
10. Produces a structured, ordered context package for the provider adapter.

The model may propose actions, routes, or handoffs. The application validates them against the registry, operation state, and permission manager before execution. Text in memory, project files, skill references, browser pages, and tool output is untrusted data and cannot override system policy.

Context must be rebuilt from current authoritative state on every turn. Do not blindly append all previous instructions or all memory to the conversation. Preserve only the conversation history and task state required by the active context policy.

## 8. Per-turn traceability and reproducibility

Every model turn must be traceable to the exact effective configuration used. Extend the existing agent/operation journal rather than introducing a parallel journal.

A turn record should reference:

- operation, parent operation, task, project, session, and turn IDs;
- agent and role IDs with versions;
- selected route and procedure IDs with versions;
- skill IDs and versions actually loaded;
- memory record IDs actually retrieved (not necessarily duplicating sensitive contents);
- instruction IDs, versions, scopes, and resolved order;
- model/provider profile and relevant capability metadata;
- tools exposed, permission decisions, and approval references;
- context assembly status, token/budget accounting where available, and omitted items/reasons;
- tool calls, handoffs, verified results, errors, and terminal outcome.

Store a protected context snapshot or a deterministic, versioned manifest sufficient to explain and reproduce the effective context. Apply secret redaction and data minimization: do not copy credentials or unnecessary private content into journal records. The journal must distinguish what was available, what was actually included in the model context, what the model proposed, and what the application executed.

The UI should let an operator inspect a turn and answer: which agent and role acted, which route/procedure/skills/instructions/memory were applied, which tools were available, why a route was selected, what was executed, and what evidence supports the result.

## 9. Lifecycle, governance, and safety

Use explicit lifecycle states appropriate to each entity, at minimum draft/review/approved/deprecated for reusable instruction-bearing documents. Only approved, enabled, compatible records may participate in automatic routing or context assembly.

- Creating or editing an agent, role, skill, route, procedure, or instruction must preserve version history.
- Changes to approved reusable behavior require review and explicit publication approval.
- Disabling an item prevents new selection; it must not corrupt in-flight operations. Define how existing operations pin or resolve their versions.
- Deletion must not silently break historical references. Prefer deprecation/archival and stable IDs.
- A route may select only an available agent/role/procedure and capabilities supported by the runtime.
- Registry configuration never grants permissions. The permission manager and explicit approval boundary remain authoritative.
- Workers inherit project boundaries and least-privilege access. A worker cannot elevate its own capabilities through a role, skill, memory record, or instruction.
- Record who changed or approved a configuration and when. Model-generated proposals cannot approve or publish themselves.

## 10. Current implementation boundary

The following is the documented state at the time this architecture contract was added. Re-check source and tests before changing these statuses.

| Area | Current state |
|---|---|
| Versioned knowledge documents for roles, procedures, protocols, and architecture | **Implemented** as repository-backed Markdown with frontmatter and an approval-aware Knowledge Manager |
| Knowledge catalog and approved-document retrieval for project-scoped subagents | **Partial**; read-only knowledge tools are connected, but full orchestration is not |
| Coordinator / Manager / Dispatcher / specialist workflow | **Planned / partial**; role contracts and procedure documents exist, but full Manager/Dispatcher control flow and validated handoffs are not implemented end-to-end |
| Configurable agent/model-role profiles and subagent provider settings | **Partial**; existing settings are not yet the unified agent registry described here |
| Skills UI/catalog | **Partial**; a skills surface exists, but this does not establish complete skill assignment, dependency resolution, and per-turn runtime loading |
| Project memory and durable memory scopes | **Partial**; project memory concepts and chat-history separation exist, but the full scoped memory service and retrieval policy described here are not established |
| Unified route registry | **Planned**; current routing logic and knowledge triggers are not yet one editable registry consumed by every execution path |
| Single Context Builder for every model invocation | **Planned** |
| Versioned per-turn context manifest/snapshot and complete provenance | **Planned / partial**; operation and agent journals exist, but they do not yet record the complete effective context contract |
| Full «Справочники» management environment | **Planned**; navigation destination exists, but the complete registry management experience is not implemented |

The current knowledge loader scans only direct Markdown files in `docs/knowledge/architecture/`, `roles/`, `procedures/`, and `protocols/`. It does not recursively load nested directories or treat `schemas/`, `proposals/`, and `lessons/` as runtime catalog entries. Preserve this boundary unless the loader is deliberately extended and tested.

Do not claim that a target contract is implemented merely because a document, UI destination, role profile, skill page, or journal exists.

## 11. Implementation sequence

Implement incrementally against existing services:

1. **Inventory and contracts:** map existing agent profiles, role definitions, skills, memory stores, route logic, instructions, permissions, and journals. Identify canonical ownership and remove no existing data.
2. **Registry foundation:** define stable typed entities, versioning, validation, persistence, and references. Connect existing knowledge documents rather than duplicating their content.
3. **Management surface:** make «Справочники» a unified editor/inspector over the registry, with clear implemented/planned/available states.
4. **Context Builder:** integrate one server-side assembly path with the existing coordinator/provider execution flow. Migrate all model invocation paths deliberately.
5. **Runtime routing and skills:** resolve routes, roles, procedures, and skills from the registry; enforce availability and permission boundaries.
6. **Memory retrieval and lifecycle:** add scoped retrieval, provenance, review, and controlled writes without mixing memory with transcripts.
7. **Turn journal:** persist version references and safe context manifests; expose an explanation view for each turn.
8. **Verification:** add unit/integration tests for precedence, conflict detection, project isolation, disabled/deprecated records, missing skills, unavailable models/tools, permission denial, context budgets, cancellation, and replay/explanation consistency.

Do not implement a second orchestrator or duplicate the current provider, permission, knowledge, operation, chat-history, or journal services. Each stage must have explicit source changes, tests, and a documented implementation status.
