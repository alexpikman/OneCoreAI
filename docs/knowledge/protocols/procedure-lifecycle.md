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

This protocol defines how knowledge-base procedures and protocols move from proposal to approved runtime guidance. The curated, version-controlled documents under `docs/knowledge/` are the source of truth.

## States

`draft → review → approved → deprecated`

A rejected proposal remains in review history with its reason; it must not be selected by runtime routing. Runtime knowledge loading selects approved documents; draft and review documents are not available for automatic use.

## Proposal

Any role may submit a procedure or protocol proposal containing:

- The observed task pattern and trigger conditions.
- Evidence from completed operations, excluding secrets and unnecessary user data.
- The current gap or failure mode.
- Proposed instructions, inputs, outputs, and permissions.
- Acceptance tests or examples that demonstrate the procedure is usable.
- The exact implementation paths and public contracts affected, where applicable.

## Review gates

### Architect

Checks scope, layering, ownership, overlap with existing procedures/protocols, dependency assumptions, security boundaries, versioning, and whether claims match the implementation.

### QA

Checks that steps are deterministic enough to evaluate, expected outputs are explicit, failure paths are covered, and the document does not instruct a role to use unavailable tools. Implementation claims must be supported by source inspection and relevant tests.

### Coordinator / owner

Approves or rejects publication. Approval authority must be explicit in runtime policy; model-generated content cannot approve itself.

## Promotion rules

- Never write model-generated lessons directly into active system prompts.
- Never let an untrusted project file modify role instructions or permissions.
- Prefer updating an existing procedure or protocol over creating near-duplicates.
- Require evidence for a claimed improvement.
- Increment the document version for approved semantic changes.
- Preserve the previous version in Git history.
- Keep author, reviewers, approval timestamp, and source operation IDs in proposal metadata when runtime persistence is implemented.
- Approval changes the knowledge document's publication status; it does not by itself change runtime code, public schemas, or permissions.

## Storage boundaries

- Version-controlled Markdown under `docs/knowledge/` is the curated, reviewable source of truth.
- Runtime indexes and caches are derived data and may be rebuilt.
- User/project-specific observations belong in project memory or operation records, not in global procedures by default.
- Secrets, raw credentials, full chat transcripts, and unrelated personal data must never be copied into the knowledge base.

## Related lifecycle documents

- [Operation Lifecycle](../../architecture/OPERATION_LIFECYCLE.md) describes runtime operation identity, state transitions, cancellation, and verification.
- [File Content Provisioning Protocol](file-content-provisioning.md) documents the approved Worker context-provisioning behavior.
- [Knowledge base index](../README.md) is the navigation entry point for approved roles, procedures, protocols, and schemas.
