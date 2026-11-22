# Intelligence Library — Implementation Roadmap

Статус: **Draft**. Порядок отделяет документацию, read-only прототип и безопасное выполнение операций записи.

## Этап 0. Каноническая документация

- [x] Создать индекс Intelligence Library.
- [x] Зафиксировать Ontology v2 как Draft.
- [x] Зафиксировать Playbook Schema v1.1 с открытыми вопросами.
- [x] Зафиксировать Execution Model v2 с открытыми вопросами.
- [x] Создать каркас Capability Contract и Decision Trace.
- [x] Описать read-only Code Audit и последовательность реализации.
- [ ] Провести архитектурное ревью и закрыть открытые вопросы.
- [ ] Утвердить версии контрактов и правила совместимости.

## Этап 1. Аудит текущей реализации

- [ ] Проверить фактические модели ролей, Skills, Tools и permissions.
- [ ] Сопоставить текущий AgentTeam runtime с целевой онтологией.
- [ ] Найти существующие handoff/result schemas и тесты.
- [ ] Составить таблицу Implemented / Partial / Planned / Missing.
- [ ] Не менять существующие хранилища и runtime до фиксации границ миграции.

## Этап 2. Read-only вертикальный срез

- [ ] Intent Resolution.
- [ ] Preflight и проверка полного покрытия каждого кандидата.
- [ ] Execution Snapshot.
- [ ] Analysis → Testing → Review.
- [ ] Schema validation обязательных Artifacts.
- [ ] Decision Trace и контролируемые отказы.
- [ ] Повторяемые интеграционные тесты на реальных репозиториях.

## Этап 3. Registry и каталог

- [ ] Типизированный Registry с версиями и ссылками.
- [ ] Проверка связей, дубликатов ID и совместимости.
- [ ] Intelligence Library UI как представление канонических документов.
- [ ] Поиск, фильтры, статусы, граф связей и просмотр истории.
- [ ] Исключить независимые копии правил в UI.

## Этап 4. Контролируемое выполнение

- [ ] Capability Contracts для filesystem/process/network.
- [ ] Реальный enforcement эффектов на уровне runtime/OS.
- [ ] Формальная Authorization и deny-overrides.
- [ ] Risk-based Confirmation.
- [ ] Cancellation и compensation contracts.
- [ ] Ограниченный Developer write path с diff review.

## Этап 5. Расширение библиотеки

- [ ] Добавлять Playbooks по одному, только после end-to-end теста.
- [ ] Подключать новые Specializations и Competencies через Registry.
- [ ] Вводить версии и миграции без нарушения активных запусков.
- [ ] Проверять трассируемость от Intent до фактических эффектов Tool.

## Критерий завершения

Документы и UI сами по себе не означают, что библиотека реализована. Нужны проверяемые Registry-связи, runtime resolution, enforcement, Snapshot, Trace и интеграционные тесты.
