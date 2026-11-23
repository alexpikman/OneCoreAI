import { useState } from 'react';

type WindowId = 'navigation' | 'workspace' | 'inspector';
type SectionId = 'system' | 'infrastructure' | 'activity' | 'attention';

const initialWindows: WindowId[] = ['navigation', 'workspace', 'inspector'];
const initialSections: SectionId[] = ['system', 'infrastructure', 'activity', 'attention'];

const windowLabels: Record<WindowId, string> = {
  navigation: 'Навигация',
  workspace: 'Рабочая область',
  inspector: 'Инспектор',
};

const sectionLabels: Record<SectionId, string> = {
  system: 'Состояние системы',
  infrastructure: 'AI-инфраструктура',
  activity: 'Рабочая активность',
  attention: 'Требует внимания',
};

function moveItem<T>(items: T[], source: T, target: T): T[] {
  const next = [...items];
  const from = next.indexOf(source);
  const to = next.indexOf(target);
  if (from < 0 || to < 0 || from === to) return items;
  next.splice(from, 1);
  next.splice(to, 0, source);
  return next;
}

export function LayoutEditor() {
  const [windows, setWindows] = useState(initialWindows);
  const [sections, setSections] = useState(initialSections);
  const [draggedWindow, setDraggedWindow] = useState<WindowId | null>(null);
  const [draggedSection, setDraggedSection] = useState<SectionId | null>(null);
  const [selected, setSelected] = useState<WindowId | SectionId>('workspace');

  const handleWindowDrop = (target: WindowId) => {
    if (draggedWindow) setWindows((current) => moveItem(current, draggedWindow, target));
    setDraggedWindow(null);
  };

  const handleSectionDrop = (target: SectionId) => {
    if (draggedSection) setSections((current) => moveItem(current, draggedSection, target));
    setDraggedSection(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">Макет интерфейса</h3>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Перетаскивайте окна и секции за заголовки. Это локальный экспериментальный макет — рабочие страницы не изменяются.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setWindows(initialWindows);
            setSections(initialSections);
            setSelected('workspace');
          }}
          className="h-9 rounded-lg border border-zinc-300 px-3 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Сбросить макет
        </button>
      </div>

      <div className="grid min-h-[620px] grid-cols-1 gap-3 rounded-2xl border border-dashed border-zinc-300 bg-zinc-100/70 p-3 dark:border-zinc-700 dark:bg-zinc-950/60 lg:grid-cols-[minmax(10rem,0.8fr)_minmax(24rem,2fr)_minmax(12rem,0.9fr)]">
        {windows.map((windowId) => (
          <section
            key={windowId}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => handleWindowDrop(windowId)}
            onClick={() => setSelected(windowId)}
            className={`min-w-0 rounded-xl border bg-white dark:bg-zinc-900 ${selected === windowId ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-zinc-200 dark:border-zinc-800'} ${windowId === 'workspace' ? 'lg:row-span-2' : ''}`}
          >
            <div
              draggable
              onDragStart={() => setDraggedWindow(windowId)}
              onDragEnd={() => setDraggedWindow(null)}
              className="flex h-11 cursor-grab items-center justify-between gap-2 rounded-t-xl border-b border-zinc-200 bg-zinc-50 px-3 active:cursor-grabbing dark:border-zinc-800 dark:bg-zinc-950"
            >
              <span className="truncate text-xs font-semibold">{windowLabels[windowId]}</span>
              <span className="text-[10px] text-zinc-400">↕ переместить</span>
            </div>

            {windowId === 'navigation' && (
              <div className="space-y-2 p-3">
                {['Дашборд', 'Рабочая станция', 'Терминал', 'Браузер', 'Заметки', 'Проекты', 'Настройки'].map((item, index) => (
                  <div key={item} className={`rounded-lg px-3 py-2 text-xs ${index === 0 ? 'bg-blue-50 font-medium text-blue-700 dark:bg-blue-950/50 dark:text-blue-300' : 'text-zinc-600 dark:text-zinc-400'}`}>{item}</div>
                ))}
              </div>
            )}

            {windowId === 'workspace' && (
              <div className="space-y-3 p-3">
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-blue-600 dark:text-blue-400">OneCoreAI / Dashboard</p>
                  <p className="mt-1 text-sm font-semibold">Дашборд</p>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Предпросмотр структуры страницы</p>
                </div>
                {sections.map((sectionId) => (
                  <div
                    key={sectionId}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.stopPropagation();
                      handleSectionDrop(sectionId);
                    }}
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelected(sectionId);
                    }}
                    className={`rounded-xl border bg-white dark:bg-zinc-900 ${selected === sectionId ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-zinc-200 dark:border-zinc-800'}`}
                  >
                    <div
                      draggable
                      onDragStart={(event) => {
                        event.stopPropagation();
                        setDraggedSection(sectionId);
                      }}
                      onDragEnd={() => setDraggedSection(null)}
                      className="flex cursor-grab items-center justify-between gap-2 border-b border-zinc-100 px-3 py-2 active:cursor-grabbing dark:border-zinc-800"
                    >
                      <span className="text-xs font-semibold">{sectionLabels[sectionId]}</span>
                      <span className="text-[10px] text-zinc-400">↕ секция</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 p-3">
                      {(sectionId === 'system'
                        ? ['Процессор', 'Память', 'Графика', 'Диск']
                        : sectionId === 'infrastructure'
                          ? ['Модели', 'Провайдеры', 'Агенты', 'Inference']
                          : sectionId === 'activity'
                            ? ['Проекты', 'Задачи', 'Процессы', 'Подключения']
                            : ['Статус системы', 'Журнал операций']
                      ).map((label, index) => (
                        <div key={label} className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-3 dark:border-zinc-800 dark:bg-zinc-950">
                          <p className="text-[10px] text-zinc-500 dark:text-zinc-400">{label}</p>
                          <p className="mt-2 text-sm font-semibold tabular-nums">{sectionId === 'attention' ? (index === 0 ? 'В норме' : 'Открыть') : ['8 ядер', '32 ГБ', '12 ГБ', '240 ГБ'][index]}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {windowId === 'inspector' && (
              <div className="space-y-3 p-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Выбранный элемент</p>
                  <p className="mt-1 text-sm font-semibold">{selected in sectionLabels ? sectionLabels[selected as SectionId] : windowLabels[selected as WindowId]}</p>
                </div>
                <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                  <p className="text-xs font-medium">Позиция в макете</p>
                  <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">Порядок окна: {windows.indexOf(selected as WindowId) + 1 || '—'}</p>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Порядок секции: {sections.indexOf(selected as SectionId) + 1 || '—'}</p>
                </div>
                <p className="text-[11px] leading-5 text-zinc-500 dark:text-zinc-400">Перемещение выполняется перетаскиванием. Настройки геометрии и сохранение будут подключены после утверждения контракта макета.</p>
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
