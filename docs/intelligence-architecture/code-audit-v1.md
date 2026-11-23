# Code Audit — первый вертикальный сценарий

Статус: **Draft / read-only first**.

## 1. Цель

Проверить сквозную архитектуру General Agent на реальной задаче без риска изменения проекта. Первый срез должен доказать маршрутизацию, выбор специализаций, проверку компетенций, Artifacts и Decision Trace.

## 2. Intent

code_audit: анализ существующего кода, выявление дефектов, рисков и пробелов проверки без изменения файлов.

Входы:
- цель аудита;
- корень проекта и доступная файловая область;
- язык/стек, если известны;
- ограничения пользователя;
- критерии глубины проверки.

## 3. Фазы

| Фаза | activity_type | Требуемые компетенции | Кандидатная специализация | Ожидаемый результат |
|---|---|---|---|---|
| analyze | analysis | code_analysis, architecture_analysis | Analyst | analysis_report |
| test | verification | test_execution, regression_testing | Tester | test_report |
| review | verification | code_review, quality_assessment | Reviewer | review_report |

Каждый кандидат самостоятельно покрывает все компетенции своей фазы. Фактический выбор фиксируется в Decision Trace.

## 4. Read-only ограничения

- Запрещены запись, удаление и переименование файлов.
- Запрещены команды с побочными эффектами.
- Запуск тестов разрешён только после проверки их read-only характера и допустимости временных файлов/кэшей.
- Сетевой доступ выключен по умолчанию.
- Не выполнять install/update/migration и не изменять lock-файлы.
- При невозможности подтвердить безопасность операции — отказ или запрос отдельного разрешения.

## 5. Artifacts

- analysis_report: находки с severity, evidence, affected files/lines, impact и recommendation.
- test_report: команды, статус, exit code, вывод и ограничения.
- review_report: проверка полноты, ложноположительных выводов, приоритетов и остаточных рисков.

Все обязательные Outputs проходят Schema validation до следующей фазы.

## 6. Критерии успешного результата

- Intent и Playbook выбраны с записью оснований и альтернатив.
- Preflight прошёл; Snapshot закрепил конфигурацию.
- Для каждой фазы записан фактический выбор specialization.
- Каждая операция прошла Control Layer.
- Artifacts валидны.
- Decision Trace позволяет восстановить ход исполнения.
- Итог отделяет подтверждённые дефекты от гипотез и непроверенных рисков.

## 7. Второй этап — контролируемое исправление

Только после успешного read-only среза можно проектировать write-путь: Developer specialization, ограниченные filesystem.write permissions, diff proposal, confirmation с args/context hash, контроль фактических изменений, checkpoint/compensation и повторный тест с независимым Reviewer.

Этот этап не входит в read-only Code Audit v1.
