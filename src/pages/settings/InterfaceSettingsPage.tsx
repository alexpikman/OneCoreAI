import React, { useState } from 'react';
import { Check, ChevronDown, ChevronRight, Eye, Palette, RotateCcw } from 'lucide-react';
import { PageContent } from '../../components/layout/PageContent';
import { PageHeader } from '../../components/layout/PageHeader';
import { PageLayout } from '../../components/layout/StandardPageLayout';
import {
  NAVIGATION_VISIBILITY_GROUPS,
  isNavigationVisibilityEnabled,
  type VisibilityElement,
  type VisibilityGroup,
} from '../../data/navigationVisibility';
import { useOneCoreStore } from '../../store/useOneCoreStore';
import type { ChatVisibilitySettings, UiStylePreset } from '../../types/onecore';
import { cn } from '../../utils/cn';
import { UI_STYLE_META, getPageUiTokens } from '../../utils/uiStyle';

interface VisibilityToggleGroup {
  title: string;
  items: { key: keyof ChatVisibilitySettings; label: string; hint: string }[];
}

const VISIBILITY_GROUPS: VisibilityToggleGroup[] = [
  {
    title: 'Левая боковая панель',
    items: [
      {
        key: 'showLeftSidebar',
        label: 'Подменю рабочего стола',
        hint: 'Скрывает контекстные пункты рабочего стола, сохраняя основное меню разделов',
      },
      {
        key: 'showProjectTree',
        label: 'Файлы проекта',
        hint: 'Показывает кнопку файлового проводника в левом меню',
      },
      {
        key: 'showSessionHistory',
        label: 'История чат-сессий',
        hint: 'Сохранённые задачи, поиск и кнопка нового чата',
      },
    ],
  },
  {
    title: 'Правая панель инспектора',
    items: [
      {
        key: 'showRightInspector',
        label: 'Показывать правый инспектор целиком',
        hint: 'Расширяет область чтения кода и диффов',
      },
      {
        key: 'showTelemetry',
        label: 'Статус llama-server.exe и VRAM/RAM',
        hint: 'Кнопка Стоп/Запуск и индикаторы памяти',
      },
      {
        key: 'showInferenceControls',
        label: 'Параметры генерации (Temp, n_ctx, GPU)',
        hint: 'Быстрая настройка слоёв и контекста',
      },
      {
        key: 'showSubagentsPanel',
        label: 'Панель субагентов и делегирования',
        hint: 'Запуск параллельных воркеров и их карточки в чате',
      },
      {
        key: 'showActiveContext',
        label: 'Активный контекст и чекбоксы файлов',
        hint: 'Подсчёт токенов по открытым файлам',
      },
    ],
  },
  {
    title: 'Области потока чата (Cline-стиль)',
    items: [
      {
        key: 'showToolbar',
        label: 'Панель инструментов чата',
        hint: 'Переключение ACT/PLAN, путь проекта, браузер, терминал и checkpoints',
      },
      {
        key: 'showExecutionEnvBar',
        label: 'Среда выполнения (Local / SSH / Docker)',
        hint: 'Кнопки выбора среды в левом меню рабочего стола',
      },
      {
        key: 'showTaskBanner',
        label: 'Панель задачи Cline (токены, прогресс, модель)',
        hint: 'Компактная строка состояния текущей задачи',
      },
      {
        key: 'showMessageHeaders',
        label: 'Заголовки сообщений (модель и роль)',
        hint: 'Автор, модель и активная роль',
      },
      { key: 'showTimestamps', label: 'Временные метки сообщений', hint: 'Время отправки HH:MM:SS' },
      {
        key: 'showReadFilesChips',
        label: 'Блоки прочитанных файлов (read_file)',
        hint: 'Список файлов, проанализированных агентом',
      },
      {
        key: 'showDiffBlocks',
        label: 'Встроенные Git-диффы (replace_in_file)',
        hint: 'Интерактивное принятие и откат изменений',
      },
      {
        key: 'showTerminalBlocks',
        label: 'Блоки терминала PowerShell (execute_command)',
        hint: 'Запуск команд и диагностика ошибок',
      },
      {
        key: 'showCheckpointBadges',
        label: 'Бейджи Checkpoints в сообщениях',
        hint: 'Идентификатор снапшота SQLite',
      },
    ],
  },
  {
    title: 'Область ввода (Composer)',
    items: [
      {
        key: 'showRoleSwitcher',
        label: 'Переключатель ролей в верхней шапке',
        hint: 'Разработчик, Архитектор, Ревьюер, QA',
      },
      {
        key: 'showQuickPrompts',
        label: 'Кнопки быстрых сценариев',
        hint: 'Пресеты промптов для мгновенного старта',
      },
      {
        key: 'showComposerStatusRow',
        label: 'Строка статуса токенов и активного снапшота',
        hint: 'Индикатор контекста и последнего Checkpoint',
      },
    ],
  },
];

