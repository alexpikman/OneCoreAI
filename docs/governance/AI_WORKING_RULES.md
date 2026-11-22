# AI Working Rules

## Repository workflow
- Work directly on the `main` branch.
- Do not create feature/fix branches, pull requests, or alternate release branches unless the project owner explicitly requests them.
- Before editing, inspect the current repository state and latest commits. Never assume an earlier checkout is current.
- Make focused commits with descriptive messages. One change, one reason, one commit. Do not bundle unrelated cleanup.
- Show the relevant diff and report exactly which checks were and were not run.
- Do not claim that a change works until its behavior has been verified. Distinguish source inspection, static checks, automated tests, production build, and runtime/browser verification.
- Prefer the smallest safe change. Split broad work into independently reviewable steps.
- Remove dead code when its lack of purpose is established; do not delete uncertain code speculatively.

## Project information sources and authority

Use this source map before making assumptions. Read the relevant sources for the task; do not load every document or every source file indiscriminately.

### Repository identity and baseline
- This repository is `alexpikman/OneCoreAI`. Do not switch to another repository or assume that a separate checkout reflects the current state of this repository.
- `README.md` — product purpose, supported runtime, setup, and top-level documentation links.
- `package.json` and lockfile — actual scripts and installed dependency versions. These override remembered commands or assumptions.
- Latest commit on `main`, current Git diff, and working tree — actual change baseline. Inspect these before editing; chat summaries are not a substitute.
- `GO/ContinueDevProject.md` — continuation entry point and mandatory reading sequence.

### Project governance and current status
- `docs/governance/AI_WORKING_RULES.md` — authoritative engineering, security, UI, delegation, and response rules.
- `docs/project/DEVELOPMENT_PLAN.md` — planned work and completion tracking; a checked item is not runtime proof without source/test evidence.
- `docs/project/CURRENT_WORK.md` — latest recorded implementation state, verification evidence, and known remaining work. Reconcile it with current source and CI before relying on it.
- `docs/architecture/README.md` — architecture-document index and reading order.

### Architecture and implementation evidence
- `docs/architecture/SYSTEM_MAP.md` — runtime boundaries, module ownership, and data flow.
- `docs/architecture/IMPLEMENTATION_STATUS.md` — implemented/partial/planned/unverified status.
- `docs/architecture/OPERATION_LIFECYCLE.md` — operation identity, state, cancellation, parent/child semantics.
- `docs/architecture/SECURITY_AND_APPROVALS.md` and `API_SECURITY_MATRIX.md` — security boundaries, endpoint controls, approvals, and gaps.
- `docs/architecture/TEST_MAP.md` — test entry points and verification gaps.
- `docs/architecture/ARCHITECTURE_AUDIT_AND_ROADMAP.md` — evidence-based findings and staged implementation sequence.
- `docs/architecture/NAVIGATION_AND_SHELL.md` — approved shell, navigation ownership, and UI constraints.
- Actual source, types, callers, tests, and CI workflows are the final authority for current behavior. When documentation conflicts with source, investigate and correct the stale document; do not implement a fictional contract.

### Agent roles, procedures, and reusable knowledge
- `docs/knowledge/README.md` — knowledge-base taxonomy, metadata contract, approval lifecycle, and storage boundaries.
- `docs/knowledge/architecture/multi-agent-runtime.md` — target multi-model/multi-role execution architecture.
- `docs/knowledge/roles/*.md` — role responsibilities and boundaries.
- `docs/knowledge/procedures/*.md` — approved task workflows and their triggers.
- `docs/knowledge/protocols/*.md` — handoff and procedure lifecycle contracts.
- `docs/knowledge/schemas/*.json` — machine-readable contract definitions.
- `docs/knowledge/proposals/` — unapproved candidates; never use as active instructions.
- `docs/knowledge/lessons/` — reviewed reusable lessons, not raw transcripts.
- Runtime knowledge catalog/index is derived from version-controlled documents. Only documents with `status: approved` may be selected automatically; always retrieve the exact document version before applying it.

