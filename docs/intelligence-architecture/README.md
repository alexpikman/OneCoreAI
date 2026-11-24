# Intelligence Library — архитектура General Agent

Статус: **Draft**. Документы описывают целевую архитектуру и не означают, что соответствующие механизмы уже реализованы в runtime.

## Назначение

Intelligence Library — каталог канонических архитектурных сущностей, контрактов и исполняемых сценариев General Agent. Источник истины — версионируемые документы в Git. UI должен отображать эти документы и связи, а не хранить независимые копии.

## Документы

| Документ | Назначение | Статус |
|---|---|---|
| [Ontology](ontology.md) | Термины, сущности, связи и инварианты | Draft |
| [Playbook Schema](playbook-schema.md) | Структура исполняемого сценария | Draft |
| [Execution Model](execution-model.md) | Resolver, Engine, Control Layer и выполнение | Draft |
| [Capability Contract](capability-contract.md) | Контракт возможностей Tool и фактических эффектов | Draft |
| [Decision Trace](decision-trace.md) | Аудит решений и операций | Draft |
| [Delegation Model](delegation-model.md) | Субагенты, Manager/Dispatcher, handoff, изоляция контекста и приёмка | Draft |
| [Skill Registry](skill-registry.md) | Импорт, происхождение, версии, доверие и подбор Skills | Draft |
| [Task Context Package](task-context-package.md) | Контекст конкретной задачи и его безопасная передача workers | Draft |
| [Code Audit](code-audit.md) | Первый сквозной сценарий проверки кода | Draft |
| [Implementation Roadmap](implementation-roadmap.md) | Этапы проектирования, реализации и проверки | Draft |

## Границы источников истины

- docs/intelligence-architecture — архитектурные контракты General Agent и Intelligence Library.
- docs/knowledge — утверждённые runtime-роли, процедуры и протоколы в рамках текущего Knowledge Manager.
- docs/knowledge/schemas — действующие JSON-схемы конкретных runtime-контрактов.
- docs/intelligence-architecture — проектные схемы будущих механизмов; они не заменяют текущие handoff/result schemas.
- Исходный код, тесты и runtime-проверки определяют, что действительно реализовано.
- UI Intelligence Library — представление канонических документов, а не отдельное хранилище правил.

## Публикация

1. Новые архитектурные документы создаются со статусом Draft.
2. Draft не является исполняемой инструкцией и не попадает автоматически в контекст агента.
3. Изменение утверждённого контракта требует новой версии, проверки совместимости и сохранения Git-истории.
4. Нельзя обозначать механизм как Implemented без подтверждения исходным кодом и тестами.
5. Полные определения хранятся в одном каноническом документе; остальные документы ссылаются на него.

## Открытые вопросы (Этап 0 завершен)

Архитектурное ревью Этапа 0 успешно проведено. Вопросы покрытия компетенций кандидатов, формализации Authorization, риск-ориентированного подтверждения, компенсационных операций и enforcement фактических эффектов Tool зафиксированы в соответствующих канонических контрактах. Для Delegation Model, Skill Registry и Task Context Package завершен аудит runtime-путей и определены правила обратной совместимости. Переход к Этапу 1 (аудит текущей реализации).
