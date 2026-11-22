---
id: procedure.team-execution
version: 1.0.0
status: approved
owner_role: architect
triggers:
  - complex_project_task
  - task_requires_multiple_specialists
  - independent_analysis_and_implementation
---

# Bounded Team Execution


## Inputs
User objective and constraints; active project identity; project permissions; configured provider/model profiles; approved role contracts and handoff schema; operation/session/message context and cancellation signal.

## Procedure
1. Manager defines acceptance criteria, scope, and risk. If one worker or deterministic tools suffice, do not start a team.
2. Dispatcher proposes a task graph and assigns Analyst, Researcher, Architect, Coder, or Tester roles.
3. Manager validates decomposition, assignments, dependencies, capabilities, and call budget.
4. Execute specialist tasks sequentially in the initial implementation. A maxParallel setting does not prove parallel safety.
5. Each worker receives one schema-valid handoff. Capabilities are the intersection of project policy, caller-granted capabilities, and role contract.
6. Validate each report: task/operation identity, status, evidence, inspected files, checks, and unresolved questions.
7. Manager reconciles reports and verifies acceptance criteria against actual tool results.
8. Dispatcher may propose a bounded follow-up cycle; Manager approves it before execution.
9. Stop after a maximum 8 specialist tasks per cycle and a maximum 4 cycles. Stop earlier on cancellation, timeout, permission denial, or missing critical evidence.
10. Record lifecycle events through the existing Agent Journal and operation registry.

## Failure handling
- Invalid handoff/report: reject it; do not silently coerce missing evidence.
- Provider unavailable: retry only within the configured budget, otherwise report blocked.
- Missing permission: request permission or stop; never use a more privileged worker to bypass policy.
- Cancellation: propagate the existing abort signal and prevent new workers from starting.
- Conflicting reports: request targeted evidence or bounded independent review.
- Budget exhausted: return partial findings and identify unmet criteria.

## Safety
No worker may autonomously spawn another worker in the initial rollout. Workers cannot approve file writes, shell commands, Git mutations, or knowledge publication. Reuse the existing provider adapter, permission manager, operation registry, and Agent Journal.

## Completion
Every accepted handoff has a terminal status, and Manager has checked evidence against acceptance criteria. Final status is completed, blocked, failed, or cancelled.