interface MenuVisibilityControlsProps {
  group: VisibilityGroup;
  panelId: string;
  settings: Record<string, boolean>;
  onChange: (key: string, value: boolean) => void;
}

const MenuVisibilityControls: React.FC<MenuVisibilityControlsProps> = ({ group, panelId, settings, onChange }) => {
  const renderElement = (element: VisibilityElement, depth = 0): React.ReactNode => {
    const enabled = isNavigationVisibilityEnabled(settings, element.id);
    const showIconControl =
      (panelId === 'left' &&
        (element.id === 'brand.logo' ||
          element.id === 'brand.mascot' ||
          element.id === 'brand.role' ||
          element.id.startsWith('group.') ||
          element.id.startsWith('item.') ||
          element.id.startsWith('workspace.env.') ||
          [
            'workspace.project-edit',
            'workspace.project-create',
            'workspace.project-files',
            'workspace.new-file',
            'workspace.git-status',
            'workspace.undo',
          ].includes(element.id) ||
          element.id === 'nav.mobile-toggle' ||
          element.id === 'nav.ai-settings')) ||
      (panelId === 'right' && element.id.endsWith('.title') && element.id !== 'right.checkpoints.title');
    const showLabelControl =
      (panelId === 'left' &&
        (element.id === 'brand.logo' ||
          element.id === 'brand.role' ||
          element.id === 'brand.activity' ||
          element.id.startsWith('group.') ||
          element.id.startsWith('item.') ||
          element.id.startsWith('workspace.env.') ||
          ['workspace.project-create', 'workspace.project-files'].includes(element.id) ||
          element.id === 'nav.mode-switch')) ||
      (panelId === 'right' && element.id.endsWith('.title'));

    return (
      <div key={element.id} className={cn('space-y-1', depth > 0 && 'ml-3 border-l border-zinc-200 pl-3 dark:border-zinc-800')}>
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg py-1.5">
          <label className="flex min-w-0 flex-1 items-center gap-2 text-xs font-medium text-zinc-800 dark:text-zinc-200">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) => onChange(element.id, event.target.checked)}
              className="h-3.5 w-3.5 shrink-0 accent-blue-600"
            />
            <span>{element.label}</span>
          </label>
          {(showIconControl || showLabelControl) && (
            <div className="flex items-center gap-3 pl-5">
              {showIconControl && (
                <label className="inline-flex items-center gap-1 text-[10px] text-zinc-500 dark:text-zinc-400">
                  <input
                    type="checkbox"
                    checked={isNavigationVisibilityEnabled(settings, `${element.id}.icon`)}
                    onChange={(event) => onChange(`${element.id}.icon`, event.target.checked)}
                    className="h-3 w-3 accent-blue-600"
                  />
                  Иконка
                </label>
              )}
              {showLabelControl && (
                <label className="inline-flex items-center gap-1 text-[10px] text-zinc-500 dark:text-zinc-400">
                  <input
                    type="checkbox"
                    checked={isNavigationVisibilityEnabled(settings, `${element.id}.label`)}
                    onChange={(event) => onChange(`${element.id}.label`, event.target.checked)}
                    className="h-3 w-3 accent-blue-600"
                  />
                  Текст
                </label>
              )}
            </div>
          )}
        </div>
        {element.children?.map((child) => renderElement(child, depth + 1))}
      </div>
    );
  };

  return <div className="space-y-3">{group.elements.map((element) => renderElement(element))}</div>;
};

