import type { AppearancePalette, AppearanceTokens } from './types';

interface AppearanceEditorProps {
  tokens: AppearanceTokens;
  dirty: boolean;
  saving: boolean;
  previewing: boolean;
  onPreview: () => void;
  onClearPreview: () => void;
  onChange: (tokens: AppearanceTokens) => void;
  onSave: () => void;
}

const COLOR_FIELDS: Array<{ key: keyof AppearancePalette; label: string }> = [
  { key: 'background', label: 'Фон' },
  { key: 'surface', label: 'Поверхность' },
  { key: 'surfaceRaised', label: 'Поднятая поверхность' },
  { key: 'text', label: 'Основной текст' },
  { key: 'textMuted', label: 'Вторичный текст' },
  { key: 'border', label: 'Границы' },
  { key: 'accent', label: 'Акцент' },
  { key: 'accentHover', label: 'Акцент при наведении' },
  { key: 'danger', label: 'Ошибка' },
  { key: 'warning', label: 'Предупреждение' },
  { key: 'success', label: 'Успех' },
];

export function AppearanceEditor({
  tokens,
  dirty,
  saving,
  previewing,
  onPreview,
  onClearPreview,
  onChange,
  onSave,
}: AppearanceEditorProps) {
  const updateTypography = (patch: Partial<AppearanceTokens['typography']>) => {
    onChange({ ...tokens, typography: { ...tokens.typography, ...patch } });
  };
  const updateShape = (patch: Partial<AppearanceTokens['shape']>) => {
    onChange({ ...tokens, shape: { ...tokens.shape, ...patch } });
  };
  const updateOpacity = (patch: Partial<AppearanceTokens['opacity']>) => {
    onChange({ ...tokens, opacity: { ...tokens.opacity, ...patch } });
  };
  const updateColor = (mode: 'light' | 'dark', key: keyof AppearancePalette, value: string) => {
    onChange({
      ...tokens,
      colors: {
        ...tokens.colors,
        [mode]: { ...tokens.colors[mode], [key]: value },
      },
    });
  };

  return (
    <section className="mt-6 border-t border-zinc-200 pt-5 dark:border-zinc-800">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Оформление интерфейса</h3>
          <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
            Типографика, геометрия, отступы, прозрачность и отдельные палитры светлой и тёмной темы.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onPreview}
            disabled={saving}
            className="h-8 rounded-lg border border-zinc-300 px-3 text-xs font-medium hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Предпросмотр
          </button>
          {previewing && (
            <button
              type="button"
              onClick={onClearPreview}
              disabled={saving}
              className="h-8 rounded-lg border border-zinc-300 px-3 text-xs font-medium hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Сбросить предпросмотр
            </button>
          )}
          <button
            type="button"
            onClick={onSave}
            disabled={!dirty || saving}
            className="h-8 rounded-lg bg-blue-600 px-3 text-xs font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? 'Сохранение…' : 'Сохранить оформление'}
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <h4 className="text-xs font-semibold">Типографика</h4>
          <div className="mt-3 grid gap-3">
            <label className="grid gap-1 text-xs text-zinc-600 dark:text-zinc-300">
              Семейство шрифтов
              <select
                value={tokens.typography.fontFamily}
                disabled={saving}
                onChange={(event) => updateTypography({ fontFamily: event.target.value as AppearanceTokens['typography']['fontFamily'] })}
                className="h-9 rounded-lg border border-zinc-300 bg-white px-2 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              >
                <option value="manrope">Manrope</option>
                <option value="dm-mono">DM Mono</option>
                <option value="system">System UI</option>
              </select>
            </label>
            <label className="grid gap-2 text-xs text-zinc-600 dark:text-zinc-300">
              <span className="flex justify-between"><span>Базовый размер</span><strong>{tokens.typography.baseFontSizePx}px</strong></span>
              <input type="range" min={12} max={20} step={1} value={tokens.typography.baseFontSizePx} disabled={saving} onChange={(event) => updateTypography({ baseFontSizePx: Number(event.target.value) })} />
            </label>
            <label className="grid gap-2 text-xs text-zinc-600 dark:text-zinc-300">
              <span className="flex justify-between"><span>Масштаб межстрочного интервала</span><strong>{tokens.typography.lineHeightScale.toFixed(2)}</strong></span>
              <input type="range" min={0.8} max={1.2} step={0.05} value={tokens.typography.lineHeightScale} disabled={saving} onChange={(event) => updateTypography({ lineHeightScale: Number(event.target.value) })} />
            </label>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <h4 className="text-xs font-semibold">Геометрия и прозрачность</h4>
          <div className="mt-3 grid gap-3">
            {([
              ['radiusSmPx', 'Малый радиус', 0, 32, 1, 'px'],
              ['radiusMdPx', 'Средний радиус', 0, 32, 1, 'px'],
              ['radiusLgPx', 'Большой радиус', 0, 32, 1, 'px'],
              ['radiusXlPx', 'Радиус карточек', 0, 32, 1, 'px'],
              ['spacingScale', 'Масштаб отступов', 0.75, 1.5, 0.05, '×'],
            ] as const).map(([key, label, min, max, step, suffix]) => (
              <label key={key} className="grid gap-2 text-xs text-zinc-600 dark:text-zinc-300">
                <span className="flex justify-between"><span>{label}</span><strong>{tokens.shape[key].toFixed(key === 'spacingScale' ? 2 : 0)}{suffix}</strong></span>
                <input type="range" min={min} max={max} step={step} value={tokens.shape[key]} disabled={saving} onChange={(event) => updateShape({ [key]: Number(event.target.value) })} />
              </label>
            ))}
            {([
              ['panel', 'Прозрачность панелей', 0.5, 1],
              ['overlay', 'Прозрачность затемнения', 0.2, 0.9],
            ] as const).map(([key, label, min, max]) => (
              <label key={key} className="grid gap-2 text-xs text-zinc-600 dark:text-zinc-300">
                <span className="flex justify-between"><span>{label}</span><strong>{Math.round(tokens.opacity[key] * 100)}%</strong></span>
                <input type="range" min={min} max={max} step={0.01} value={tokens.opacity[key]} disabled={saving} onChange={(event) => updateOpacity({ [key]: Number(event.target.value) })} />
              </label>
            ))}
          </div>
        </div>
      </div>


      <div className="mt-4 grid gap-3 xl:grid-cols-2">
        <div data-ui-style="appearance-preview" className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-zinc-900 dark:border-zinc-700">
          <p className="mb-2 text-[11px] font-semibold">Предпросмотр — светлая тема</p>
          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <p className="text-sm font-semibold">Карточка интерфейса</p>
            <p className="mt-1 text-xs text-zinc-500">Текст, поверхность, граница и радиусы</p>
            <button type="button" className="mt-3 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white">Акцент</button>
          </div>
        </div>
        <div data-ui-style="appearance-preview" className="dark rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-zinc-100">
          <p className="mb-2 text-[11px] font-semibold">Предпросмотр — тёмная тема</p>
          <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-4">
            <p className="text-sm font-semibold">Карточка интерфейса</p>
            <p className="mt-1 text-xs text-zinc-400">Текст, поверхность, граница и радиусы</p>
            <button type="button" className="mt-3 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white">Акцент</button>
          </div>
        </div>
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        {(['light', 'dark'] as const).map((mode) => (
          <div key={mode} className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <h4 className="text-xs font-semibold">{mode === 'light' ? 'Светлая тема' : 'Тёмная тема'}</h4>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {COLOR_FIELDS.map(({ key, label }) => (
                <label key={key} className="flex min-w-0 items-center gap-2 text-[11px] text-zinc-600 dark:text-zinc-300">
                  <input
                    type="color"
                    value={tokens.colors[mode][key]}
                    disabled={saving}
                    onChange={(event) => updateColor(mode, key, event.target.value)}
                    className="h-8 w-9 shrink-0 cursor-pointer rounded border border-zinc-300 bg-transparent p-0.5 dark:border-zinc-700"
                  />
                  <span className="min-w-0 truncate">{label}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
