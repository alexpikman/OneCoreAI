import type { GeneralAgentAuthorityMode } from '../types/onecore';

export const GOD_PRO_CONTROL_PHRASE = 'I understand that I could lose everything';

export interface CriticalGodModeRule {
  id: string;
  actionType: 'command' | 'file_write' | 'file_delete' | 'git_mutate' | 'system_path' | 'bulk_operation';
  riskLevel: 'critical' | 'high';
  titleRu: string;
  titleEn: string;
  descriptionRu: string;
  descriptionEn: string;
  examples: string[];
}

export const CRITICAL_GOD_MODE_RULES: CriticalGodModeRule[] = [
  {
    id: 'god-rule-destructive-shell',
    actionType: 'command',
    riskLevel: 'critical',
    titleRu: 'Деструктивные и системные команды терминала',
    titleEn: 'Destructive or system-level terminal commands',
    descriptionRu:
      'Команды форматирования, рекурсивного удаления, перезаписи разделов, завершения процессов, изменения реестра, прав root/sudo или выключения ОС.',
    descriptionEn:
      'Disk formatting, recursive deletion, block-device writes, forced process termination, registry/system config edits, sudo/root escalation, or OS shutdown.',
    examples: ['rm -rf', 'format', 'diskpart', 'del /f /s /q', 'mkfs', 'dd if=', 'shutdown', 'Remove-Item -Recurse -Force'],
  },
  {
    id: 'god-rule-mutating-shell',
    actionType: 'command',
    riskLevel: 'high',
    titleRu: 'Команды терминала, меняющие состояние среды или зависимостей',
    titleEn: 'State-mutating shell or package commands',
    descriptionRu:
      'Запуск произвольных shell-команд в проекте и системе в режиме GOD требует явного подтверждения пользователя перед исполнением.',
    descriptionEn:
      'Executing arbitrary shell commands in GOD mode requires explicit user confirmation before launch.',
    examples: ['npm install', 'cargo build', 'git clean', 'kill', 'chmod', 'chown'],
  },
  {
    id: 'god-rule-file-delete',
    actionType: 'file_delete',
    riskLevel: 'critical',
    titleRu: 'Удаление файлов и каталогов',
    titleEn: 'File and directory deletion',
    descriptionRu:
      'Любое удаление существующих файлов проекта или системных файлов блокируется до подтверждения пользователем.',
    descriptionEn:
      'Any deletion of existing project or disk files is paused until explicitly confirmed by the user.',
    examples: ['delete_project_file', 'unlink', 'rmdir'],
  },
  {
    id: 'god-rule-sensitive-configs',
    actionType: 'file_write',
    riskLevel: 'critical',
    titleRu: 'Изменение секретов, ключей и критических конфигов',
    titleEn: 'Modification of secrets, keys, and critical configuration files',
    descriptionRu:
      'Запись или перезапись .env, приватных ключей, хранилища vault, package.json, Cargo.toml, server.ts, конфигов сборки и маршрутизации.',
    descriptionEn:
      'Writing or overwriting .env files, private keys, vault stores, package.json, Cargo.toml, server.ts, or core runtime configs.',
    examples: ['.env', '.pem / .key', 'settings.json', 'package.json', 'Cargo.toml', 'server.ts'],
  },
  {
    id: 'god-rule-git-mutate',
    actionType: 'git_mutate',
    riskLevel: 'high',
    titleRu: 'Мутирующие операции Git (commit / push / fetch / reset)',
    titleEn: 'Mutating Git operations (commit / push / fetch / reset)',
    descriptionRu:
      'Операции, меняющие историю коммитов, индекс или состояние удалённого репозитория.',
    descriptionEn:
      'Operations that alter commit history, working index, or remote repository state.',
    examples: ['git commit', 'git push', 'git reset --hard', 'git push --force'],
  },
  {
    id: 'god-rule-outside-project',
    actionType: 'system_path',
    riskLevel: 'critical',
    titleRu: 'Выход за пределы папки активного проекта',
    titleEn: 'Access outside active project root',
    descriptionRu:
      'Обращение к системным дискам (C:\\, /etc, /usr) и путям вне проекта в режиме GOD заблокировано; для неограниченного доступа требуется подтверждённый GodPro.',
    descriptionEn:
      'Accessing host paths outside the connected project is blocked in GOD mode; unrestricted access requires verified GodPro activation.',
    examples: ['C:\\Windows', '/etc/passwd', '../outside'],
  },
];

export const GENERAL_AGENT_AUTHORITY_META: Record<
  GeneralAgentAuthorityMode,
  {
    label: string;
    shortLabel: string;
    badgeRu: string;
    summaryRu: string;
  }
