# Documentation-First Knowledge Architecture

## 1. Decision

Reusable knowledge and behavioral definitions in ONE CORE AI are authored and versioned as repository documents. The «Справочники» area is the catalog, relationship browser, editor, and approval surface over those documents and their indexed metadata.

The registry is a derived, queryable view of the document graph. It is not a second place where the same role, procedure, skill, or instruction is independently authored.

This is a target architecture. The current Knowledge Manager supports only the limited runtime boundary documented in `docs/knowledge/README.md`; this contract does not claim that all document types are currently loaded or editable in the application.

## 2. What belongs in documents

Use version-controlled Markdown (and machine-readable schemas where appropriate) for stable, reusable, reviewable definitions:

- architecture contracts and system boundaries;
- agent and role contracts;
- routes and routing policies;
- reusable procedures and workflows;
- skills and their instructions/references;
- reusable instructions and policies;
- tool and capability contracts;
- handoff/result protocols and JSON schemas;
- reviewed lessons promoted into approved knowledge;
- project documentation that describes project architecture, conventions, decisions, and constraints.

Documents should be small enough to load selectively, have stable IDs, link to related documents, and carry explicit lifecycle/version metadata where runtime selection applies.

## 3. What must remain structured runtime data

Do not force changing operational data into Markdown files. Keep these in their owning stores/services and reference them from documents where useful:

- chat transcripts and session state;
- active tasks, task status, dependencies, and assignments;
- operation state, tool results, event streams, and journals;
- project-specific live memory and user-approved durable memory records;
- secrets, credentials, tokens, and access grants;
- provider/model availability and runtime health;
- user-specific agent assignments, enabled state, and mutable settings where these are operational configuration;
- per-turn context manifests and audit records.

A document may define the schema, policy, or retrieval rules for such data, but it must not become an alternate database for live state. Memory records are data with provenance and lifecycle, not automatically reusable global instructions.

## 4. Canonical ownership and document relationships

Use one canonical owner for each reusable definition:

| Concern | Canonical source |
|---|---|
| Engineering workflow and repository-wide constraints | `docs/governance/` |
| Application architecture and target contracts | `docs/architecture/` |
| Current state, milestones, and roadmap | `docs/project/` |
| Runtime-loadable roles, procedures, protocols, routes, skills, and approved reusable instructions | `docs/knowledge/` |
| Machine-readable contracts | `docs/knowledge/schemas/` or the owning subsystem's schema directory |
| User/project live facts and mutable memory | Existing memory/project data services |
| Runtime operations and evidence | Existing operation and agent journals |

Do not copy the same full rule into multiple files. Put the rule in its canonical document and link to it from indexes, project documents, roles, and procedures. If a short summary is needed, label it as a summary and link to the canonical source.

Use stable document IDs in machine-facing references; use relative Markdown links for human navigation. A rename must not break ID-based references. The registry should be able to resolve an ID to its current approved version and repository path.

## 5. «Справочники» as a document catalog

The «Справочники» page should read from the same document inventory that runtime uses. It should not maintain its own copies of document content or independent status values.

The catalog should expose:
- document ID, title, type/category, version, lifecycle status, owner, and triggers;
- references to agents, roles, routes, procedures, skills, tools, and related documents;
- incoming and outgoing links so the operator can see what depends on a document;
- whether the document is indexed, approved, available to runtime, and actually used by a runtime path;
- validation errors, duplicate IDs, unresolved references, and stale links;
- version history and review/approval history where available.

The UI may provide editing workflows, but publication must update the canonical document through a controlled write path, validate metadata and references, and preserve Git history. Draft content must not become active merely because it is saved.

## 6. Agent and project references

A project should be able to declare the documents that govern work in that project, without copying their contents. For example, a project context manifest may reference:
- its architecture and development conventions;
- required roles and skills;
- approved procedures for common tasks;
- project-specific constraints and acceptance rules;
- explicitly allowed tools/capabilities.

