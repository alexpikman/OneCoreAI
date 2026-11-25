# Navigation and Application Shell

## Navigation model

The left navigation is organized around `NAV_GROUPS` (`src/data/appNavigation.ts`) and renders up to 10 top-level navigation groups with floating sub-navigation popups (`NavigationGroupPopup`) plus a compact workspace launcher (`WorkspaceControlsModal`) and a bottom `PLAN / ACT` mode switch:

- **Primary groups** — top-level sections rendered in `AppNavigation.tsx`. Each group can be hidden through Interface visibility settings (`src/data/navigationVisibility.ts`). A group with no visible items is omitted.
- **Popup & sub-items** — clicking a group opens `NavigationGroupPopup` (except direct single-item `workstation` chat group, which navigates directly). Selecting an item or sub-item activates its target `AppTab` and synchronized subpage/section state (`settingsSection`, `projectsSection`, `llamaModelsSection`, etc.).

## Navigation groups and items

| Group | Items, in order |
|---|---|
| Чат (`chat-group`) | Чат |
| Инструменты (`tools`) | Терминал, Браузер, Заметки |
| Контекст (`context`) | Проекты (`Список проектов`, `Разрешённые инструменты`), Задачи, Процессы, Файлы, История проекта |
| Провайдеры (`providers-group`) | Провайдеры (`Local`, `Cloud`, `Compatible`), LlamaServer (`Настройки`, `PagedAttention`, `API Console`, `Бенчмарк`) |
| Агенты OneCore (`ai-agents`) | General Agent, SUB Agents |
| Центр GGUF (`gguf-center`) | Модели (`Каталог`, `Библиотека`, `Импорт`), LLAMASERVER (`Управление запуском`, `Установленные модели`) |
| Библиотека знаний (`knowledge`) | Библиотека навыков, Регламенты и схемы, Intelligence Library, Справочники |
| Интеграции (`integrations`) | Remote connection (`GitHub`, `SSH-ХОСТЫ`, `SSH-Ключи`, `Configuration`), Messaging Gateway (`Telegram`, `Discord`, `Slack`), Execution Environments, Hooks (`Lifecycle Hooks`), MCP |
| Настройки (`settings`) | Интерфейс, Разрешения, Безопасность, Система, Обновления |
| Журналы (`logs`) | Журнал операций, Журнал ошибок, Память, История задач, История агентов |

## Routing behavior and subpage system

- Dashboard uses the dedicated `dashboard` tab and `DashboardPage` (with `showSubNavigation={false}`); Chat uses the `workstation` tab and remains a separate workspace without `PageSubNavigation` or `PageContextSidebar`.
- Pages with internal sub-sections share the unified `<SecondaryTabBar>` + `<PageContent scrollable={false}>` pattern:
  - `ProjectsPage.tsx`: **Список проектов** (`projectsSection: 'list'`) and **Разрешённые инструменты** (`projectsSection: 'allowed-tools'`, rendering `ProjectAllowedToolsSection`). Selecting a project updates the active project context; its optional single plan is edited in `ProjectPlanModal`.
  - `AgentTeamPage.tsx` (`General Agent`): **Разрешения**, **Системные указания**, **Инструкции**, **Роли**, and **Инструменты агента** (`AgentToolsRegistryPage.tsx`, backed by `GET /api/tools/registry` with subagent access mapping, `(SYS)` single-subagent markers, and document/entity-bound interaction schemas).
  - `ProvidersPage.tsx`, `LlamaServerSettingsPage.tsx`, `LlamaServerModelsPage.tsx`, `ModelHubView.tsx`, `SubAgentsPage.tsx`, `SkillsDirectoryPage.tsx`, `InstructionsCatalogPage.tsx`, `IntelligenceLibraryPage.tsx`, `DirectoriesPage.tsx`, `SshGithubPage.tsx`, and `SystemPage.tsx`.
