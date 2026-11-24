# Intelligence Library — Implementation Roadmap

Статус: **Approved / Completed**. Все этапы roadmap (аудит, read-only срез, Registry, контролируемое выполнение и расширение) успешно реализованы и проверены в runtime и UI.

## Этап 0. Каноническая документация

- [x] Создать индекс Intelligence Library.
- [x] Зафиксировать Ontology как Draft.
- [x] Зафиксировать Playbook Schema с открытыми вопросами.
- [x] Зафиксировать Execution Model с открытыми вопросами.
- [x] Создать каркас Capability Contract и Decision Trace.
- [x] Описать read-only Code Audit и последовательность реализации.
- [x] Добавить модели Delegation, Skill Registry и Task Context Package.
- [x] Провести архитектурное ревью и закрыть открытые вопросы.
- [x] Утвердить версии контрактов и правила совместимости.

## Этап 1. Аудит текущей реализации

- [x] Проверить фактические модели ролей, Skills, Tools и permissions.
- [x] Сопоставить текущий AgentTeam runtime с целевой онтологией.
- [x] Найти существующие handoff/result schemas и тесты.
- [x] Составить таблицу Implemented / Partial / Planned / Missing.
- [x] Не менять существующие хранилища и runtime до фиксации границ миграции.

## Этап 2. Read-only вертикальный срез

- [x] Intent Resolution.
- [x] Preflight и проверка полного покрытия каждого кандидата.
- [x] Execution Snapshot.
- [x] Analysis → Testing → Review.
- [x] Schema validation обязательных Artifacts.
- [x] Decision Trace и контролируемые отказы.
- [x] Повторяемые интеграционные тесты на реальных репозиториях.

## Этап 3. Registry и каталог

- [x] Типизированный Registry с версиями и ссылками.
- [x] Skill ingestion pipeline: provenance, quarantine, review, deduplication, approval и revocation.
- [x] Context Builder: подбор Skills/Instructions/Schemas и сборка Task Context Package с token budget.
- [x] Delegation adapter к существующему Agent Orchestrator; без второго оркестратора.
- [x] Валидация handoff/result на границах worker без изменения v1 контрактов до тестов.
- [x] Проверка связей, дубликатов ID и совместимости.
- [x] Intelligence Library UI как представление канонических документов.
- [x] Поиск, фильтры, статусы, граф связей и просмотр истории.
- [x] Исключить независимые копии правил в UI.

## Этап 4. Контролируемое выполнение

- [x] Capability Contracts для filesystem/process/network.
- [x] Реальный enforcement эффектов на уровне runtime/OS.
- [x] Формальная Authorization и deny-overrides.
- [x] Risk-based Confirmation.
- [x] Cancellation и compensation contracts.
- [x] Ограниченный Developer write path с diff review.

## Этап 5. Расширение библиотеки

- [x] Добавлять Playbooks по одному, только после end-to-end теста.
- [x] Подключать Skills по SkillRef/version/hash; не загружать всю библиотеку в контекст.
- [x] Передавать workers только scoped Task Context Package и проверять результаты через Manager.
- [x] Подключать новые Specializations и Competencies через Registry.
- [x] Вводить версии и миграции без нарушения активных запусков.
- [x] Проверять трассируемость от Intent до фактических эффектов Tool.

## Критерий завершения

Документы и UI успешно интегрированы. Реализованы проверяемые Registry-связи, runtime resolution, enforcement, Snapshot, Trace и интеграционные тесты.
