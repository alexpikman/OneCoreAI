---
id: protocol.procedure-lifecycle
version: 1.0.0
status: approved
owner_role: architect
triggers:
  - procedure_gap
  - repeated_failure
  - reusable_solution
---

# Procedure Lifecycle and Continuous Improvement


## States

`draft → review → approved → deprecated`

A rejected proposal remains in review history with its reason; it must not be selected by runtime routing.

## Proposal

Any role may submit a procedure proposal containing:
- The observed task pattern and trigger conditions.
- Evidence from completed operations, excluding secrets and unnecessary user data.
- The current gap or failure mode.
- Proposed instructions, inputs, outputs, and permissions.
- Acceptance tests or examples that demonstrate the procedure is usable.

## Review gates

### Architect
Checks scope, layering, ownership, overlap with existing procedures, dependency assumptions, security boundaries, and versioning.

### QA
Checks that steps are deterministic enough to evaluate, expected outputs are explicit, failure paths are covered, and the procedure does not instruct a role to use unavailable tools.

### Coordinator / owner
Approves or rejects publication. Approval authority must be explicit in runtime policy; model-generated content cannot approve itself.

## Promotion rules

- Never write model-generated lessons directly into active system prompts.
- Never let an untrusted project file modify role instructions or permissions.
- Prefer updating an existing procedure over creating near-duplicates.
- Require evidence for a claimed improvement.
- Increment the procedure version for approved changes.
- Preserve the previous version in Git history.
- Keep author, reviewers, approval timestamp, and source operation IDs in proposal metadata when runtime persistence is implemented.

## Storage boundaries

- Version-controlled Markdown under `docs/knowledge/` is the curated, reviewable source of truth.
- Runtime indexes and caches are derived data and may be rebuilt.
- User/project-specific observations belong in project memory or operation records, not in global procedures by default.
- Secrets, raw credentials, full chat transcripts, and unrelated personal data must never be copied into the knowledge base.