### Runtime implementation entry points
Inspect these only as relevant, including their callers and tests:
- `server/agentOrchestrator.ts`, `server/knowledgeManager.ts`, `server/projectAgent.ts`, `server/permissionManager.ts`.
- `server/app.ts` — API routes, provider calls, request lifecycle, and integration boundaries.
- `server/agentJournal.ts`, `server/operationRegistry.ts` — operational events and current operation tracking.
- `src/types/onecore.ts`, `src/store/useOneCoreStore.ts`, and relevant UI components — shared contracts and client behavior.
- Existing subagent configuration/provider profiles and the real-time/event transport implementation — inspect actual files and callers before extending them. The transport is infrastructure, not a second orchestrator or policy engine.
- `tests/` and CI workflows — executable evidence. Distinguish tests present, tests run, and runtime behavior verified.

### Conflict resolution
1. Current source, executable contracts, tests, and observed runtime behavior determine what is implemented.
2. Security/permission rules and explicit owner decisions constrain all implementation.
3. `AI_WORKING_RULES.md` governs engineering behavior; approved knowledge documents govern reusable task procedures within those rules.
4. Architecture documents describe current evidence and target principles; check their status labels and audit dates.
5. `CURRENT_WORK.md`, `DEVELOPMENT_PLAN.md`, continuation prompts, old commits, and chat summaries are navigation aids, not proof that current code still matches them.
6. If a source is missing, inaccessible, stale, or contradictory, report the gap and inspect further before coding. Never fill it with assumptions.

## Technology baseline
- Frontend: React 19, TypeScript, Vite, Zustand, Tailwind CSS 4.
- Backend: Node.js 22+, Express, TypeScript.
- Desktop runtime: Tauri 2 with a separately managed local Node backend.
- Preserve the current stack. Do not introduce a framework or major dependency without a documented reason and explicit approval.

## Engineering architecture principles

These are normative design constraints for new work and refactoring. They describe the target architecture; they are not a claim that every existing module already conforms. When touching legacy code, inspect the actual dependency graph and document or address relevant violations in a separately scoped change.

### 1. One source of truth
- Keep one authoritative definition for each contract, type, configuration value, and piece of state.
- Avoid duplicate lockfiles, competing type definitions, parallel documentation of the same rule, and duplicated frontend/backend contracts.
- If duplication is unavoidable at a boundary, generate it from or validate it against the authoritative contract.
- Keep persisted state and UI state synchronized through the existing store and explicit ownership rules; do not introduce competing sources of truth.

### 2. Dependency direction
- Use layered boundaries with dependencies flowing inward: `UI → usecases → domain`.
- Domain code must not depend on UI, framework, network, filesystem, or runtime details.
- Use cases coordinate application behavior through abstractions; they must not depend on whether an implementation is local, remote, or network-backed.
- UI components render state and dispatch intent. They must not own infrastructure access or business rules.
- Infrastructure adapters implement the abstractions required by inner layers. Do not allow lower-level/domain modules to import higher-level UI or delivery modules.
- Before enforcing or refactoring boundaries, map the current modules and imports. Add enforceable import restrictions incrementally rather than performing speculative large-scale rewrites.

### 3. Explicit operation lifecycle
- Every long-running or side-effecting operation should have a stable `id` and explicit state transitions:
  `CREATED → RUNNING → COMPLETED | FAILED | CANCELLED`.
- Define a timeout policy and cancellation mechanism appropriate to the operation.
- Finalization and cleanup must run on every exit path, including success, failure, timeout, and cancellation. Use `finally` for guaranteed cleanup/final-state recording where appropriate.
- Persist or emit the terminal result exactly once; make repeated completion/finalization safe.
- Do not leave operations indefinitely running after an exception or disconnect.
- UI must represent progress and terminal states, including cancellation. A cancelled operation must not be presented as successful or silently remain in a loading state.

### 4. Contracts are executable
- Prefer typed interfaces and runtime schemas (Zod where appropriate) at untrusted boundaries: API input/output, persisted data, tool arguments, and external provider responses.
- Keep frontend/backend contracts in one authoritative source or generate/validate both sides from it.
- Invalid data must be rejected or handled explicitly at the boundary; do not rely on comments or markdown as enforcement.
- Add compile-time, lint, schema, and test enforcement for rules that can be automated. Documentation explains the contract; executable checks enforce it.

