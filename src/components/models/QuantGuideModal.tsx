import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { HardwareProfile } from '../../types/onecore';

interface QuantGuideModalProps {
  open: boolean;
  onClose: () => void;
  hardwareProfile: HardwareProfile | null;
}

const QUANT_ROWS: Array<[string, string, string, string]> = [
  ['Q2_K', '2-битное K-квантование', 'Низкое', 'Очень маленький'],
  ['Q3_K_S', '3-битное, Small', 'Ниже среднего', 'Маленький'],
  ['Q3_K_M', '3-битное, Medium', 'Среднее', 'Небольшой'],
  ['Q3_K_L', '3-битное, Large', 'Выше Q3_K_M', 'Больше'],
  ['IQ4_XS', '4-битное i-quant (очень компактное)', 'Хорошее', 'Компактный'],
  ['Q4_K_S', '4-битное, Small', 'Хорошее', 'Средний'],
  ['Q4_K_M', '4-битное, Medium', 'Очень хорошее', 'Средний'],
  ['Q5_K_M', '5-битное, Medium', 'Очень высокое', 'Большой'],
  ['Q6_K', '6-битное K-квантование', 'Очень близко к исходному', 'Большой'],
  ['Q8_0', '8-битное квантование', 'Почти без потерь', 'Очень большой'],
  ['F16', '16-битная точность', 'Исходная точность FP16', 'Огромный'],
];

export const QuantGuideModal: React.FC<QuantGuideModalProps> = ({ open, onClose, hardwareProfile }) => {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-3 backdrop-blur-[2px] sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="quant-guide-title"
        className="flex max-h-[min(88vh,900px)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-950"
      >
        <header className="flex items-start justify-between gap-4 border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <div>
            <h2 id="quant-guide-title" className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Памятка по квантованию GGUF
            </h2>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Чем ниже разрядность, тем меньше файл и требования к памяти, но выше потери качества.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть памятку"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className="w-full min-w-[620px] text-left text-xs">
              <thead className="bg-zinc-50 text-[11px] font-semibold text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                <tr>
                  <th className="px-3 py-2.5">Тип</th>
                  <th className="px-3 py-2.5">Смысл</th>
                  <th className="px-3 py-2.5">Качество</th>
                  <th className="px-3 py-2.5">Размер</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {QUANT_ROWS.map(([type, meaning, quality, size]) => (
                  <tr key={type} className="text-zinc-700 dark:text-zinc-300">
                    <td className="whitespace-nowrap px-3 py-2.5 font-mono font-semibold text-zinc-900 dark:text-zinc-100">
                      {type}
                    </td>
                    <td className="px-3 py-2.5">{meaning}</td>
                    <td className="px-3 py-2.5">{quality}</td>
                    <td className="px-3 py-2.5">{size}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 dark:border-blue-900/70 dark:bg-blue-950/30">
            <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-200">Какой вариант выбрать</h3>
            <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-blue-900/90 dark:text-blue-100/90">
              <li>
                <strong>Q4_K_M</strong> — универсальная отправная точка: баланс качества, размера и скорости.
              </li>
              <li>
                <strong>Q5_K_M</strong> — выбирай, если после загрузки модели остаётся запас VRAM/RAM.
              </li>
              <li>
                <strong>Q6_K</strong> — когда качество важнее размера и памяти достаточно.
              </li>
              <li>
                <strong>Q3_K_M / Q3_K_L</strong> — компромисс для моделей, которые не помещаются в более качественной квантизации.
              </li>
              <li>
                <strong>Q8_0 / F16</strong> — обычно избыточны для видеокарт с 8 GB VRAM.
              </li>
            </ul>
            {hardwareProfile && (
              <p className="mt-3 border-t border-blue-200 pt-3 text-[11px] tabular-nums text-blue-800 dark:border-blue-900 dark:text-blue-200">
                Обнаружено: RAM {hardwareProfile.ram.totalGb} GB, VRAM {hardwareProfile.totalVramGb} GB.
                Фактическое потребление памяти выше размера файла GGUF из-за KV-кэша контекста и служебных буферов.
              </p>
            )}
          </div>
        </div>

        <footer className="flex justify-end border-t border-zinc-200 px-5 py-3 dark:border-zinc-800">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-lg bg-blue-600 px-4 text-xs font-medium text-white transition-colors hover:bg-blue-500"
          >
            Понятно
          </button>
        </footer>
      </section>
    </div>
  );

  if (typeof document === 'undefined') return modalContent;
  return createPortal(modalContent, document.body);
};
