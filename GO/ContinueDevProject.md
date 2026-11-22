# Continue OneCoreAI Development

Repository: https://github.com/alexpikman/OneCoreAI
Default branch: `main`

This file is a short continuation entry point. The documentation map and authoritative rules live under `docs/`.

## Startup sequence

1. Confirm the repository is `alexpikman/OneCoreAI` and inspect the latest commit, diff, and working tree. A remote connector may not expose the local working tree; state that limitation.
2. Read [Documentation index](../docs/README.md) and [AI Working Rules](../docs/governance/AI_WORKING_RULES.md).
3. Read [Current Work](../docs/project/CURRENT_WORK.md) and [Development Plan](../docs/project/DEVELOPMENT_PLAN.md).
4. Read [Architecture index](../docs/architecture/README.md) and only the documents relevant to the task.
5. Read [Knowledge Base index](../docs/knowledge/README.md); retrieve only applicable approved role, procedure, and protocol documents. Drafts and proposals are not active instructions.
6. Inspect actual source, callers, types, tests, and CI for the requested change. Verify every path against the current repository.
7. Make a focused change, update relevant documentation, run applicable checks, and report exact evidence. Never claim an unrun check passed.

## Quick constraints

- Work directly on `main`; do not create branches or pull requests unless explicitly requested.
- Extend existing orchestrator, permission, operation, journal, provider, and event infrastructure. Do not create competing runtimes.
- Preserve security boundaries, explicit approvals, project allowlists, and the approved three-column application shell.
- Only approved, versioned knowledge documents may be used for automatic routing.
- Keep source files UTF-8 without BOM.
- Standard checks: `npm run lint`, `npm test`, `npm run build`, `npm run check:encoding`.
- Separate source inspection, automated tests, CI, build, and runtime verification in every report.
