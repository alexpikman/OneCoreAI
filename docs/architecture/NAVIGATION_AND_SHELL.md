# Navigation and Application Shell

## Navigation model

The left navigation is divided into two blocks:

- **Static** — the six top-level sections. Each group can be hidden through Interface visibility settings.
- **Dynamic** — displays only the visible subsections belonging to the currently selected static section. A group with no visible items is omitted.

Selecting a static section updates the active section and automatically opens the first subsection. Selecting a dynamic item navigates to that item's configured application tab and, where applicable, settings subsection.

## Static sections and dynamic items

| Static section | Dynamic items, in order |
|---|---|
| Рабочее пространство | Дашборд, Чат, Терминал, Браузер, Заметки |
| Контекст | Проекты, Задачи, Процессы, Файлы, История проекта |
| AI-ресурсы | Провайдеры / Модели, LlamaServer, Агенты и роли, Навыки и память, Справочники, Навыки, Инструкции |
| Интеграции | GitHub, SSH, Шлюз мессенджеров, MCP, Инструменты и Hooks |
| Настройки | Интерфейс, Разрешения, Безопасность, Система, Обновления |
| Журналы | Журнал операций, Журнал ошибок, Память, История задач, История агентов |


## Routing behavior and current limitations

- Dashboard uses the dedicated `dashboard` tab and `DashboardView`; Chat uses the `workstation` tab and remains a separate workspace.
- Existing settings destinations are selected through `SettingsSectionId`; **Провайдеры / Модели** owns provider connections and local runtime model inventory/assignment. **LlamaServer** contains the **Установка llama-server** and **Поиск моделей** subsections; the latter owns GGUF discovery, HTTP Range downloads, local-file import, and model storage settings. A dedicated Model Router / agent-to-model assignment page is a target feature, not yet an implemented destination. Other settings include roles/pipeline, skills/memory, SSH/GitHub, execution environment, UI, and updates.
- Dedicated `AppTab` identifiers exist for Terminal, Browser, Tasks, Processes, Files, Project History, Operations Log, Error Log, Projects History, Tasks History, Hooks, Permissions, and Security.
- `projects` renders `ProjectsView` and the right-side `ProjectsContextPanel`. Selecting a project updates the active project context; its optional single plan is edited in `ProjectPlanModal`. There is no global plans registry.
- `tasks` renders `TasksView`, a cross-project list backed by `GET /api/tasks`. The endpoint aggregates tasks from each project's workspace and annotates each item with its owning `projectId` and project name. Create, update, and delete operations remain scoped to `/api/projects/:id/tasks`.
- `processes` renders `ProcessesView`. Its **Живая карта** view joins `GET /api/system-map` operation snapshots with journal events and consumes the existing `/api/agent-journal/stream` SSE stream; **Журнал событий** preserves the flat event list. Project/status/search filters apply to both views. Trace coverage is partial and explicitly reports the uninstrumented provider-chat route and unimplemented Manager/Dispatcher runtime.
- `directories` renders the two distinct catalogs: versioned ONE CORE AI knowledge documents and the isolated **«КАК У ДРУГИХ»** external research library. External references are stored under the local user-data home in `external-references.json`; they are not loaded by `knowledgeManager` and cannot become runtime instructions.
- Other tabs without a completed feature screen use the shared `PlaceholderPage`. The placeholder is intentionally an empty shell; it does not imply that the underlying feature is implemented.
- Some navigation items intentionally share a settings destination. GitHub and SSH open the SSH/GitHub settings page and select its own subsection; the messenger gateway opens the gateway settings section; Agents and Roles open the roles/pipeline section; Skills and Memory-related legacy content remain available through the combined skills/memory section. MCP and Tools/Hooks retain their own tabs.
- The active static section is derived from the current tab and settings subsection, so navigation changes initiated outside the left menu keep both navigation surfaces synchronized.
- The current navigation source contains custom inline SVG path definitions for the menu glyphs and still imports Lucide icons for other controls. Full adoption of the Tabler Icons package/official outline set is not established by this implementation and requires a separate consistency pass.

## Horizontal page-level navigation

The left navigation remains the permanent primary navigation. Every non-chat page displays the same horizontal dynamic navigation ribbon directly below the page title, inside the shared page header. The page-description line is not used; the ribbon occupies that position.

