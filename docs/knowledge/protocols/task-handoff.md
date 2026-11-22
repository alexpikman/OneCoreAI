---
id: protocol.task-handoff
version: 1.0.0
status: approved
owner_role: architect
triggers:
  - delegated_task
  - specialist_review
  - multi_stage_workflow
---

# Agent Task Handoff Protocol


## Purpose

A handoff is a bounded contract between the coordinator and one worker. It prevents repeated repository discovery, vague delegation, and unsupported completion claims.

## Required fields

```ts
type HandoffStatus =
  | "ready"
  | "completed"
  | "blocked"
  | "needs_more_context"
  | "failed"
  | "cancelled";

interface AgentHandoff {
  schemaVersion: 1;
  taskId: string;
  operationId: string;
  parentOperationId?: string;
  fromRole: string;
  toRole: string;
  objective: string;
  acceptanceCriteria: string[];
  procedureRefs: Array<{ id: string; version: string }>;
  project: {
    projectId: string;
    rootLabel?: string;
    constraints: string[];
  };
  files: Array<{
    path: string;
    purpose: string;
    evidence: "listed" | "searched" | "read";
    excerpts?: Array<{ startLine?: number; endLine?: number; content: string }>;
  }>;
  findings: string[];
  completedSteps: string[];
  unresolvedQuestions: string[];
  allowedCapabilities: string[];
  outputFormat: string;
  status: HandoffStatus;
}
```

The TypeScript shape is a normative contract sketch. Runtime code must define one authoritative executable schema and validate both incoming and outgoing payloads at boundaries.

## Coordinator responsibilities

- Supply exact project-relative paths discovered by tools; never fabricate paths.
- Distinguish listed, searched, and actually read files.
- Include only relevant excerpts and keep context within provider limits.
- Include the applicable procedure ID and version.
- State what the worker must not do.
- Define acceptance criteria and output format.
- Assign a stable operation ID and parent operation ID.

## Worker responsibilities

- Treat the handoff as the complete assigned scope.
- Start with supplied evidence; do not rescan the whole repository.
- Request specific missing paths or evidence when needed.
- Do not claim a file was read unless its content is included or a tool confirms the read.
- Do not expand scope, change permissions, or delegate further unless explicitly allowed.
- Return findings with file path and line/range evidence where available.
- Mark uncertainty and incomplete checks explicitly.

## Return report

A worker result must contain:
- Task and operation IDs.
- Status.
- Summary.
- Findings with severity, evidence, impact, and recommendation.
- Files actually inspected.
- Checks actually executed and their exit codes.
- Unresolved questions and coverage limitations.
- Suggested follow-up work.

## Validation

The coordinator rejects or repairs a handoff when IDs, objective, acceptance criteria, or output contract are missing. It does not treat a natural-language statement such as "done" as proof of completion.
