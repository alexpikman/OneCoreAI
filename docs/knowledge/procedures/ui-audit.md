---
id: procedure.ui-audit
version: 1.0.0
status: approved
owner_role: qa
triggers:
  - ui_audit
  - visual_regression_review
  - responsive_review
inputs:
  - task_objective
  - project_discovery_handoff
outputs:
  - qa_findings
  - coverage_report
---

# UI and UX Audit


## Scope

Audit the requested interface area only. Separate source-level inspection from runtime/browser visual verification. Do not claim visual verification when no browser, screenshot, or running application evidence is available.

## Required dimensions

1. **Structure and hierarchy** — content priority, grouping, navigation, consistency.
2. **Design system** — token usage, typography, spacing scale, radii, borders, shadows, icon consistency.
3. **Themes** — light and dark parity, contrast, state visibility.
4. **Responsive behavior** — overflow, minimum widths, breakpoints, narrow-screen behavior.
5. **Interaction states** — loading, empty, error, success, disabled, focus, hover, active, selected.
6. **Accessibility** — semantic controls, labels, keyboard access, focus visibility, contrast.
7. **Regression risk** — shared component effects, layout ownership, duplicated styling, state changes.

## Workflow

1. Consume the researcher handoff. Do not restart broad repository discovery.
2. Inspect only supplied files and directly related imports/callers/tests.
3. Map findings to the dimensions above; mark dimensions not covered.
4. Check the project's documented design constraints before recommending layout changes.
5. If runtime verification is available and authorized, inspect representative light/dark and responsive states. Otherwise mark these checks as not performed.
6. Record each defect with severity, exact evidence, reproduction/condition, impact, and recommendation.
7. Return the report to the coordinator.

## Severity

- **Critical** — blocks core usage, exposes data, or causes severe accessibility failure.
- **High** — major workflow or layout failure affecting a broad set of users.
- **Medium** — clear usability, consistency, responsive, or state-handling defect with a workaround.
- **Low** — minor visual inconsistency or polish issue.

## Report format

- Scope and supplied files.
- Checks performed and not performed.
- Findings ordered by severity.
- Successful checks.
- Coverage gaps and environmental limitations.
- Overall result: `PASS`, `PASS_WITH_WARNINGS`, or `FAIL`.

A PASS is allowed only when all required checks in the assigned scope were performed and no blocking findings remain. A source-only review must explicitly say that it is not a visual runtime audit.
