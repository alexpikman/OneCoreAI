# OneCoreAI documentation

This directory is the documentation home for OneCoreAI. Use this index to find the authoritative document for each concern; do not duplicate rules or status across documents.

## Authority model

Documentation has two independent authority axes.

### A. Agent behavior and governance

Defines what AI agents are allowed to do and how they must work. Higher-level rules constrain lower-level procedures.

1. [AI Working Rules](governance/AI_WORKING_RULES.md) — engineering constitution: workflow, security, UI constraints, source hierarchy, verification.
2. [Project Agent Instructions](governance/PROJECT_AGENT_INSTRUCTIONS.md) — runtime contract for the Project Agent operating inside user projects.
3. [Knowledge base](knowledge/README.md) — reusable roles, procedures, protocols, and lifecycle rules.

### B. Facts about the application

1. **Source code, types, executable schemas, tests, and observed runtime evidence** — authority for current behavior.
2. [Architecture](architecture/README.md) — system boundaries, contracts, target principles, and known gaps.
3. [Project records](project/README.md) — current snapshot, roadmap, and completed milestone history.

If implementation diverges from an architecture contract, record and investigate the divergence. Do not silently rewrite the target contract to match a bug. Documentation cannot declare a feature implemented without source and verification evidence.

## Documentation areas

| Area | Purpose | Start here |
|---|---|---|
| Governance | Rules for AI-assisted engineering and Project Agent behavior | [AI Working Rules](governance/AI_WORKING_RULES.md) |
| Project | Current state, future work, completed milestone history | [Project records](project/README.md) |
| Architecture | Technical structure, lifecycle, security, implementation evidence, tests | [Architecture index](architecture/README.md) |
| Knowledge | Approved roles, procedures, protocols, schemas, proposals, lessons | [Knowledge index](knowledge/README.md) |
| Intelligence architecture | General Agent ontology, Playbook contracts, execution model and traceability | [Intelligence Library](intelligence-architecture/README.md) |
| Archive | Superseded snapshots; not active instructions | [Legacy archive](archive/legacy/) |

## Reading paths

- Starting development: this index → AI Working Rules → Current Work → relevant architecture → relevant approved knowledge.
- Understanding the system: Architecture index → System Map → relevant subsystem contract → Implementation Status and Test Map.
- Working on agent behavior: Knowledge index → applicable role → applicable procedure → required protocol/schema.
- Designing agent management or model context: [Documentation-first knowledge architecture](architecture/DOCUMENTATION_FIRST_KNOWLEDGE.md) → [Agent Registry, Skills, Memory, and Per-Turn Context](architecture/AGENT_REGISTRY_AND_CONTEXT.md) → Knowledge index.
- Planning work: Current Work for the present; Development Plan for future; Changelog for completed milestones.

## Source boundaries

- Reusable, approved agent behavior is authored in version-controlled knowledge documents. «Справочники» is intended to catalog and manage these canonical documents, not maintain duplicate prompt/rule copies.
- `docs/knowledge/` is the runtime-curated knowledge base. Its currently supported category layout and YAML frontmatter are constrained by `server/knowledgeManager.ts`; do not move or nest runtime documents without updating and testing the loader.
- Governance, project, and architecture documents provide human/project context but are not automatically runtime knowledge entries.
- Live memory, chat history, tasks, operation state, secrets, and journals remain in their owning structured stores; documents define their policies and contracts rather than replacing those stores.
- `GO/ContinueDevProject.md` is only a short entry point. This index is the canonical navigation map.
- Archived documents preserve context but must not be treated as current instructions.