### 5. Guardrails before cleanup
- Before broad refactoring, establish or strengthen the relevant lint rules, import boundaries, path aliases, schema checks, and tests.
- Prefer automated prevention of known regressions over relying on reviewers or agents to remember conventions.
- Do not introduce a rule that contradicts the current architecture without first reconciling the architecture and updating the rule.

### 6. Testability
- Keep domain logic and use cases testable without a browser, Tauri runtime, filesystem, or live network wherever practical.
- Isolate external effects behind adapters and inject dependencies into logic that needs them.
- Tests should verify boundaries, state transitions, failure paths, cancellation, and cleanup—not merely exercise the happy path.
- A function that cannot be tested without starting the entire application is a signal to review its responsibilities and dependencies.

## Visual design principles

### Target visual architecture

The application must use one centralized visual architecture. Visual rules and reusable UI must be defined once and consumed by the entire application, rather than independently recreated by pages or feature modules.

The target dependency hierarchy is:

```text
Design Tokens
    ↓
Design System
    ↓
┌────────────┬────────────┬────────────┐
│   Layout   │   Pages    │  Controls  │
└────────────┴────────────┴────────────┘
```

Responsibilities:

1. **Design Tokens — single source of visual values**
   - Own the canonical definitions for colors, semantic surfaces, typography, font sizes and line heights, spacing, dimensions, radii, borders, shadows, and motion parameters.
   - Define light and dark theme values centrally. Components must not create their own theme palettes.
   - Use semantic tokens in application code. Raw visual values are allowed only in the central token definitions or where a value is inherently content-driven.
   - When a repeated visual need has no token, add it centrally. Do not solve it with a page-local exception.

2. **Design System — shared visual language and reusable primitives**
   - Consume Design Tokens and provide the shared UI components, interaction states, icon rules, and animation primitives.
   - Own common components such as buttons, inputs, cards, panels, dialogs, page headers, and transitions.
   - A shared visual pattern must have one implementation. Pages must compose and configure shared components rather than copy their markup and styles.
   - Keep component variants explicit and limited to real, reusable differences. Do not create near-identical components to bypass an existing shared primitive.

3. **Layout — application-wide composition**
   - Own the application shell, the approved three-column structure, navigation regions, workspace boundaries, responsive behavior, and shared page layout primitives.
   - Consume the Design System; do not define a competing set of colors, spacing, surfaces, or controls.
   - Preserve the approved shell and its ownership boundaries. Page-level work must not introduce alternate shell structures.

4. **Pages — feature-specific composition**
   - Own page content, domain-specific grouping, and composition of shared layout and UI components.
   - Use shared tokens and components for all common visual elements.
   - Keep page-specific styling only for genuinely unique content that cannot be represented by an existing semantic token or shared component. Repeated page-specific patterns must be promoted into the Design System.
   - The **Провайдеры / Модели** page remains the canonical visual reference for standard non-chat pages; it is a reference for appearance and composition, not a source from which styles should be copied.

5. **Controls — consistent interaction surfaces**
   - Use shared controls and shared state styling for default, hover, focus, active, selected, disabled, loading, success, and error states as applicable.
   - Do not implement local visual variants of an existing control.
   - Keep keyboard focus, contrast, sizing, and interaction feedback consistent across themes and pages.

**Dependency rule:** Design Tokens → Design System → Layout / Pages / Controls. Lower layers must not redefine or override the visual contracts owned by higher layers. Pages and feature modules must not become alternative sources of design tokens or shared component styles.

**Anti-hack rule:** do not fix a visual inconsistency with arbitrary local classes, one-off CSS selectors, duplicated utility groups, hardcoded theme values, or extra wrappers when the root cause belongs in a token, shared component, or layout primitive. Fix the owning source and migrate affected consumers deliberately.

**Migration rule:** this is the target architecture, not a claim that the current codebase already conforms. First audit existing tokens, components, duplicated styles, overrides, and page-specific exceptions. Then consolidate the authoritative sources and migrate consumers in focused, verifiable steps. Do not perform blind mass replacement or change page behavior, application navigation, or the approved shell as part of visual cleanup. Chat remains explicitly excluded from the non-chat page redesign baseline.

These rules govern all screens and shared UI, not just the dashboard. The visual system must be implemented consistently rather than recreated independently by each page.