- `Настройки → Разрешения` (`PermissionsPage.tsx`) acts as a read-only security overview and tool/terminal audit stream linking directly to the authoritative editors (`General Agent → Разрешения`, `General Agent → Инструменты агента`, `Проекты → Разрешённые инструменты`) without duplicating policy/tool toggles.
- `ToolsHooksPage.tsx` renders **Lifecycle Hooks** (`hooks-item`) inside `Интеграции`.
- `tasks` renders `TasksPage`, a cross-project list backed by `GET /api/tasks`; `processes` renders `ProcessesPage` with live system-map and journal event views; `directories` renders versioned ONE CORE AI knowledge documents and the isolated external research library (`external-references.json`).
- The active navigation group is derived from `getActiveNavigationGroupId` / `getActiveNavigationGroup` using the current tab and section state, keeping `AppNavigation`, `NavigationGroupPopup`, `PageSubNavigation`, and `PageContextSidebar` synchronized.

## Horizontal page-level navigation

The left navigation remains the permanent primary navigation. Non-chat pages (except Dashboard) display the horizontal dynamic navigation ribbon (`PageSubNavigation` → `NavigationRibbon`) directly below the page title inside `PageHeader`.

- The ribbon is generated from the same `NAV_GROUPS` source as the left navigation; it never maintains a second list of labels or route mappings.
- Group and destination visibility settings are shared across `AppNavigation`, `NavigationGroupPopup`, and `PageSubNavigation`; hidden destinations do not reappear in the header.
- The ribbon sits on a single-row neutral rounded track (`flex-nowrap overflow-x-auto`) with natural button widths and no horizontal wrapping.
- Chat is explicitly excluded (`activeTab === 'workstation'`), and Dashboard hides the sub-navigation strip (`showSubNavigation={false}`).
- `PageHeader` renders `PageSubNavigation`; `PageContent` contains only page content.

## Visual shell constraints

The navigation is part of the shared three-column application shell:

1. Left navigation (`AppNavigation.tsx`).
2. Open central workspace (`src/pages/...`).
3. Right context/inspector panel (`PageContextSidebar.tsx` or `RightInspectorPane.tsx` in workstation).

Preserve the shared floating left/right surfaces and open central workspace without wrapping the whole page in a single card.

## Source locations

- `src/data/appNavigation.ts` — navigation taxonomy (`NAV_GROUPS`), sub-items, and route/active-group helpers.
- `src/data/navigationVisibility.ts` — visibility tree definitions (`LEFT_MENU_VISIBILITY`, `RIGHT_MENU_VISIBILITY`) and defaults.
- `src/components/layout/AppNavigation.tsx`, `NavigationGroupPopup.tsx`, `PageSubNavigation.tsx`, `NavigationRibbon.tsx`, `SecondaryTabBar.tsx`, `PageHeader.tsx`, `PageContent.tsx`, `PageContextSidebar.tsx`, `WorkspaceControlsModal.tsx` — shell & navigation components.
- `src/pages/context/ProjectsPage.tsx`, `ProjectAllowedToolsPage.tsx`, `TasksPage.tsx`, `ProcessesPage.tsx` — project context views.
- `src/pages/integrations/ToolsHooksPage.tsx` — Lifecycle Hooks management (`ToolsHooksPage`) and `ExecutionEnvironmentPanel`.
- `src/types/onecore.ts` — `AppTab`, `SettingsSectionId`, `ProjectsSectionId`, and section type contracts.
- `src/App.tsx` — active-tab routing.
- `docs/governance/AI_WORKING_RULES.md` — normative application-shell and visual-system constraints.

## Menu visibility configuration

`InterfaceSettingsPage.tsx` exposes two collapsible visibility trees (`LEFT_MENU_VISIBILITY` and `RIGHT_MENU_VISIBILITY`):

- **Left menu:** brand/header, the 10 primary navigation groups and their items, the workspace modal/sidebar controls, and navigation controls.
- **Right menu:** workstation inspector sections (`RightInspectorPane.tsx`).

Visibility preferences are stored in `navigationVisibility`, hydrated from `/api/settings`, and persisted on explicit Save Settings. Missing keys default to visible (`!== false`).
