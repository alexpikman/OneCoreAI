import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Flame, Lock, ShieldAlert, ShieldOff, X } from 'lucide-react';
import {
  GOD_PRO_BILINGUAL_WARNINGS,
  GOD_PRO_CONTROL_PHRASE,
} from '../../data/generalAgentModes';
import { useOneCoreStore } from '../../store/useOneCoreStore';

export const GodProWarningModal: React.FC = () => {
  const { godProModalOpen, closeGodProModal, activateGodProMode } = useOneCoreStore();
  const [stage, setStage] = useState<1 | 2 | 3>(1);
  const [stage1Accepted, setStage1Accepted] = useState(false);
  const [typedPhrase, setTypedPhrase] = useState('');
  const [pasteBlockedNotice, setPasteBlockedNotice] = useState(false);
  const [stage3WaiverAccepted, setStage3WaiverAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!godProModalOpen) {
      setStage(1);
      setStage1Accepted(false);
      setTypedPhrase('');
      setPasteBlockedNotice(false);
      setStage3WaiverAccepted(false);
      setSubmitting(false);
      setSubmitError(null);
    }
  }, [godProModalOpen]);

  if (!godProModalOpen || typeof document === 'undefined') {
    return null;
  }

  const handleClose = () => {
    if (submitting) return;
    closeGodProModal();
  };

  const handlePasteOrDropBlock = (event: React.ClipboardEvent | React.DragEvent) => {
    event.preventDefault();
    setPasteBlockedNotice(true);
  };

  const handleBeforeInput = (event: React.FormEvent<HTMLInputElement>) => {
    const nativeEvent = event.nativeEvent as InputEvent | undefined;
    if (
      nativeEvent?.inputType === 'insertFromPaste' ||
      nativeEvent?.inputType === 'insertFromDrop' ||
      (typeof nativeEvent?.data === 'string' && nativeEvent.data.length > 2)
    ) {
      event.preventDefault();
      setPasteBlockedNotice(true);
    }
  };

  const handlePhraseChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value;
    if (nextValue.length - typedPhrase.length > 2) {
      setPasteBlockedNotice(true);
      return;
    }
    setPasteBlockedNotice(false);
    setTypedPhrase(nextValue);
  };

  const phraseMatches = typedPhrase.trim() === GOD_PRO_CONTROL_PHRASE;

  const handleActivate = async () => {
    if (!stage1Accepted || !phraseMatches || !stage3WaiverAccepted || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    const result = await activateGodProMode({
      stage1Accepted,
      typedPhrase: typedPhrase.trim(),
      stage3WaiverAccepted,
    });
    setSubmitting(false);
    if (!result.ok) {
      setSubmitError(result.error || 'Не удалось активировать GodPro.');
    }
  };

  const modal = (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) handleClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="godpro-warning-title"
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border-2 border-rose-500 bg-zinc-950 text-zinc-100 shadow-[0_0_50px_rgba(244,63,94,0.45)]"
      >
        <header className="border-b-2 border-amber-500/70 bg-gradient-to-r from-rose-700 via-red-700 to-amber-600 px-5 py-4 text-white">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-300/60 bg-black/30 text-amber-200">
                <Flame className="h-5 w-5" />
              </div>
              <div>
                <div className="text-[10px] font-bold tracking-wider text-amber-100">
                  {stage === 1
                    ? `${GOD_PRO_BILINGUAL_WARNINGS.stage1.badgeRu} · ${GOD_PRO_BILINGUAL_WARNINGS.stage1.badgeEn}`
                    : stage === 2
                      ? `${GOD_PRO_BILINGUAL_WARNINGS.stage2.badgeRu} · ${GOD_PRO_BILINGUAL_WARNINGS.stage2.badgeEn}`
                      : `${GOD_PRO_BILINGUAL_WARNINGS.stage3.badgeRu} · ${GOD_PRO_BILINGUAL_WARNINGS.stage3.badgeEn}`}
                </div>
                <h2 id="godpro-warning-title" className="mt-1 text-base font-bold text-white">
                  {stage === 1
                    ? `${GOD_PRO_BILINGUAL_WARNINGS.stage1.titleRu} / ${GOD_PRO_BILINGUAL_WARNINGS.stage1.titleEn}`
                    : stage === 2
                      ? `${GOD_PRO_BILINGUAL_WARNINGS.stage2.titleRu} / ${GOD_PRO_BILINGUAL_WARNINGS.stage2.titleEn}`
                      : `${GOD_PRO_BILINGUAL_WARNINGS.stage3.titleRu} / ${GOD_PRO_BILINGUAL_WARNINGS.stage3.titleEn}`}
                </h2>
              </div>
            </div>
            <button
              type="button"
              onClick={handleClose}
              disabled={submitting}
              aria-label="Закрыть предупреждение GodPro"
              className="rounded-lg border border-white/25 bg-black/25 p-1.5 text-white transition hover:bg-black/45 disabled:opacity-50"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2 text-[10px] font-semibold">
            {[
              { id: 1, label: '1. Инфраструктура / Liability' },
              { id: 2, label: '2. Фраза / Manual Phrase' },
              { id: 3, label: '3. Отказ от претензий / Waiver' },
            ].map((item) => (
              <div
                key={item.id}
                className={
                  stage === item.id
                    ? 'rounded-lg border border-amber-200 bg-black/40 px-2.5 py-1.5 text-amber-100'
                    : stage > item.id
                      ? 'rounded-lg border border-emerald-300/60 bg-emerald-950/50 px-2.5 py-1.5 text-emerald-200'
                      : 'rounded-lg border border-white/20 bg-black/20 px-2.5 py-1.5 text-white/70'
                }
              >
                {item.label}
              </div>
            ))}
          </div>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          {stage === 1 && (
            <>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-rose-500/60 bg-rose-950/40 p-3.5 text-xs leading-relaxed text-rose-100">
                  <div className="mb-1.5 flex items-center gap-1.5 font-bold text-amber-300">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>RU · КРИТИЧЕСКОЕ ПРЕДУПРЕЖДЕНИЕ</span>
                  </div>
                  <p>{GOD_PRO_BILINGUAL_WARNINGS.stage1.bodyRu}</p>
                </div>
                <div className="rounded-xl border border-amber-500/60 bg-amber-950/35 p-3.5 text-xs leading-relaxed text-amber-100">
                  <div className="mb-1.5 flex items-center gap-1.5 font-bold text-rose-300">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>EN · CRITICAL WARNING</span>
                  </div>
                  <p>{GOD_PRO_BILINGUAL_WARNINGS.stage1.bodyEn}</p>
                </div>
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-amber-500/60 bg-zinc-900 p-3.5 text-xs">
                <input
                  type="checkbox"
                  checked={stage1Accepted}
                  onChange={(event) => setStage1Accepted(event.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-rose-500"
                />
                <span className="space-y-1">
                  <span className="block font-semibold text-white">
                    {GOD_PRO_BILINGUAL_WARNINGS.stage1.acceptCheckboxRu}
                  </span>
                  <span className="block text-zinc-300">
                    {GOD_PRO_BILINGUAL_WARNINGS.stage1.acceptCheckboxEn}
                  </span>
                </span>
              </label>
            </>
          )}

          {stage === 2 && (
            <>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-amber-500/50 bg-zinc-900 p-3.5 text-xs leading-relaxed text-zinc-200">
                  <div className="mb-1 flex items-center gap-1.5 font-bold text-amber-300">
                    <Lock className="h-3.5 w-3.5" />
                    <span>RU · Ручной ввод без вставки</span>
                  </div>
                  <p>{GOD_PRO_BILINGUAL_WARNINGS.stage2.bodyRu}</p>
                </div>
                <div className="rounded-xl border border-amber-500/50 bg-zinc-900 p-3.5 text-xs leading-relaxed text-zinc-200">
                  <div className="mb-1 flex items-center gap-1.5 font-bold text-amber-300">
                    <Lock className="h-3.5 w-3.5" />
                    <span>EN · Manual typing only (no paste)</span>
                  </div>
                  <p>{GOD_PRO_BILINGUAL_WARNINGS.stage2.bodyEn}</p>
                </div>
              </div>

              <div className="rounded-xl border-2 border-dashed border-amber-400 bg-amber-950/30 p-3.5 select-none">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                  Контрольная фраза / Control Phrase
                </div>
                <div className="mt-1.5 font-mono text-sm font-bold text-white select-none">
                  {GOD_PRO_CONTROL_PHRASE}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-200">
                  Введите контрольную фразу вручную / Type control phrase manually:
                </label>
                <input
                  type="text"
                  value={typedPhrase}
                  onChange={handlePhraseChange}
                  onBeforeInput={handleBeforeInput}
                  onPaste={handlePasteOrDropBlock}
                  onDrop={handlePasteOrDropBlock}
                  onCopy={(event) => event.preventDefault()}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={GOD_PRO_CONTROL_PHRASE}
                  className="mt-2 h-11 w-full rounded-xl border-2 border-zinc-700 bg-zinc-900 px-3.5 font-mono text-sm text-white outline-none focus:border-amber-400"
                />
                {pasteBlockedNotice && (
                  <div
                    role="alert"
                    className="mt-2 rounded-lg border border-rose-500 bg-rose-950/60 px-3 py-2 text-xs text-rose-200"
                  >
                    <div>{GOD_PRO_BILINGUAL_WARNINGS.stage2.pasteBlockedRu}</div>
                    <div>{GOD_PRO_BILINGUAL_WARNINGS.stage2.pasteBlockedEn}</div>
                  </div>
                )}
              </div>
            </>
          )}

          {stage === 3 && (
            <>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="rounded-xl border-2 border-rose-500 bg-rose-950/50 p-3.5 text-xs leading-relaxed text-rose-100">
                  <div className="mb-1.5 flex items-center gap-1.5 font-bold text-amber-300">
                    <ShieldAlert className="h-4 w-4 shrink-0" />
                    <span>RU · ОТКАЗ ОТ ОТВЕТСТВЕННОСТИ РАЗРАБОТЧИКА</span>
                  </div>
                  <p>{GOD_PRO_BILINGUAL_WARNINGS.stage3.bodyRu}</p>
                </div>
                <div className="rounded-xl border-2 border-amber-500 bg-amber-950/40 p-3.5 text-xs leading-relaxed text-amber-100">
                  <div className="mb-1.5 flex items-center gap-1.5 font-bold text-rose-300">
                    <ShieldOff className="h-4 w-4 shrink-0" />
                    <span>EN · DEVELOPER LIABILITY WAIVER</span>
                  </div>
                  <p>{GOD_PRO_BILINGUAL_WARNINGS.stage3.bodyEn}</p>
                </div>
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-xl border-2 border-rose-500/80 bg-zinc-900 p-3.5 text-xs">
                <input
                  type="checkbox"
                  checked={stage3WaiverAccepted}
                  onChange={(event) => setStage3WaiverAccepted(event.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-rose-500"
                />
                <span className="space-y-1">
                  <span className="block font-semibold text-white">
                    {GOD_PRO_BILINGUAL_WARNINGS.stage3.waiverCheckboxRu}
                  </span>
                  <span className="block text-zinc-300">
                    {GOD_PRO_BILINGUAL_WARNINGS.stage3.waiverCheckboxEn}
                  </span>
                </span>
              </label>

              {submitError && (
                <p role="alert" className="rounded-lg border border-rose-500 bg-rose-950/60 px-3 py-2 text-xs text-rose-200">
                  {submitError}
                </p>
              )}
            </>
          )}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-800 bg-zinc-900/90 px-5 py-3.5">
          <button
            type="button"
            onClick={stage === 1 ? handleClose : () => setStage((s) => (s === 3 ? 2 : 1))}
            disabled={submitting}
            className="h-9 rounded-lg border border-zinc-700 bg-zinc-800 px-3.5 text-xs font-medium text-zinc-200 transition hover:bg-zinc-700 disabled:opacity-50"
          >
            {stage === 1 ? 'Отмена / Cancel' : 'Назад / Back'}
          </button>

          {stage === 1 && (
            <button
              type="button"
              disabled={!stage1Accepted}
              onClick={() => setStage(2)}
              className="h-9 rounded-lg bg-amber-500 px-4 text-xs font-bold text-zinc-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Понял, продолжить (Этап 2) / Understand, Continue
            </button>
          )}

          {stage === 2 && (
            <button
              type="button"
              disabled={!phraseMatches}
              onClick={() => setStage(3)}
              className="h-9 rounded-lg bg-amber-500 px-4 text-xs font-bold text-zinc-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Понял, далее (Этап 3) / Phrase Verified, Next
            </button>
          )}

          {stage === 3 && (
            <button
              type="button"
              disabled={!stage3WaiverAccepted || submitting}
              onClick={() => void handleActivate()}
              className="h-9 rounded-lg bg-rose-600 px-4 text-xs font-bold text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting ? 'Активация… / Activating…' : 'Включить GodPro / Activate GodPro'}
            </button>
          )}
        </footer>
      </section>
    </div>
  );

  return createPortal(modal, document.body);
};