### 1. One source of truth for styles
- Use design tokens for colors, spacing, radii, typography, borders, and shadows.
- Components should consume semantic tokens (for example, background, surface, text, border, and spacing tokens) rather than inventing one-off color values or arbitrary dimensions.
- Theme changes must be expressed through the token system. Do not scatter theme-specific hardcoded values through page components.
- If a required token does not exist, add it to the central token definition instead of introducing a local exception.
- Preserve accessible contrast and clear focus states in every theme.

### 2. Component responsibility and shared UI kit
- A UI component should have one clear responsibility. It receives data and callbacks through props and renders the appropriate interface.
- Presentation components must not call APIs, own provider logic, or decide infrastructure behavior.
- Reuse the shared UI kit for buttons, inputs, dialogs, cards, and layout primitives. Do not create a visually competing version of an existing primitive for an individual screen.
- Extend a shared component when the behavior is genuinely common; keep specialized composition at the page/feature level.
- Do not turn every screen into a collection of unrelated custom controls.

### 3. Explicit screen and operation states
- Every screen or data-driven component must deliberately handle the applicable states: `loading`, `empty`, `error`, `success`, and `disabled`.
- Long-running operations must additionally expose progress and terminal outcomes, including `cancelled`.
- Do not show an empty result while data is still loading. Do not disguise an error as an empty state.
- Error copy must explain what failed and, when possible, what the user can do next.
- Keep layout geometry stable while states change; reserve space or use stable containers where asynchronous content would otherwise move surrounding controls.

### 4. Hierarchy before decoration
- A user should be able to identify the primary information, secondary information, and next action quickly.
- Establish hierarchy through typography, contrast, grouping, and spacing.
- Use gradients, shadows, borders, and decorative effects only when they clarify grouping or interaction.
- Remove decoration that adds visual noise without improving hierarchy.
- Keep controls, labels, and interactive states visually consistent across screens.

### 5. Spacing and typography
- Use a consistent spacing scale based on 4-point increments (4, 8, 12, 16, 24, 32, and their deliberate multiples).
- Avoid arbitrary per-component spacing values. Add a token when a repeated spacing need is missing.
- Typography is content, not filler: titles, helper text, empty states, progress labels, and errors must be concise and understandable.
- Maintain a clear type scale and predictable line heights. Avoid truncation where it hides essential meaning; provide an appropriate way to inspect long values.

### 6. Feedback for every action
- Every user action must produce visible acknowledgement: pressed/selected state, progress, success, failure, or cancellation as appropriate.
- Long-running work must show that it is still active and provide cancellation when supported.
- Failures must explain the issue and a useful next step when one is known.
- Never leave the user facing a silent button or an indefinite spinner without status.

### 7. Stable application shell and layout
- Preserve a stable three-column desktop composition: left navigation, open central workspace, and right context/inspector panel.
- The application uses one shared cool, pale-blue canvas background (light baseline: `#F7FAFF` / corresponding semantic token) across the full screen, including behind the center workspace.
- Left navigation and right context panels are separate floating surface cards with rounded corners, a subtle border, and restrained shadow. The shared canvas must remain visible in the gaps between columns.
- The central workspace is open and transparent against the shared canvas. Do not wrap the entire center or chat in an additional white card.
- The right panel is a real third column, not decorative content. Preserve the established responsive behavior on narrower screens.
- This composition applies to all standard application pages except Chat. Chat is a separate page and is excluded from the shared visual-style requirements and from comparisons against the Providers page. Its layout may follow its own design. Individual messages, editors, composers, tables, and other meaningful inner elements may have their own surfaces; the entire center workspace must not become one large card.
- Keep column sizing, minimum sizes, gaps, and overflow behavior deterministic. Data refreshes, loading transitions, theme changes, and page navigation must not cause avoidable layout shifts.
- Do not use content-dependent widths or late-arriving settings in a way that makes the shell jump. Initialize settings before exposing the final shell geometry, or reserve the required geometry.
- Do not move shared panels between layout levels or change responsive ownership without inspecting all affected page variants first.

