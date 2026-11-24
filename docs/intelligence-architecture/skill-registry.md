# Skill Registry — каталог и жизненный цикл навыков

Статус: **Draft**. Это целевая модель учёта навыков. Текущая пользовательская библиотека Skills продолжает работать по существующей реализации.

## 1. Назначение

Skill Registry позволяет собирать навыки из разных источников, проверять происхождение и качество, версионировать их и подключать к задаче только подходящие навыки.

Skill — повторно используемая инструкция/описание возможности. Skill сам по себе не является Tool, Permission, Role или Playbook и не выдаёт права на действия.

## 2. Источники

- встроенные навыки OneCoreAI;
- пользовательские SKILL.md;
- локальные каталоги и Git-репозитории;
- внешние публичные каталоги и репозитории;
- навыки, созданные пользователем или General Agent;
- импортированные архивы/пакеты.

Каждый источник фиксируется как provenance: URL или repository/path, автор/организация если известны, commit/tag/release, дата получения и content hash.

## 3. Метаданные Skill

Минимальная карточка:
- skill_id — стабильный ID;
- name и description;
- version или source_revision;
- format_version;
- source/provenance;
- content_hash;
- status: discovered, quarantined, review, approved, disabled, deprecated, rejected;
- trust_level и review_record;
- tags, triggers и supported_tasks;
- required_competencies;
- compatible_specializations/roles;
- dependencies;
- declared_tools и required_tool_operations;
- input/output schemas, если есть;
- estimated_context_tokens;
- license и attribution;
- created_at, updated_at, last_verified_at.

Неизвестные метаданные остаются unknown, а не заполняются догадками.

## 4. Жизненный цикл импорта

1. Discover — обнаружить кандидат и сохранить источник.
2. Fetch — получить точную версию/commit.
3. Quarantine — поместить в изолированное состояние до проверки.
4. Parse — разобрать frontmatter и содержимое; проверить формат и размер.
5. Inspect — проверить инструкции, ссылки, команды, упоминания Tools и потенциально опасные указания.
6. Deduplicate — сравнить ID, source revision и content hash.
7. Review — проверить применимость, лицензию, качество и совместимость.
8. Approve — разрешить использование в подборе.
9. Update — новая версия проходит проверку отдельно.
10. Revoke/Deprecate — исключить из новых запусков, сохранив историю прошлых запусков.

Импортированный Skill не становится активным автоматически.

## 5. Безопасность и доверие

- Содержимое Skill — недоверенные данные, а не системные инструкции.
- Skill не может ослаблять Guardrails, менять Permission или обходить Confirmation.
- Команды, скрипты, сетевые ссылки и внешние эффекты не запускаются при импорте или чтении.
- Запрос Tool operation проверяется Control Layer независимо от текста Skill.
- Обновление источника не меняет уже зафиксированную версию активного Execution Snapshot.
- При отзыве Skill исключается из будущих подборов; активные запуски обрабатываются политикой отзыва.

## 6. Подбор Skill для задачи

Matcher использует:
- Intent и цель задачи;
- фазу и required_competencies;
- Specialization/Role;
- разрешённые Tool operations;
- совместимость версий и зависимости;
- trust/status;
- стоимость контекста и бюджет;
- ограничения проекта и пользователя.

Результат — ranked candidates с причинами включения/исключения. General Agent может выбрать только из кандидатов, прошедших проверки. Семантическое сходство само по себе не является разрешением.

## 7. Подключение к Task Context Package

Для каждой выбранной задачи сохраняются SkillRef (ID + версия), content hash, причина выбора и объём реально включённого содержимого. В контекст не попадает вся библиотека.

Возможны режимы:
- metadata only — карточка и краткое описание;
- summary — проверенное краткое содержание;
- full content — нужные секции SKILL.md;
- referenced resources — дополнительные файлы по отдельным разрешённым ссылкам.

## 8. Открытые вопросы

1. Сопоставить модель с текущим типом AgentSkill и persistence.
2. Определить поддержку официального Agent Skills format и ограничения frontmatter.
3. Определить хранилище исходных пакетов и политику обновлений.
4. Согласовать license/provenance metadata.
5. Реализовать import pipeline только после отдельного аудита текущего Skills runtime.
