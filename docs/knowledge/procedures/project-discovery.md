---
id: procedure.project-discovery
version: 1.0.0
status: approved
owner_role: researcher
triggers:
  - unfamiliar_project_area
  - delegated_task_needs_file_manifest
inputs:
  - task_objective
  - project_metadata
outputs:
  - file_manifest
  - dependency_map
  - context_gaps
---

# Targeted Project Discovery


## Objective

Find the smallest set of real source files required for a downstream task. Discovery is evidence collection, not a full repository dump.

## Steps

1. Confirm the active project and its verified root.
2. Read the project description, task constraints, tool permissions, and relevant plan.
3. Enumerate files through the project filesystem tool.
4. Exclude generated/build/dependency/cache directories by default (for example `node_modules`, `.git`, `dist`, `build`, `dev-dist`, `.next`, and tool caches). Re-include them only when the task explicitly concerns build output or generated artifacts.
5. Classify the request into a domain such as UI, frontend logic, backend/API, persistence, security, tests, or build/release.
6. Rank files using source directories, package scripts, entry points, imports/callers, and matching tests. Do not infer paths from conventional names; use the actual inventory.
7. Search for relevant symbols, route names, component names, and callers.
8. Read the highest-value files and record exact paths. A listed file is not a read file.
9. Stop when the task's acceptance criteria can be investigated with the collected evidence or when a specific gap blocks progress.
10. Return a structured handoff.

## UI-specific prioritization

For a UI/UX audit, inspect actual application entry points, route/page composition, shared components, design tokens, styles, and related tests. Inspect generated assets, service-worker output, CI workflows, and platform build scripts only when the audit explicitly includes them or a source-level finding requires them.

## Output requirements

Return:
- Task domain and recommended procedure.
- Relevant file paths with evidence level (`listed`, `searched`, `read`).
- Why each file is relevant.
- Important import/call relationships.
- Excluded directories and reason.
- Unresolved context gaps.

## Completion criteria

A downstream specialist can begin without repeating broad repository discovery, and every supplied path is verified against the project inventory.