> = {
  standard: {
    label: 'Standard (Безопасный)',
    shortLabel: 'Standard',
    badgeRu: 'Обычный режим',
    summaryRu:
      'Read-only инструменты в PLAN, предложения правок/команд в ACT и проверка разрешений проекта.',
  },
  god: {
    label: 'GOD (Бог проекта + стоп-контроль краха)',
    shortLabel: 'GOD',
    badgeRu: 'Режим GOD',
    summaryRu:
      'Без жёсткой роли: открывает и читает файлы проекта, создаёт кастомных субагентов с точными правами и задачами, но на каждое опасное действие из списка краха ждёт вашего подтверждения.',
  },
  'god-pro': {
    label: 'GodPro (Максимум без ограничений)',
    shortLabel: 'GodPro',
    badgeRu: 'GodPro MAX',
    summaryRu:
      'Максимальные системные разрешения без подтверждений (включая любые пути и команды ОС). Полная ответственность на пользователе.',
  },
};

export const GOD_PRO_BILINGUAL_WARNINGS = {
  stage1: {
    badgeRu: 'ПРЕДУПРЕЖДЕНИЕ 1 ИЗ 3 · КРИТИЧЕСКИЙ УРОВЕНЬ РИСКА',
    badgeEn: 'WARNING 1 OF 3 · CRITICAL RISK LEVEL',
    titleRu: 'Активация неограниченного режима GodPro',
    titleEn: 'Activation of Unrestricted GodPro Mode',
    bodyRu:
      'Режим GodPro полностью снимает все защитные ограничения, песочницу проекта и запросы подтверждения. Агент сможет выполнять ЛЮБЫЕ операции на вашем компьютере и серверах, включая чтение и удаление любых системных файлов, запуск произвольных команд и даже форматирование диска (например, format C:). ВЫ БЕРЁТЕ НА СЕБЯ ПОЛНУЮ ЕДИНОЛИЧНУЮ ОТВЕТСТВЕННОСТЬ в случае потери данных или полного уничтожения всей вашей IT-инфраструктуры.',
    bodyEn:
      'GodPro mode completely disables all safety guardrails, project sandboxing, and confirmation prompts. The agent will be permitted to execute ANY operation on your machine and infrastructure, including reading or deleting arbitrary system files, running unrestricted OS commands, and even formatting drives (e.g., format C:). YOU ASSUME FULL SOLE RESPONSIBILITY in the event of data loss or complete destruction of your entire IT infrastructure.',
    acceptCheckboxRu:
      'Я осознаю, что вся ответственность за сохранность файлов, ОС и всей IT-инфраструктуры лежит только на мне.',
    acceptCheckboxEn:
      'I understand that sole responsibility for all files, operating systems, and my entire IT infrastructure rests exclusively on me.',
  },
  stage2: {
    badgeRu: 'ПРЕДУПРЕЖДЕНИЕ 2 ИЗ 3 · РУЧНОЕ ПОДТВЕРЖДЕНИЕ ФРАЗЫ',
    badgeEn: 'WARNING 2 OF 3 · MANUAL PHRASE VERIFICATION',
    titleRu: 'Введите контрольную фразу вручную',
    titleEn: 'Type the Control Phrase Manually',
    bodyRu:
      'Чтобы подтвердить осознанность необратимых последствий, перепишите контрольную фразу вручную с клавиатуры в поле ниже. Копирование и вставка (Ctrl+V / Paste / перетаскивание) строго запрещены.',
    bodyEn:
      'To confirm your awareness of irreversible consequences, manually type the exact control phrase below using your keyboard. Copying and pasting (Ctrl+V / Paste / drag-and-drop) is strictly prohibited.',
    pasteBlockedRu: 'Вставка запрещена! Введите контрольную фразу вручную по символам.',
    pasteBlockedEn: 'Pasting is disabled! Type the control phrase manually character by character.',
  },
  stage3: {
    badgeRu: 'ПРЕДУПРЕЖДЕНИЕ 3 ИЗ 3 · ОТКАЗ ОТ ОТВЕТСТВЕННОСТИ РАЗРАБОТЧИКА',
    badgeEn: 'WARNING 3 OF 3 · DEVELOPER LIABILITY WAIVER',
    titleRu: 'Последнее подтверждение и снятие ответственности',
    titleEn: 'Final Confirmation & Developer Liability Waiver',
    bodyRu:
      'Контрольная фраза принята. Подтвердите ещё раз, что вы действительно хотите открыть режим GodPro. Разработчик и авторы ONE CORE AI отказываются от любой ответственности и не несут никаких обязательств за прямой или косвенный ущерб, уничтожение данных, сбои серверов, повреждение ОС или полный крах вашей IT-инфраструктуры.',
    bodyEn:
      'Control phrase accepted. Confirm one final time that you truly want to unlock GodPro mode. The developer and authors of ONE CORE AI disclaim all warranties and accept zero liability for any direct or indirect damages, data destruction, server outages, OS corruption, or complete collapse of your IT infrastructure.',
    waiverCheckboxRu:
      'Я подтверждаю отказ от любых претензий к разработчику и включаю GodPro на свой страх и риск.',
    waiverCheckboxEn:
      'I agree to the developer liability waiver and enable GodPro entirely at my own risk.',
  },
} as const;
