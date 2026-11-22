---
id: procedure.lightweight-discovery
version: 1.0.0
status: approved
owner_role: architect
triggers:
  - repository_inventory
  - file_classification
  - context_preparation
  - routine_project_scan
---

# Lightweight Discovery and Triage


## Goal
Use deterministic tools for predictable repository work and reserve lightweight models for bounded decisions that benefit from semantic interpretation.

## Procedure
1. Confirm project root, ignore rules, path boundaries, and read permissions.
2. Enumerate files and metadata with deterministic filesystem tools. Exclude dependencies, generated output, caches, binaries, and ignored paths by default.
3. Run deterministic filename, extension, symbol, and text searches for the assigned query.
4. If useful, send a lightweight model only a bounded manifest or selected excerpts for classification, relevance ranking, extraction, or concise summaries.
5. Require structured output with exact input paths/IDs, labels, confidence, and short evidence snippets. Treat malformed output as unavailable.
6. Reconcile model output with source metadata and discard references absent from the supplied manifest.
7. Escalate ambiguous, cross-module, security-sensitive, or consequential questions to a stronger specialist or Manager.
8. Return the manifest, search coverage, exclusions, and uncertainty.

## Constraints
Never send secrets, credentials, private keys, or unrelated file contents to a model. Lightweight workers are read-only and cannot execute commands, write files, mutate Git, or change permissions. Deterministic search remains useful when no lightweight provider is configured. Never scan outside the active project root.