### 7.1 Shared page visual baseline and scrolling header
- The **Провайдеры / Модели** page is the canonical visual reference for every application page except Chat.
- All non-chat pages must follow the **Провайдеры / Модели** page's shared visual language: page surfaces and backgrounds, content hierarchy, typography, spacing, cards, borders, radii, shadows, buttons, inputs, and other controls. Reuse its established patterns instead of creating page-specific visual systems.
- Every standard non-chat page header must display a semantic page icon immediately before the page title, on the same horizontal row. Match the reference pages «Провайдеры / Модели», «LlamaServer» and «Агенты и роли»: consistent icon size (`h-5 w-5`), alignment and spacing (`gap-2`), with theme-aware colors. Choose an icon that identifies the page's subject; do not omit it or place it on a separate line. Chat remains excluded.
- Chat is a deliberate exception: do not use it as a visual reference and do not force its layout or styling onto other pages.
- If a non-chat page has vertically scrollable content, keep its page header fixed in position at the top of that page's scroll area. The header must remain visible and must not move away with the content; only the content below it scrolls.
- Keep the header above the scrolling content, with a visible boundary and a fully opaque background. Content moving underneath the header must be completely hidden and must never remain visible through it or reduce header readability.
- The shared header must use the active theme's centralized page-surface token (currently `pageSurface` from `src/utils/uiStyle.ts`) rather than `bg-inherit`, a transparent/semi-transparent background, or page-local color values. The token must provide an opaque surface for every supported style in both light and dark modes.
- Do not rely on blur as a substitute for an opaque header. Blur may be added only as an intentional visual effect; the underlying content must still not interfere with header readability.
- Keep the divider aligned to the shared content container width, not the full viewport width.
- The shared `PageHeader` is the single owner of the page-level save action and save status for standard pages: one `Сохранить` button, with the last successful save date and time directly beneath it. Page components provide page identity/content only and must not duplicate this control.
- Do not render a separate save/status toolbar above the shared page header. The shared header itself is fixed at the top of the page scroll area; its divider belongs below the header content.
- Apply this rule to the page header, not to the global application shell or navigation panels. Pages without independently scrolling content do not need a sticky page header.

### 7.2 Shared page-entry transition

- Every standard non-chat page must use one consistent page-entry transition. Chat remains excluded and keeps its own behavior.
- The canonical transition is the currently approved Providers-page effect: fade in from `opacity: 0` to `opacity: 1`, move vertically from `y: 12px` to `y: 0`, and scale from `0.99` to `1`.
- Use a duration of `160ms` with an `easeOut` easing curve. Do not add delays or page-specific variations unless the project owner explicitly approves a change to this standard.
- The transition must be implemented once in a shared page-transition component or shared layout layer, with its parameters defined in one central configuration. Individual pages must not copy animation props, create their own equivalent wrappers, or independently tune timing, distance, scale, or easing.
- Page components provide their content; the shared layer owns the entry animation. Apply the transition to the page content surface, not to the global three-column shell or persistent navigation/context panels.
- Do not stack multiple entry animations when navigating between standard pages. Remove or bypass page-local entry animations that duplicate the shared transition.
- Theme changes must not alter the transition geometry or timing. The effect must work consistently in light and dark themes.
- Any change to this transition's values or scope must be made in the central implementation and reflected in this rule; do not let individual pages drift.

### 7.3 Internal navigation

- **Internal navigation** is the shared secondary-navigation pattern for related pages and sections that belong to one primary-menu destination. It must not expand or replace the fixed primary navigation.
- Use internal navigation when a primary page contains multiple related views that would otherwise exist as disconnected pages or unlisted destinations. Keep the parent destination and its internal destinations within the same page/workspace context.
- Internal navigation supports two destination types:
  1. **Nested views/pages** — switch the central content to a related view without a global application-shell transition or a change to the primary navigation.
  2. **In-page anchors** — navigate to a named section inside the current view using semantic section IDs and real anchor targets. Anchor navigation must account for the sticky page header so the target heading is not obscured.
- These are two behaviors of the same **Internal navigation** pattern, not two competing navigation systems. A page may use nested views, anchors, or both when its information architecture requires them.
- Keep the navigation visually and behaviorally consistent across all pages. Implement the shared pattern as a reusable Design System component; pages provide destination definitions and content, not one-off navigation markup.
- Clearly distinguish the active nested view from the active anchor/section. The selected state must remain understandable when navigating, including browser back/forward behavior where applicable.
- Use meaningful labels, stable destination identifiers, keyboard-accessible controls, visible focus states, and semantic links for anchor destinations. Do not use click-only text or decorative elements as navigation.
- Do not create internal navigation merely to add decoration. Use it to expose a real information hierarchy and keep related destinations discoverable.
- Preserve the approved three-column shell, page header, page transition, and theme behavior. Internal navigation must support light and dark themes and must not cause the application shell or modal geometry to jump.
- Before migrating a page, audit its current routes, nested content, anchors, state ownership, and callers. Do not move or merge destinations based only on their names.

