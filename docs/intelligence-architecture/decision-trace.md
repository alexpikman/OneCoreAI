# Decision Trace

Статус: **Draft**.

## 1. Назначение

Decision Trace — структурированный журнал фактических решений и событий одного execution attempt. Он позволяет восстановить, что система выбрала, какие ограничения проверила, какие операции запросила и что реально произошло.

Trace не является chain-of-thought и не требует раскрытия скрытых рассуждений модели.

## 2. Обязательные поля события

- event_id — уникальный ID;
- execution_attempt_id — обязателен всегда, включая отказ до Snapshot;
- snapshot_id — nullable до успешного Preflight/Snapshot;
- timestamp;
- event_type;
- actor — runtime, General Agent, specialization, Tool или human;
- phase_id — если применимо;
- decision — выбранное действие/вариант/результат;
- alternatives[] — допустимые альтернативы, если применимо;
- evidence_refs[] — ссылки на проверяемые факты, результаты и версии;
- policy_checks[] — результаты Authorization, Guardrail и Confirmation;
- input_refs[] / output_refs[] — ссылки на данные без копирования секретов;
- status и failure_code, если применимо.

model_rationale допускается как необязательное краткое объяснение, но не считается доказательством и хранится отдельно от evidence_refs.

## 3. Типы событий

- preflight_refusal
- intent_resolution
- playbook_selection
- specialization_selection
- phase_transition
- confirmation_request
- confirmation_response
- escalation
- tool_operation
- budget_event
- artifact_validation
- execution_completed
- execution_failed
- execution_cancelled

## 4. Фиксация Tool operation

Для операции фиксируются Tool/operation ID и версия, hash аргументов, объявленные эффекты, результаты Authorization/Guardrail/Confirmation, фактический результат, наблюдаемые эффекты, длительность и код завершения.

Секреты, приватные ключи, токены и чувствительные значения не записываются в открытом виде. Для сопоставления используются безопасные ссылки или хеши.

## 5. Отказ до Snapshot

Preflight refusal обязан иметь execution_attempt_id, snapshot_id=null, код причины, проверенные зависимости/политики и доступные альтернативы. Нельзя требовать Snapshot ID до его создания.

## 6. Целостность

- События одного запуска имеют стабильный порядок и уникальные ID.
- Факт выполнения отделён от объяснения модели.
- Историческое событие не переписывается при изменении текущей конфигурации.
- Указываются точные версии контрактов и политик, применявшиеся к решению.
- Trace не содержит секреты и не подменяет низкоуровневый системный аудит.

## 7. Статус

Формат требует машинно-читаемой схемы, политики хранения, корреляции с текущим журналом операций OneCoreAI и тестов полноты событий.