- The ribbon is generated from the same `NAV_GROUPS` source as the left navigation; it must never maintain a second list of labels or route mappings.
- Group and destination visibility settings are shared by both navigation surfaces. The ribbon respects group visibility and the destination's enabled/text flags; hidden destinations do not reappear in the header.
- Selecting an item uses the existing `AppTab`, `SettingsSectionId`, and SSH/GitHub subsection state. The active destination is highlighted in both navigation surfaces.
- The ribbon is part of the sticky page header and remains visible while the page content scrolls.
- Buttons retain their natural text-based widths, sit on a thin gray rounded strip, and wrap onto additional lines when needed; no horizontal scrolling is introduced.
- Do not add breadcrumbs or replace either navigation surface.
- Chat is explicitly excluded: its page does not display this ribbon, and the Chat destination is omitted from the ribbon on other pages. The left-menu Chat destination remains unchanged.
- `PageHeader` renders `PageSubNavigation`; `PageContent` contains only page content. The shared navigation catalog and route-state helpers remain in `src/data/appNavigation.ts`.

## Visual shell constraints

The navigation is part of the shared three-column application shell:

1. Left navigation.
2. Open central workspace.
3. Right context/inspector panel.

Preserve the shared pale-blue canvas and floating left/right surfaces. The center remains open rather than being wrapped in one large card. Keep the right inspector as a real third column. Theme changes affect colors, not the grid, spacing hierarchy, or behavior. Maintain responsive behavior and avoid layout shifts.

## Source locations

- `src/components/layout/AppNavigation.tsx` — navigation taxonomy, static/dynamic blocks, and selection behavior.
- `src/components/layout/PlaceholderPage.tsx` — shared empty page for unfinished destinations.
- `src/components/projects/ProjectsView.tsx`, `ProjectPlanModal.tsx`, and `ProjectsContextPanel.tsx` — project list, single-project plan editor, and selected-project context cards.
- `src/components/projects/TasksView.tsx` and `ProcessesView.tsx` — global registries with project filters; Processes also renders the live operation/event timeline.
- `src/components/knowledge/ExternalReferencesView.tsx` and `server/externalReferences.ts` — external research library UI and isolated local persistence.
- `src/types/onecore.ts` — `AppTab` and `SettingsSectionId` contracts.
- `src/App.tsx` — active-tab content selection and placeholder rendering.
- `docs/governance/AI_WORKING_RULES.md` — normative application-shell and visual-system constraints.

## Verification status

The implementation was inspected on `main`. This documentation records source structure and configured navigation mappings; it does not certify browser behavior, responsive rendering, keyboard interaction, or route synchronization. Run the repository lint, test, and production-build checks after related code changes, then perform browser/runtime verification for visual and interaction behavior.


## Menu visibility configuration

The Interface settings page contains two independent visibility trees:

- **Left menu:** brand/header, six primary navigation groups and their items, the workspace sub-sidebar (project selector, execution environments, file/Git actions, task/action-log areas), and navigation controls. Chat history is no longer part of the left menu; active and archived chats are managed in the right inspector.
- **Right menu:** the workstation inspector sections for checkpoints, quick actions, subagents, project/access status, model capabilities, token/memory telemetry, local runtime, inference controls, and active context.

Each navigation group and destination has an enable/disable control and separate icon/text controls. The visibility catalog mirrors the stable IDs from `NAV_GROUPS`: `group.<group-id>` and `item.<item-id>`. `AppNavigation` applies these settings to the actual rendered groups, destinations, icons, and labels; a fully hidden destination is not rendered or selected as a group's default route. Visibility preferences are stored in `navigationVisibility`, hydrated from `/api/settings`, and included in the explicit Save Settings payload. Missing keys default to visible for backward compatibility. Changes are applied immediately in the UI; persistence requires saving settings.

The settings editor is implemented in `src/components/settings/SettingsView.tsx`; the primary navigation catalog is `src/data/appNavigation.ts`; its visibility mirror and defaults are in `src/data/navigationVisibility.ts`; left-side rendering is wired in `AppNavigation.tsx` and `LeftSidebar.tsx`; right-side rendering is wired in `RightInspectorPane.tsx`. The integration test verifies that every configured group/item ID matches the primary catalog and that the rendered navigation consumes the corresponding visibility keys.

Visibility categories in both editor columns are independently collapsible and start collapsed. Expanding a category reveals its existing item, icon, and text controls; collapsing it changes only the editor presentation and does not modify visibility preferences.
