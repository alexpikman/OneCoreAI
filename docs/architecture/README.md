# Architecture Documentation

This directory describes the architecture of ONE CORE AI from two distinct perspectives:

1. **As implemented** — behavior verified against the current `main` source.
2. **Target principles** — contracts proposed for future stabilization; these are not claims that the behavior already exists.

The documents are deliberately technology-aligned with the current application. They do not introduce a replacement architecture or copy implementation code from PQlocalAgentOSv3.

## Reading order

- [System map](SYSTEM_MAP.md) — runtime boundaries, major modules, and data flow.
- [AI providers, model runtime, and external API](AI_PROVIDER_AND_SERVER_ARCHITECTURE.md) — normative provider-agnostic architecture, local/remote/cloud runtimes, per-agent routing, and the API exposed to external clients.
- [Documentation-first knowledge architecture](DOCUMENTATION_FIRST_KNOWLEDGE.md) — documents as canonical reusable definitions, «Справочники» as their catalog, project/agent references, runtime loading, and the boundary between documents and live data.
- [Agent registry, skills, memory, and per-turn context](AGENT_REGISTRY_AND_CONTEXT.md) — target contract for configurable agents and roles, route/procedure/skill relationships, scoped memory, instruction precedence, Context Builder, and turn-level traceability.
- [Navigation and application shell](NAVIGATION_AND_SHELL.md) — static/dynamic sidebar taxonomy, route mappings, shell constraints, and known gaps.
- [Operation lifecycle](OPERATION_LIFECYCLE.md) — proposed lifecycle and cancellation contract.
- [Live system map and external references](LIVE_SYSTEM_MAP_AND_EXTERNAL_REFERENCES.md) — evidence-backed live execution tracing and the isolated «КАК У ДРУГИХ» research library.
- [Security and approvals](SECURITY_AND_APPROVALS.md) — source findings, Local Session Token design, and the target Approval Ticket protocol.
- [API security matrix](API_SECURITY_MATRIX.md) — endpoint-by-endpoint risk classification, current controls, callers, and test evidence.
- [Implementation status](IMPLEMENTATION_STATUS.md) — implemented, partial, planned, and unverified capabilities.
- [Test map](TEST_MAP.md) — existing verification entry points and gaps.
- [Architecture audit and roadmap](ARCHITECTURE_AUDIT_AND_ROADMAP.md) — source-based findings and staged implementation order.

## Agent knowledge and delegation

- [Knowledge base index](../knowledge/README.md) — roles, approved procedures, handoff protocols, schemas, proposals, and reviewed lessons.
- [Multi-agent runtime architecture](../knowledge/architecture/multi-agent-runtime.md) — coordinator, routing, execution, context, knowledge, and infrastructure layers. This is a target contract; consult `IMPLEMENTATION_STATUS.md` and source before assuming a capability exists.
- [Agent registry and context architecture](AGENT_REGISTRY_AND_CONTEXT.md) — how the management registry relates to repository-backed knowledge and how effective context is assembled for every model turn.
- [Intelligence Library](../intelligence-architecture/README.md) — General Agent ontology, Playbook Schema, Execution Model, Capability Contract, Decision Trace and first read-only Playbook.

## Status vocabulary

- **Implemented** — the behavior is present in the inspected source.
- **Partial** — some parts exist, but the complete contract is not enforced end-to-end.
- **Planned** — a target principle or future work item; not currently implemented.
- **Unverified** — source suggests behavior, but runtime/platform evidence has not been checked in this documentation pass.

## Source of truth

Application code, types, tests, and the existing project governance documents remain authoritative. If this documentation conflicts with the implementation, record the discrepancy and update the documentation only after checking the current source. Do not silently change API contracts to match a diagram.

## Scope and safety

This documentation-only stage does not change application code, API routes, persisted data, UI behavior, dependencies, or runtime configuration. Future implementation work must be separately scoped and verified.