The Coordinator/Context Builder resolves these references at task start and again before each model turn as needed. It loads only the relevant approved versions and records the IDs/versions used in the turn manifest.

An agent definition should reference its role, skills, reusable instructions, and memory policy by stable ID. A route should reference its procedure and target role/agent. A procedure may reference skills, tools, protocols, schemas, and other procedures. References form a graph; avoid embedding full copies of linked documents.

Project-local overrides must be explicit, scoped to that project, and unable to weaken application security policy. An untrusted project file cannot register itself as approved knowledge or modify global agent behavior.

## 7. Document contract and metadata evolution

The current runtime document contract requires YAML frontmatter at byte zero with `id`, semantic `version`, `status`, and `owner_role`; task-routed documents may also provide `triggers`. Preserve this contract for currently loaded documents.

As the registry expands, define and version a typed metadata schema rather than adding ad hoc parser assumptions. The target schema should support:
- `id`, `type`, `version`, `status`, `owner`;
- optional `triggers`, `tags`, and `scope`;
- typed references to other stable document IDs;
- compatibility constraints and required runtime capabilities;
- review/approval metadata and deprecation/replacement references.

Metadata extensions must be backward-compatible or introduced through a tested schema/loader migration. Markdown prose remains human-readable; machine-readable relationships belong in validated frontmatter or a sidecar schema, not fragile free-text parsing.

## 8. Loading, indexing, and trust

- The Knowledge Manager remains the canonical runtime loading boundary; extend it deliberately rather than adding a second document scanner.
- Build a derived index from canonical documents. The index/cache must be rebuildable and must never become the source of truth.
- Parse and validate metadata, stable IDs, versions, status, references, file size, path containment, and document type.
- Only approved, enabled, compatible documents may be selected automatically.
- Retrieve by task relevance and explicit project/agent references; do not inject the entire documentation tree into every prompt.
- Treat document body text as trusted only according to its publication state and source. Repository/project content supplied by an untrusted project remains untrusted even if it contains Markdown frontmatter resembling a knowledge document.
- Resolve all references inside the configured documentation roots. Do not allow path traversal, external path loading, or arbitrary URL inclusion as an implicit tool permission.
- Record the exact document IDs and versions loaded for each model turn.

## 9. Change lifecycle

1. Create or edit a document in draft state.
2. Validate metadata, schema, references, duplicate IDs, scope, and consistency.
3. Review architecture/safety and testability according to document type.
4. Obtain explicit publication approval from the configured authority.
5. Publish an approved version and rebuild/update the derived index.
6. Make the new version available to subsequent runtime turns.
7. Preserve prior versions and references for in-flight and historical operations.
8. Deprecate obsolete documents with an explicit replacement link where applicable.

Model-generated proposals and lessons remain drafts until reviewed and approved. The agent that proposes a change cannot approve or publish it unless the user explicitly grants that authority through the application.

## 10. Migration sequence

1. Inventory existing documentation, runtime knowledge categories, skills, memory stores, agent settings, and project manifests.
2. Assign canonical ownership and stable IDs; identify duplicates and references without moving files blindly.
3. Define the typed document metadata schema and reference validation rules.
4. Extend the existing Knowledge Manager to index the additional approved document types, retaining current path and size protections.
5. Connect «Справочники» to the same inventory and expose status, references, and validation.
6. Add project and agent document-reference manifests.
7. Integrate reference resolution into the single Context Builder and per-turn journal.
8. Add controlled editing, review, approval, versioning, and Git persistence.
9. Migrate skills and reusable instructions one category at a time; keep live memory and operational records in their existing data services.
10. Verify with tests for invalid metadata, unresolved/duplicate references, unapproved documents, project isolation, deprecation, version pinning, path traversal, and context provenance.

Do not bulk-convert all settings or memory into Markdown before ownership and lifecycle are clear. Do not replace existing storage or execution services as part of the document catalog migration.
