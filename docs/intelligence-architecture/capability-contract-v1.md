# Capability Contract

Статус: **Draft**. Контракт описывает декларируемые возможности Tool и ожидаемые эффекты. Сам по себе он не обеспечивает безопасность без runtime-enforcement.

## 1. Назначение

Каждый Tool публикует набор операций. Операция имеет типизированные входы/выходы, эффекты, требования Authorization, Guardrails, правила подтверждения, идемпотентности и отмены.

## 2. Структура Tool

- tool_id, version, status;
- operations[];
- runtime_requirements;
- enforcement_profile;
- observability.

## 3. Структура Operation

| Поле | Назначение |
|---|---|
| operation_id | Стабильный ID |
| input_schema | Schema аргументов |
| output_schema | Schema результата |
| effects[] | Декларация ожидаемых побочных эффектов |
| required_authorization[] | Требуемые типы доступа и области |
| guardrails[] | Применимые запреты и инварианты |
| confirmation_policy | Риск-ориентированное правило подтверждения |
| idempotency | Ключ и семантика дедупликации |
| cancellation | Поддержка отмены и её границы |
| compensation | Компенсационная операция/процедура |
| observability | События и доказательства выполнения |

## 4. Типы эффектов

Минимальный словарь:
- filesystem.read
- filesystem.write
- filesystem.delete
- process.exec
- network.request
- secret.access
- external.side_effect

Каждый эффект имеет конкретную область и параметры: разрешённый root/path, тип процесса, домен/endpoint, идентификатор секрета или внешний ресурс.

## 5. Confirmation

Confirmation не выводится автоматически из idempotent=false. Политика учитывает риск, эффект, область воздействия, режим и требование пользователя.

Подтверждение привязано к operation_id, hash канонизированных аргументов, hash релевантного контекста, сроку действия и одноразовому ID.

Состояния: pending, approved, denied, timed_out, revoked, consumed.

## 6. Idempotency, cancellation и compensation

- Идемпотентность описывает повторное выполнение с тем же ключом и аргументами.
- Отмена описывает, можно ли остановить незавершённую операцию и какие эффекты уже могли произойти.
- Компенсация — отдельное действие, пытающееся нейтрализовать эффект; она не гарантирует точного восстановления исходного состояния.
- Поле reversible без описанной compensation operation и доказуемых предусловий недостаточно.

## 7. Enforcement

Control Layer проверяет аргументы и политику до исполнения. Runtime ограничивает и наблюдает фактические эффекты:
- filesystem: sandbox/root isolation, canonical path resolution, symlink containment;
- process: allowlist executable/arguments, ограничение cwd/env, timeout и process tree control;
- network: egress policy, DNS/IP validation, контроль redirects/proxy;
- secrets: scoped secret broker, отсутствие секретов в логах и результатах;
- external effects: отдельная политика подтверждения и reconciliation результата.

Фактические эффекты сверяются с декларацией. Несоответствие — security event и контролируемый отказ.

## 8. Статус

Это каркас контракта, а не готовая JSON Schema. До реализации необходимо утвердить типы областей ресурсов, схему confirmation policy, компенсационные операции и платформенные enforcement adapters.