export const InterfaceSettingsPage: React.FC = () => {
  const {
    appNavigationWidth,
    setAppNavigationWidth,
    uiStyle,
    setUiStyle,
    chatVisibility,
    updateChatVisibility,
    navigationVisibility,
    updateNavigationVisibility,
    applyChatLayoutPreset,
  } = useOneCoreStore();

  const [expandedVisibilityGroups, setExpandedVisibilityGroups] = useState<Record<string, boolean>>({});
  const tokens = getPageUiTokens(uiStyle);
  const totalCount = VISIBILITY_GROUPS.reduce((count, group) => count + group.items.length, 0);
  const visibleCount = VISIBILITY_GROUPS.reduce(
    (count, group) => count + group.items.filter(({ key }) => chatVisibility[key]).length,
    0,
  );

  return (
    <PageLayout>
      <PageHeader>
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
            <Palette className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <h1 className="text-xl font-semibold">Интерфейс</h1>
          </div>
        </div>
      </PageHeader>
      <PageContent contentClassName="space-y-6 py-6">
        <div className={cn('p-5 border space-y-4', tokens.cardRadius, tokens.cardBg, tokens.cardBorder)}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-base font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Palette className="w-4 h-4 text-blue-500" />
                <span>6 вариантов стиля интерфейса</span>
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Переключает плотность IDE, форму карточек, панель задачи Cline и акценты по всему приложению.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {(Object.keys(UI_STYLE_META) as UiStylePreset[]).map((styleKey) => {
              const meta = UI_STYLE_META[styleKey];
              const selected = uiStyle === styleKey;
              return (
                <button
                  key={styleKey}
                  type="button"
                  onClick={() => setUiStyle(styleKey)}
                  className={cn(
                    'p-4 border text-left transition-all flex flex-col justify-between gap-3',
                    meta.cardRadius,
                    selected
                      ? tokens.activeHighlight
                      : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/60 hover:border-zinc-400 dark:hover:border-zinc-600',
                  )}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{meta.label}</span>
                      {selected && <Check className="w-4 h-4 text-blue-500 shrink-0" />}
                    </div>
                    <p className="text-[11.5px] text-zinc-600 dark:text-zinc-400 leading-relaxed">{meta.subtitle}</p>
                  </div>

                  <div
                    className={cn(
                      'p-2 border border-zinc-200 dark:border-zinc-800 flex items-center gap-1.5 bg-white dark:bg-zinc-950',
                      meta.cardRadius,
                    )}
                  >
                    <span className="w-3 h-5 bg-zinc-300 dark:bg-zinc-700 rounded-[2px]" />
                    <span className="flex-1 h-5 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2px] flex items-center px-1.5">
                      <span
                        className={cn(
                          'w-8 h-1.5 rounded-full',
                          styleKey === 'cyber-terminal' ? 'bg-emerald-500' : 'bg-blue-500',
                        )}
                      />
                    </span>
                    <span className="w-3 h-5 bg-zinc-200 dark:bg-zinc-800 rounded-[2px]" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className={cn('p-5 border space-y-3', tokens.cardRadius, tokens.cardBg, tokens.cardBorder)}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Ширина левого меню</h2>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Настройте ширину основного меню и его подменю на большом экране.
              </p>
            </div>
            <span className="font-mono text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
              {appNavigationWidth} px
            </span>
          </div>
          <input
            type="range"
            min={220}
            max={380}
            step={10}
            value={appNavigationWidth}
            onChange={(event) => setAppNavigationWidth(Number(event.target.value))}
            aria-label="Ширина левого меню"
            className="w-full accent-blue-600"
          />
          <div className="flex justify-between text-[10px] text-zinc-500">
            <span>220 px</span>
            <span>380 px</span>
          </div>
        </div>

        <div className={cn('p-5 border space-y-4', tokens.cardRadius, tokens.cardBg, tokens.cardBorder)}>
          <div>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Видимость элементов интерфейса</h2>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Основная навигация сгруппирована по 10 разделам с всплывающими подменю. Здесь настраиваются вспомогательные элементы левой и правой панелей. Переключатели применяются сразу; для сохранения после перезапуска нажмите «Сохранить настройки».
            </p>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {NAVIGATION_VISIBILITY_GROUPS.map((panel) => (
              <div
                key={panel.id}
                className="min-w-0 rounded-xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-950/60"
              >
                <div className="mb-4 border-b border-zinc-200 pb-2 text-sm font-semibold text-zinc-900 dark:border-zinc-800 dark:text-zinc-100">
                  {panel.label}
                </div>
                <div className="space-y-2">
                  {panel.groups.map((group) => {
                    const groupKey = `${panel.id}.${group.id}`;
                    const expanded = expandedVisibilityGroups[groupKey] === true;
                    const contentId = `visibility-${panel.id}-${group.id}`;

                    return (
                      <div key={groupKey} className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
                        <button
                          type="button"
                          aria-expanded={expanded}
                          aria-controls={contentId}
                          onClick={() =>
                            setExpandedVisibilityGroups((current) => ({
                              ...current,
                              [groupKey]: !current[groupKey],
                            }))
                          }
                          className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-xs font-semibold text-zinc-800 transition-colors hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-900"
                        >
                          <span>{group.label}</span>
                          {expanded ? (
                            <ChevronDown className="h-4 w-4 shrink-0 text-zinc-500" />
                          ) : (
                            <ChevronRight className="h-4 w-4 shrink-0 text-zinc-500" />
                          )}
                        </button>
                        <div
                          id={contentId}
                          hidden={!expanded}
                          className="border-t border-zinc-200 px-3 py-3 dark:border-zinc-800"
                        >
                          <MenuVisibilityControls
                            group={group}
                            panelId={panel.id}
                            settings={navigationVisibility}
                            onChange={(key, value) => updateNavigationVisibility({ [key]: value })}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={cn('p-5 border space-y-4', tokens.cardRadius, tokens.cardBg, tokens.cardBorder)}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-base font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Eye className="w-4 h-4 text-emerald-500" />
                <span>Видимые области в чате и рабочей станции ({visibleCount} / {totalCount})</span>
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Включайте и отключайте любые панели, заголовки, диффы, терминал, маскота и подсказки ввода.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => applyChatLayoutPreset('full')}
                className={cn(
                  'h-8 px-3 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-medium text-zinc-800 dark:text-zinc-200 inline-flex items-center gap-1.5 whitespace-nowrap',
                  tokens.cardRadius,
                )}
              >
                <RotateCcw className="w-3 h-3" />
                <span>Показать всё</span>
              </button>
              <button
                type="button"
                onClick={() => applyChatLayoutPreset('cline-focus')}
                className={cn(
                  'h-8 px-3 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-medium text-zinc-800 dark:text-zinc-200 whitespace-nowrap',
                  tokens.cardRadius,
                )}
              >
                Фокус Cline
              </button>
              <button
                type="button"
                onClick={() => applyChatLayoutPreset('minimal')}
                className={cn(
                  'h-8 px-3 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-medium text-zinc-800 dark:text-zinc-200 whitespace-nowrap',
                  tokens.cardRadius,
                )}
              >
                Минимальный чат
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {VISIBILITY_GROUPS.map((group) => (
              <div
                key={group.title}
                className={cn(
                  'p-4 border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/60 space-y-2.5',
                  tokens.cardRadius,
                )}
              >
                <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 pb-1.5 border-b border-zinc-200 dark:border-zinc-800">
                  {group.title}
                </div>
                <div className="space-y-2">
                  {group.items.map((item) => {
                    const checked = chatVisibility[item.key];
                    return (
                      <label
                        key={item.key}
                        className="flex items-start justify-between gap-3 py-1 cursor-pointer group"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-zinc-800 dark:text-zinc-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {item.label}
                          </div>
                          <div className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-snug">
                            {item.hint}
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => updateChatVisibility({ [item.key]: e.target.checked })}
                          className="mt-0.5 w-4 h-4 accent-blue-600 shrink-0"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </PageContent>
    </PageLayout>
  );
};
