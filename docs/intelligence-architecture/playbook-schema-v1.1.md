# Playbook Schema v1.1

Статус: **Draft / требует закрытия открытых вопросов**. Документ фиксирует структуру и правила валидации; это ещё не исполняемая JSON Schema.

## 1. Назначение

Playbook — версионируемый сценарий выполнения Intent. Он описывает фазы, требования, переходы, ожидаемые результаты, бюджеты и эскалацию. Он не содержит копий системных промптов и не определяет фактические права доступа.

## 2. Корневой объект

| Поле | Тип | Требование | Назначение |
|---|---|---|---|
| id | string | required | Стабильный идентификатор |
| version | semver | required | Версия Playbook |
| name | string | required | Отображаемое имя |
| description | string | required | Назначение |
| status | enum | required | draft, review, approved, deprecated |
| intent | IntentRef | required | Класс задачи |
| inputs | InputSpec[] | required | Входы и их Schema |
| context_requirements | ContextRequirement[] | optional | Необходимый контекст |
| phases | Phase[] | required | Фазы сценария |
| decision_points | DecisionPoint[] | optional | Точки выбора |
| escalation | EscalationPolicy | required | Передача человеку |
| observability | ObservabilitySpec | required | Журналирование |
| metadata | object | optional | Авторство, теги, совместимость |

## 3. Phase

| Поле | Тип | Требование | Назначение |
|---|---|---|---|
| id | PhaseId | required | Уникальный ID в Playbook |
| name | string | required | Название |
| activity_type | enum | required | analysis, execution, verification |
| required_competencies | CompetencyRef[] | required, non-empty | Компетенции фазы |
| selection | enum | required | fixed, agent_choice, system_choice |
| fixed_specialization | SpecializationRef | conditional | Только для fixed |
| allowed_specializations | SpecializationRef[] | conditional | Допустимые кандидаты |
| role | RoleRef | required | Функциональная ответственность |
| mode | ModeRef | required | Степень автономности |
| skills | SkillRef[] | required | Явные требования фазы |
| entry_condition | Expression | optional | Условие входа |
| exit_condition | Expression | optional | Дополнительное условие завершения |
| transitions | Transition[] | conditional | Условные переходы |
| next | PhaseId/Terminal | conditional | Безусловный переход |
| on_failure | FailureTransition | optional | Техническая ошибка |
| expected_outputs | OutputSpec[] | required | Контракты результатов |
| budgets_override | BudgetSpec | optional | Лимиты фазы |

## 4. Выбор специализации

- fixed: fixed_specialization обязателен; allowed_specializations запрещён.
- agent_choice: allowed_specializations может отсутствовать; тогда используются все специализации, прошедшие Preflight.
- system_choice: allowed_specializations обязателен и не пуст.
- Поля, не относящиеся к выбранному selection, отклоняются валидатором.
- Каждый кандидат самостоятельно покрывает все required_competencies, обязательные Skills и необходимые Tools/операции.
- Preflight проверяет кандидатов, но не выбирает фактическую специализацию для agent_choice или system_choice.

## 5. Переходы

Transition содержит when (Expression или always) и target (ID фазы либо done).

1. Переходы проверяются сверху вниз.
2. Выбирается первый переход с истинным условием.
3. always допускается только последним.
4. Если ни одно условие не истинно, применяется политика эскалации/остановки.
5. Указывается ровно одно из next или transitions.
6. Все ссылки должны разрешаться в существующую фазу или допустимый терминал.
7. on_failure предназначен для технических отказов, а не для маскировки невыполненных условий.

## 6. Expression DSL

Разрешённые операторы: eq, neq, gt, gte, lt, lte, and, or, not, in, exists.

Разрешённые источники: artifacts.*, context.*, budgets.* и типизированные константы.

Запрещены произвольный код, eval, вызов функций, динамические имена полей и ссылки за пределами объявленных схем. Resolver валидирует каждый путь по Schema соответствующего источника.

## 7. OutputSpec

Каждый Output объявляет стабильный id, SchemaRef с версией, признак required и описание. Отсутствие обязательного результата или ошибка Schema блокирует переход. Не каждая фаза обязана создавать отдельный Artifact: проверяется только объявленный набор outputs.

## 8. Бюджеты и эскалация

Бюджеты ограничивают число фаз, операций Tool, токены, wall-clock time и повторные циклы. Override фазы может только ужесточать лимиты Playbook.

Эскалация определяет причину, адресата/канал, варианты продолжения и поведение при отсутствии ответа. Превышение бюджета не разрешает автоматически расширять лимиты.

## 9. Открытые вопросы перед фиксацией v1.1

1. Завершить грамматику InputSpec, ContextRequirement, DecisionPoint, EscalationPolicy и ObservabilitySpec.
2. Уточнить терминальные состояния и достижимость графа фаз.
3. Утвердить модель покрытия компетенций и Skills каждым кандидатом.
4. Согласовать timeout/cancel/revoked для каждой точки ожидания.
5. Создать machine-readable JSON Schema и негативные тесты после закрытия вопросов.

## 10. Статус реализации

Schema v1.1 — проектный контракт, а не утверждение о существующем Playbook Engine или runtime-валидации в OneCoreAI.
