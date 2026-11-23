import { useState, type DragEvent } from 'react';
import type { NavigationLayoutConfig, NavigationLayoutGroup } from './types';

interface NavigationEditorProps {
  layout: NavigationLayoutConfig;
  dirty: boolean;
  saving: boolean;
  icons: string[];
  onChange: (layout: NavigationLayoutConfig) => void;
  onSave: () => void;
}

export function NavigationEditor({
  layout,
  dirty,
  saving,
  icons,
  onChange,
  onSave,
}: NavigationEditorProps) {
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [draggedGroupId, setDraggedGroupId] = useState<string | null>(null);

  const updateGroup = (groupId: string, patch: Partial<NavigationLayoutGroup>) => {
    onChange({
      ...layout,
      groups: layout.groups.map((group) => group.id === groupId ? { ...group, ...patch } : group),
    });
  };

  const updateItem = (itemId: string, patch: Partial<NavigationLayoutGroup['items'][number]>) => {
    onChange({
      ...layout,
      groups: layout.groups.map((group) => ({
        ...group,
        items: group.items.map((item) => item.id === itemId ? { ...item, ...patch } : item),
      })),
    });
  };

  const moveItem = (itemId: string, targetGroupId: string, requestedIndex: number) => {
    const groups = layout.groups.map((group) => ({ ...group, items: [...group.items] }));
    const sourceGroup = groups.find((group) => group.items.some((item) => item.id === itemId));
    const targetGroup = groups.find((group) => group.id === targetGroupId);
    if (!sourceGroup || !targetGroup) return;

    const sourceIndex = sourceGroup.items.findIndex((item) => item.id === itemId);
    const [item] = sourceGroup.items.splice(sourceIndex, 1);
    const targetIndex = sourceGroup.id === targetGroup.id && sourceIndex < requestedIndex
      ? requestedIndex - 1
      : requestedIndex;
    targetGroup.items.splice(Math.max(0, Math.min(targetIndex, targetGroup.items.length)), 0, item);
    onChange({ ...layout, groups });
  };

  const moveGroup = (groupId: string, targetGroupId: string) => {
    if (groupId === targetGroupId) return;
    const groups = [...layout.groups];
    const sourceIndex = groups.findIndex((group) => group.id === groupId);
    const targetIndex = groups.findIndex((group) => group.id === targetGroupId);
    if (sourceIndex < 0 || targetIndex < 0) return;
    const [group] = groups.splice(sourceIndex, 1);
    const insertionIndex = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex;
    groups.splice(insertionIndex, 0, group);
    onChange({ ...layout, groups });
  };

  const handleGroupDrop = (event: DragEvent<HTMLDivElement>, groupId: string) => {
    event.preventDefault();
    if (draggedGroupId) moveGroup(draggedGroupId, groupId);
    else if (draggedItemId) {
      const target = layout.groups.find((group) => group.id === groupId);
      if (target) moveItem(draggedItemId, groupId, target.items.length);
    }
    setDraggedGroupId(null);
    setDraggedItemId(null);
  };

  const addGroup = () => {
    const groupId = `custom-${crypto.randomUUID()}`;
    onChange({
      ...layout,
      groups: [...layout.groups, {
        id: groupId,
        label: 'Новая группа',
        icon: 'folder',
        items: [],
      }],
    });
  };

  const removeEmptyGroup = (groupId: string) => {
    onChange({
      ...layout,
      groups: layout.groups.filter((group) => group.id !== groupId),
    });
  };

  return (
    <section className="mt-6 border-t border-zinc-200 pt-5 dark:border-zinc-800">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Структура навигации</h3>
          <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
            Перетаскивайте пункты между группами, меняйте порядок, названия и иконки. Маршруты страниц остаются привязаны к реестру.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={addGroup}
            disabled={saving}
            className="h-8 rounded-lg border border-zinc-300 px-3 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Добавить группу
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={!dirty || saving}
            className="h-8 rounded-lg bg-blue-600 px-3 text-xs font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? 'Сохранение…' : 'Сохранить конфигурацию'}
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-2">
        {layout.groups.map((group) => (
          <div
            key={group.id}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => handleGroupDrop(event, group.id)}
            className="min-w-0 rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950"
          >
            <div className="flex items-center gap-2">
              <button
                type="button"
                draggable={!saving}
                disabled={saving}
                onDragStart={(event) => {
                  setDraggedGroupId(group.id);
                  event.dataTransfer.effectAllowed = 'move';
                }}
                onDragEnd={() => setDraggedGroupId(null)}
                className="h-8 shrink-0 cursor-grab rounded-md px-2 text-xs text-zinc-500 hover:bg-zinc-200 active:cursor-grabbing dark:hover:bg-zinc-800"
                aria-label={`Переместить группу ${group.label}`}
                title="Перетащить группу"
              >
                ⋮⋮
              </button>
              <input
                className="h-8 min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-2 text-xs font-semibold outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-900"
                value={group.label}
                disabled={saving}
                onChange={(event) => updateGroup(group.id, { label: event.target.value })}
                aria-label="Название группы"
                maxLength={80}
              />
              <select
                className="h-8 w-24 rounded-md border border-zinc-300 bg-white px-2 text-xs outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-900"
                value={group.icon}
                disabled={saving}
                onChange={(event) => updateGroup(group.id, { icon: event.target.value })}
                aria-label="Иконка группы"
              >
                {icons.map((icon) => <option key={icon} value={icon}>{icon}</option>)}
              </select>
              <button
                type="button"
                disabled={saving || group.items.length > 0 || layout.groups.length <= 1}
                onClick={() => removeEmptyGroup(group.id)}
                className="h-8 rounded-md border border-zinc-300 px-2 text-[10px] text-zinc-500 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-30 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                Удалить
              </button>
            </div>

            <div className="mt-3 min-h-12 space-y-2 rounded-lg border border-dashed border-zinc-300 p-2 dark:border-zinc-700">
              {group.items.map((item, index) => (
                <div
                  key={item.id}
                  draggable={!saving}
                  onDragStart={(event) => {
                    event.stopPropagation();
                    setDraggedItemId(item.id);
                    setDraggedGroupId(null);
                    event.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragEnd={() => setDraggedItemId(null)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (draggedItemId) moveItem(draggedItemId, group.id, index);
                    setDraggedItemId(null);
                  }}
                  className="flex min-w-0 items-center gap-2 rounded-md border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <span className="cursor-grab select-none text-xs text-zinc-400" title="Перетащить пункт">⋮⋮</span>
                  <input
                    className="h-7 min-w-0 flex-1 rounded border border-zinc-200 bg-transparent px-2 text-xs outline-none focus:border-blue-500 dark:border-zinc-700"
                    value={item.label}
                    disabled={saving}
                    onChange={(event) => updateItem(item.id, { label: event.target.value })}
                    aria-label={`Название пункта ${item.id}`}
                    maxLength={80}
                  />
                  <select
                    className="h-7 w-24 rounded border border-zinc-200 bg-transparent px-1 text-[10px] outline-none focus:border-blue-500 dark:border-zinc-700"
                    value={item.icon}
                    disabled={saving}
                    onChange={(event) => updateItem(item.id, { icon: event.target.value })}
                    aria-label={`Иконка пункта ${item.id}`}
                  >
                    {icons.map((icon) => <option key={icon} value={icon}>{icon}</option>)}
                  </select>
                  <label className="flex shrink-0 items-center gap-1 text-[10px] text-zinc-500 dark:text-zinc-400">
                    <input
                      type="checkbox"
                      checked={item.visible}
                      disabled={saving}
                      onChange={(event) => updateItem(item.id, { visible: event.target.checked })}
                    />
                    Видим
                  </label>
                </div>
              ))}
              {group.items.length === 0 && (
                <p className="py-2 text-center text-[10px] text-zinc-500 dark:text-zinc-500">
                  Перетащите сюда пункт навигации
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
