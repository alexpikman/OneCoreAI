# ONE CORE AI Knowledge Base

The knowledge base is the versioned source of truth for reusable agent procedures, role contracts, handoff protocols, and validated lessons. The broader document-first architecture and «Справочники» integration are defined in [Documentation-First Knowledge Architecture](../architecture/DOCUMENTATION_FIRST_KNOWLEDGE.md).

The knowledge base is distinct from:
- Project and durable memory: live facts and preferences stored by their owning memory/project services, not chat transcripts.
- Skills: reusable capabilities. Existing skill UI/storage is not yet fully unified with repository-backed knowledge documents; migration to canonical skill documents is a planned integration, not a completed runtime feature.
- Chat history: user/assistant transcripts.
- Agent journal: immutable operational events and execution evidence.

## Structure

```text
docs/knowledge/
├── README.md
├── architecture/
│   └── multi-agent-runtime.md
├── roles/
│   ├── coordinator.md
│   ├── manager.md
│   ├── dispatcher.md
│   ├── researcher.md
│   ├── analyst.md
│   ├── architect.md
│   ├── developer.md
│   ├── coder.md
│   ├── tester.md
│   └── qa.md
├── procedures/
│   ├── project-discovery.md
│   ├── lightweight-discovery.md
│   ├── team-execution.md
│   └── ui-audit.md
├── protocols/
│   ├── task-handoff.md
│   ├── procedure-lifecycle.md
│   └── worker-result.md
├── schemas/
│   └── agent-handoff.v1.schema.json
├── proposals/
│   └── README.md
└── lessons/
    └── README.md
```

## Role boundaries

- **Coordinator** is the application-level primary-agent entry point; **Manager** owns decisions inside a bounded multi-specialist team run.
- **Dispatcher** decomposes a Manager-approved objective; **Researcher** prepares repository context; **Analyst** answers a bounded technical question.
- **Architect** designs system boundaries and procedures; **Developer** implements feature-level or cross-module work; **Coder** handles a narrowly bounded code change.
- **QA** owns the quality assessment and acceptance evidence; **Tester** executes a defined test set and returns reproducible results.

## Document contract

### Machine-readable metadata

Every runtime-loadable document must start with YAML frontmatter at byte zero containing:
- Stable `id`.
- Semantic `version`.
- `status`: `draft`, `review`, `approved`, or `deprecated`.
- `owner_role`.
- `triggers` where task-based routing is relevant.

IDs remain stable across file renames. Filenames use lowercase kebab-case.

### Content expectations by document type

- **Roles:** mission, responsibilities, workflow, capability/permission boundaries, expected output, and completion/escalation behavior.
- **Procedures:** triggers, required inputs, ordered steps, expected outputs, permission boundaries, verification, and failure/escalation behavior.
- **Protocols:** exact message/result fields, validation rules, version compatibility, and terminal/error behavior.
- **Architecture:** current implementation mapping, target contracts, safety invariants, and explicit gaps between current and target behavior.

These content expectations are authoring rules; the runtime loader validates metadata and approval status, not every Markdown section.

## Current loader boundary

The current `server/knowledgeManager.ts` implementation scans only direct `.md` files in these four directories: `architecture/`, `roles/`, `procedures/`, and `protocols/`. It excludes `README.md` and does not recurse into nested directories.

Each loaded document must start at byte zero with YAML frontmatter containing `id`, semantic `version`, `status`, and `owner_role`. The loader extracts `triggers` when present, enforces a 64 KiB size limit, and rejects paths that escape the knowledge root. Only approved documents can be read through the approved-document retrieval function.

The `schemas/`, `proposals/`, and `lessons/` directories are repository-managed knowledge assets, but they are not currently loaded by this runtime catalog. Do not describe them as runtime-available or move them into a scanned category without a separately tested loader change.

## Lifecycle and authority

1. Drafts may be proposed by any role, but are not automatically executable.
2. The Architect reviews structure, safety, scope, and consistency.
3. QA validates that instructions are testable and do not claim unavailable capabilities.
4. The project owner/user or another explicitly designated approval authority approves publication; the Coordinator routes the request but does not grant itself approval authority.
5. Only `approved` documents may be selected automatically by runtime routing.
6. Changes to an approved document require a new version and review. Keep the previous version in Git history.
7. A lesson from one task is a candidate, not an approved rule. Repeated evidence or an explicit owner decision is required before promotion.

## Runtime integration target

The runtime should load this repository-backed knowledge through a Knowledge Manager, index metadata, and retrieve only relevant approved documents. Do not inject the entire knowledge base into every model request.

The protocol catalog contains task-handoff, procedure-lifecycle, and worker-result contracts.

Knowledge role IDs (for example, `role.manager`) identify versioned instruction documents. They are distinct from configurable UI model-role profile IDs (for example, `role-developer`) in `src/data/rolesAndRules.ts`; do not merge or rename one namespace based on similar display names.

The runtime integration exposes an approved-document catalog and read-only document retrieval to the project coordinator. The approved role and procedure set now defines a Manager/Dispatcher/specialist team model, bounded sequential execution, and deterministic-first lightweight discovery. These documents are available as knowledge; they do not mean runtime delegation, worker-result validation, model-tier routing, proposal review UI, or publication approval workflows are implemented.