#### 7.4 Horizontal page-level navigation

- Preserve the left primary navigation exactly as the permanent navigation surface. Do not hide, replace, shrink, or remove it to make room for page-level navigation.
- Every non-chat page displays a horizontal secondary-navigation row directly below its shared page header. It duplicates the destinations belonging to the currently active primary section, excluding Chat.
- The row and the left navigation must consume one authoritative navigation catalog and the same route/state mapping. Never duplicate destination labels, route mappings, or active-state logic in page components.
- Selecting a destination must update the existing application tab and, where applicable, settings subsection or SSH/GitHub subsection. The active destination must be synchronized in both navigation surfaces, including when navigation is initiated by another component.
- The horizontal row is not sticky or fixed. It belongs to the page content flow and scrolls away with that content. The shared page header retains its independently defined sticky behavior.
- Render destinations on a thin, neutral grey track using the shared `NavigationRibbon` component for page-level navigation and equivalent in-page section navigation where applicable.
- Buttons have consistent vertical sizing and padding, but their widths follow their labels. Keep the buttons visually light and compact on the track; allow wrapping only when the available width requires it.
- Use clear selected, hover, keyboard-focus, and disabled states. Support light and dark themes using existing tokens and Tailwind theme variants.
- Remove explanatory subtitle text from standard page headers; the horizontal navigation row occupies the space directly below the page title.
- Do not introduce breadcrumbs, another navigation hierarchy, or page-specific copies of this pattern.
- Chat is explicitly excluded. Do not render the row in Chat, do not include Chat as a destination in the horizontal row on other pages, and do not alter Chat's layout, navigation, or behavior.

## 8. Themes and icons
- All supported themes must preserve the same layout, spacing, hierarchy, and component behavior; themes change the palette, not the composition.
- Use the central theme/token mechanism for light and dark variants.
- Use Tabler icons for general interface iconography where the project has adopted that set. For third-party services and brands, use their recognizable official brand marks where available.
- Icons must have consistent visual weight, alignment, and sizing. Do not mix arbitrary icon families within the same control group.

## Change and verification discipline
- Keep each implementation step narrowly scoped and reviewable.
- Before editing, inspect the target files and their callers; do not infer behavior from filenames alone.
- Do not use a screenshot-driven patch that changes structure without understanding the page and responsive layout.
- After a change, inspect the diff for unrelated edits, duplicated styles, dead code, and accidental contract changes.
- Run the applicable checks and report their actual outcomes. The standard repository checks are:
  ```powershell
  npm run lint
  npm test
  npm run build
  ```
- For changes to Tauri startup, capabilities, bundling, or Rust code, also run the relevant Tauri build on a Windows runner.
- If a check cannot be run, state that explicitly. Never describe an unrun check as passed.

## Data ownership and persistence

- Persist complete chat sessions and the active session through the dedicated local chat-history store. Chat history must survive application restarts and must not depend on the user manually saving application settings.
- Keep chat transcripts separate from `MEMORY.md` and other agent memory documents. Memory stores durable facts and preferences, not a replacement archive of conversation messages.
- Persist chat history atomically, validate restored data, and restore interrupted generation states as terminal rather than leaving stale loading indicators.
- Do not include chat history in the application settings manifest or mix chat persistence with project memory and action logs.

## Security and permissions
- The backend must bind only to loopback interfaces.
- Validate the Host, Origin, and Fetch Metadata headers before serving local API requests.
- Origin validation is a browser boundary, not authentication against other local processes. A session/token model is still required.
- Resolve project paths against the canonical project root. Reject traversal, absolute paths, and symbolic-link components.
- Every shell command and side-effecting Git operation must require explicit user approval at the API boundary.
- Never log API keys, access tokens, SSH credentials, or secret values.
- Store secrets outside the plain settings manifest. Do not return secrets to logs or diagnostic output.
- Treat model output, project files, browser content, and tool output as untrusted input.
- Do not claim an operation succeeded until its result has been checked.

