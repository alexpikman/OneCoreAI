# Ontology — онтология General Agent

Статус: **Draft**. Наличие сущности в онтологии не означает, что она уже реализована в приложении.

## 1. Сущности

| Сущность | Определение | Не путать с |
|---|---|---|
| Identity | Постоянная идентичность конкретного экземпляра агента. Основной профиль OneCoreAI — General Agent. | Specialization |
| Intent | Классифицированная задача пользователя для выбора сценария. | Playbook |
| Playbook | Версионируемый исполняемый сценарий для класса задач. | Skill, Prompt |
| Phase | Этап Playbook с требованиями, условиями и ожидаемыми результатами. | Role |
| Competency | Атомарная требуемая компетенция. | Specialization |
| Specialization | Профиль компетенций, знаний и доступных Skills. | Role |
| Role | Функция и ответственность участника в фазе. | Permission |
| Mode | Степень автономности и надзора. | activity_type |
| Skill | Декларация повторно используемой возможности, связывающая компетенции с Tools. | Tool |
| Tool | Конкретный исполнитель операций с Capability Contract. | Skill |
| Permission | Политика доступа к операциям и областям ресурсов. | Role |
| Guardrail | Инвариант безопасности, который нельзя ослабить выбором Playbook, Role или Mode. | Permission |
| Schema | Типизированный контракт входных и выходных данных. | Instruction |
| Instruction | Версионируемый текст правил или контекста, подключаемый по ссылке. | Playbook |
| Artifact | Типизированный результат фазы или выполнения. | Decision |
| Decision | Зафиксированный факт выбора, перехода, подтверждения или отказа. | Model rationale |
| Execution Snapshot | Неизменяемый снимок разрешённой конфигурации зависимостей запуска. | Runtime decision |

## 2. Семантические различия

### Competency и Specialization

Competency — атомарное требование. Specialization — профиль, который должен покрывать полный набор компетенций фазы и располагать необходимыми Skills и Tools.

Примеры:
- Analyst: code_analysis, architecture_analysis.
- Developer: code_modification, refactoring.
- Tester: test_execution, regression_testing.
- Reviewer: code_review, quality_assessment.

Каждый кандидат проверяется самостоятельно. Нельзя объединять неполное покрытие нескольких кандидатов в одного условно допустимого кандидата.

### Specialization и Role

- Specialization отвечает на вопрос: какими компетенциями агент располагает?
- Role отвечает на вопрос: за какую функцию и результат он отвечает в этой фазе?

Role не выдаёт доступ к операциям. Доступ определяют Authorization и Control Layer.

### Mode и activity_type

- activity_type: analysis, execution, verification — тип работы.
- mode: supervised, autonomous, dry_run, confirm_each_step — степень автономности.

## 3. Связи

- Identity исполняет Playbook.
- Intent классифицирует задачу и участвует в выборе Playbook.
- Playbook содержит Phase и ссылается на Instructions, Schemas и политики.
- Phase объявляет Competencies, допустимые Specializations, Role, Mode, Skills, переходы и Outputs.
- Specialization покрывает Competencies и предоставляет набор Skills.
- Skill ссылается на Tools и их операции.
- Tool публикует Capability Contract.
- Permission ограничивает доступные операции и области ресурсов.
- Guardrail запрещает недопустимые эффекты независимо от Permission.
- Artifact соответствует Schema.
- Decision фиксирует фактические решения и события.
- Execution Snapshot фиксирует версии и разрешённое пространство зависимостей.

## 4. Инварианты

1. Identity не меняется при переключении специализаций.
2. Specialization не равна Role.
3. Mode не равен activity_type.
4. Смена специализации не расширяет Authorization.
5. Guardrails имеют приоритет над разрешающими политиками.
6. Playbook ссылается на Instructions и Schemas по ID/version, а не копирует содержимое.
7. Условия переходов типизированы и не исполняют произвольный код.
8. Обязательные Artifacts валидируются до перехода.
9. Decision Trace фиксирует факты; объяснение модели не является доказательством.
10. Execution Snapshot закрепляет версии зависимостей, но не предрешает runtime-выбор специализации.
11. Каждый кандидат специализации самостоятельно удовлетворяет требованиям фазы.
12. Декларации Tool не заменяют enforcement фактических эффектов.

## 5. Registry и Resolver

Registry хранит канонические версии сущностей и связи. Resolver:
1. Разрешает Playbook и ссылки.
2. Фиксирует версии и совместимость.
3. Проверяет полное покрытие Competencies каждым кандидатом.
4. Проверяет Skills, Tools, Schemas и доступность операций.
5. Проверяет применимость Permission и Guardrails.
6. Формирует Execution Snapshot с допустимым пространством вариантов.

Runtime Resolver выбирает фактическую специализацию непосредственно перед фазой, когда доступны её runtime-входы.

## 6. Границы реализации

Эта онтология не утверждает, что Registry, Resolver, Execution Snapshot, Playbook Engine или Control Layer уже существуют в OneCoreAI. Статус подтверждается отдельным аудитом исходников и тестами.
