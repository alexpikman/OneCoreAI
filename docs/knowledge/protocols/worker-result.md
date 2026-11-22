---
id: protocol.worker-result
version: 1.0.0
status: approved
owner_role: architect
triggers:
  - delegated_task
  - specialist_completion
  - team_execution
---

# Specialist Worker Result Protocol


## Required result
Every specialist returns a machine-parseable object conforming to the handoff output contract, containing:
- schemaVersion: supported result schema version.
- taskId and operationId: exact identifiers copied from the handoff.
- status: completed, blocked, needs_more_context, failed, or cancelled.
- summary: concise result.
- findings: severity, statement, evidence paths/ranges, impact, and recommendation.
- filesInspected: exact paths actually read, not merely listed or searched.
- checks: command, execution status, exit code, and concise output; omit commands not run.
- unresolvedQuestions: concrete missing inputs or uncertainties.
- limitations: coverage and capability limitations.

## Validation rules
1. Reject mismatched task or operation IDs.
2. Reject unknown statuses and malformed required fields.
3. Do not accept a path as inspected unless an application tool confirms the read.
4. Do not accept a check as passed unless an execution result confirms exit code zero.
5. Keep untrusted worker prose separate from application-generated evidence.
6. A terminal worker status does not imply overall task completion.

Runtime code must validate results at the worker boundary. Until an executable result schema and validator exist, this remains a design contract and must not be represented as runtime-enforced.