## Required verification
Run these commands from the repository root before considering a code change complete:
```powershell
npm run lint
npm test
npm run build
```
For changes to Tauri startup, capabilities, bundling, or Rust code, also run the relevant Tauri build on a Windows runner.

## Assistant execution and response rules

- Respond in the user's language. Keep technical responses concise, direct, and focused on implementation details or concrete decisions.
- Do not repeat the user's request, add generic acknowledgements, provide filler, or end with routine closing phrases.
- Do not invent repository structure, files, APIs, types, dependencies, or existing behavior. If the required context is unavailable, inspect the repository or request the exact missing information.
- Before changing code, read the current target files and relevant callers. Base every change on the latest repository state, not on assumptions or stale conversation context.
- Maintain the established architecture, naming, formatting, and component conventions across all touched files.
- Use Tailwind CSS utility classes for styling. Do not add inline styles or duplicate utility-class groups when an existing shared abstraction should be reused.
- Every new or modified page and component must support both light and dark themes using the project's existing theme/token conventions and appropriate `dark:` variants where applicable.
- Preserve the approved application shell and its three-column grid. Do not change column ownership, grid structure, sizing, or responsive behavior, and do not add wrapper elements unless the task explicitly requires them.
- Implement the requested scope only. Do not bundle speculative redesigns, unrelated refactors, or unrequested features into the change.

## Agent knowledge base and delegation

- The curated agent knowledge base lives under `docs/knowledge/`; its index and document contract are defined in `docs/knowledge/README.md`.
- Keep role contracts, reusable procedures, handoff protocols, and reviewed lessons separate from chat history, project memory, skills, and the operation journal.
- Use only approved, versioned procedures for automatic routing. Drafts and model-generated lessons must never become active instructions without review and explicit approval.
- Delegated work must carry a structured handoff with task/operation IDs, objective, acceptance criteria, exact verified file paths, evidence level, procedure references, allowed capabilities, and output contract.
- Workers must start from supplied evidence, avoid broad rediscovery, request specific missing context, and return structured findings with evidence and execution results.
- The coordinator owns end-to-end completion and the user-facing response. A worker's completion status is not proof that the parent task is complete.
- Use deterministic project tools for filesystem traversal, search, and test execution. Use lightweight models for bounded classification, ranking, and summarization; reserve stronger model calls for ambiguous reasoning and consequential decisions.
- Reuse the existing orchestrator, subagent configuration, provider profiles, permission manager, real-time/event infrastructure, and journal. Do not introduce a competing orchestration or event subsystem.
- Treat the knowledge base as version-controlled source material. Any runtime index/cache is derived and rebuildable; project-specific facts remain in project memory, and full transcripts remain in chat history.

## Fixed primary navigation

The primary navigation is a stable application structure and is not user-hideable or user-reorderable.

It must always contain exactly six top-level sections, in this order. The current subsection catalog is:

1. **Рабочее пространство:** Дашборд; Чат; Терминал; Браузер; Заметки.
2. **Контекст:** Проекты; Задачи; Процессы; Файлы; История проекта.
3. **AI-ресурсы:** Провайдеры / Модели; LlamaServer (Установка llama-server; Поиск моделей); Агенты и роли; Навыки и память; Справочники; Навыки; Инструкции.
4. **Интеграции:** GitHub; SSH; Шлюз мессенджеров; MCP; Инструменты и Hooks.
5. **Настройки:** Интерфейс; Разрешения; Безопасность; Система; Обновления.
6. **Журналы:** Журнал операций; Журнал ошибок; Память; История задач; История агентов.

- Do not hide, remove, or reorder primary sections or their configured subsection destinations through visibility settings.
- Visibility settings may still control auxiliary navigation elements, workspace sidebars, and the right inspector.
- A menu item may open a page containing its own secondary navigation. Use that internal navigation for related functions instead of adding more primary menu items.
- Every primary item must resolve to a deliberate page or route. A placeholder is temporary and must not be mistaken for a completed feature.
- «Заметки» is planned as the user's personal space for writing, editing, and revisiting their own thoughts and notes. Its functional implementation is deferred.
- Chat is explicitly excluded from navigation-driven redesign and page refactoring. Do not change its interface, structure, or behavior as part of work on the other pages.


### 8. Unified non-chat page layout contract

Every standard non-chat page must compose the same shared page structure. A page must not independently define the outer page geometry or become the owner of its own header/content boundary.

The canonical structure is:

```text
ApplicationShell
  └── Workspace
       └── PageLayout
            ├── PageHeader
            └── PageContent
                 └── Page-specific composition
```

Ownership:

- `ApplicationShell` owns the approved three-column application geometry and the available workspace bounds.
- `PageLayout` owns the vertical page composition and the relationship between the header and content area.
- `PageHeader` owns the shared header geometry, alignment, sticky behavior, and header-level actions. Page-specific header content is supplied through composition; unrelated global actions must not be implicitly enabled on every page.
- `PageHeader` renders the shared `PageSubNavigation` immediately below the page title as the single global source for subsection navigation. `PageContent` contains page content only and must not render or position the global subsection ribbon. Embedded headers may explicitly disable the ribbon.
- `PageContent` owns the content viewport: available height, width constraint, horizontal padding, min-width/min-height behavior, and the default scroll boundary.
- A page owns only its domain-specific content and internal composition. It must not redefine the outer width, page height, header position, or default page scroll behavior.

Layout invariants:

1. The header and content use the same horizontal alignment, width constraint, and page gutters.
2. The header remains outside the default scrolling viewport. Only the content region scrolls vertically.
3. The content viewport must be bounded by the available workspace height and use explicit flex/min-size/overflow rules so descendants cannot expand the application shell.
4. The default page content has one vertical scroll owner. Nested scrolling is allowed only when the interaction requires an independently navigable region (for example, a list beside an editor); each nested region must have a clearly defined bounded parent. `PageContent` exposes an explicit non-scrolling viewport mode for bounded split workspaces; in that mode, the page must define the nested scroll regions inside the shared viewport, not on the page shell.
5. Width constraints and gutters come from shared layout tokens/primitives, not independently copied utility classes.
6. Page-specific grids, split panes, tables, editors, and cards may differ inside `PageContent`; they must respect its bounds and must not create an alternate application shell.
7. Responsive behavior and light/dark surfaces are defined centrally. Pages consume the shared contract rather than implementing local breakpoints or theme palettes for common layout behavior.
8. Chat remains explicitly excluded from this non-chat page layout migration. Do not alter its layout, styling, or behavior as part of this work.

Migration sequence:

1. Audit current shell, header, content wrappers, scroll owners, width constraints, and nested scroll regions. Record actual page-specific exceptions before changing code.
2. Establish the shared layout primitives and their tokens without changing page behavior.
3. Validate the primitives against representative page structures and automated checks.
4. Migrate non-chat pages in small, individually reviewed batches. Before editing each page, inspect its current composition and callers; preserve all data, actions, routes, and functionality.
5. Remove obsolete local geometry only after all consumers have moved and source/test evidence confirms it is unused.
6. Keep a migration checklist with each page marked audited, migrated, and verified separately. Do not claim full adoption while any page remains unmigrated.

Do not wrap every page blindly in a new container. First establish the exact ownership boundary so existing page headers, dialogs, split panes, and nested work areas are not accidentally clipped or given competing scrollbars.

### 9. Shared collection and item-management pattern (deferred migration)

For data collections that support adding, viewing, editing, and deleting items, the target interaction pattern should be shared:

- Collection pages use one common list presentation and common add/delete affordances.
- Selecting an item to edit opens a shared modal/dialog pattern containing that item's information and editable fields.
- Add may use the same modal in create mode where the data model supports it.
- Delete uses the existing shared deletion-warning system, with the warning variant chosen explicitly for each destructive action.
- Collection-specific fields, validation, grouping, empty states, and domain actions remain configurable; the shared component must not erase meaningful differences between collections.
- Read-only histories, logs, timelines, and collections without CRUD requirements are not forced into this pattern.
- Data ownership, persistence, permissions, and business rules remain with the relevant domain/store/API. The shared list/modal layer is presentation and interaction reuse, not a new competing data source.

This collection pattern is an approved architectural direction, but its implementation and page migration are deferred until the unified Layout and Design System foundation is established. Chat is excluded unless explicitly requested.
