export const StartupScreen = () => (
  <main className="flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-[#F7FAFF] px-6 text-center text-slate-800 dark:bg-slate-950 dark:text-slate-100">
    <div className="flex flex-col items-center">
      <div className="mb-7 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-300">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="2" />
            <circle cx="12" cy="12" r="2.5" fill="currentColor" />
            <path d="M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </span>
        <span className="text-sm font-bold tracking-[0.16em]">ONE CORE AI</span>
      </div>

      <div className="relative mb-7 flex h-36 w-36 items-center justify-center" role="status" aria-label="Загрузка ONE CORE AI">
        <div className="absolute inset-5 rounded-full bg-blue-200/50 blur-2xl dark:bg-blue-500/15" />
        <div className="absolute h-24 w-24 rounded-full border-2 border-sky-300/70 animate-ping motion-reduce:animate-none dark:border-sky-500/50" />
        <div className="absolute h-24 w-24 rounded-full border border-blue-300/60 animate-ping [animation-delay:900ms] motion-reduce:animate-none dark:border-blue-500/40" />
        <svg viewBox="0 0 120 120" className="relative z-10 h-28 w-28 drop-shadow-[0_8px_18px_rgba(59,130,246,0.18)]" aria-hidden="true">
          <path d="M60 17v10" stroke="#3989D6" strokeWidth="5" strokeLinecap="round" />
          <circle cx="60" cy="14" r="6" fill="#60A5FA" stroke="#2879C8" strokeWidth="3" />
          <rect x="13" y="49" width="15" height="25" rx="7.5" fill="#9CCCF4" stroke="#3989D6" strokeWidth="3" />
          <rect x="92" y="49" width="15" height="25" rx="7.5" fill="#9CCCF4" stroke="#3989D6" strokeWidth="3" />
          <rect x="25" y="29" width="70" height="68" rx="23" fill="#EAF5FF" stroke="#3989D6" strokeWidth="4" />
          <rect x="34" y="39" width="52" height="43" rx="15" fill="#D5EBFF" />
          <circle cx="48" cy="58" r="5" fill="#2469A8" />
          <circle cx="72" cy="58" r="5" fill="#2469A8" />
          <path d="M48 72q12 11 24 0" fill="none" stroke="#2469A8" strokeWidth="4" strokeLinecap="round" />
          <circle cx="60" cy="88" r="4" fill="#60A5FA" />
        </svg>
      </div>

      <h1 className="text-lg font-semibold tracking-tight">Запускаем ONE CORE AI</h1>
      <p className="mt-2 max-w-xs text-sm leading-6 text-slate-500 dark:text-slate-400">
        Подготавливаем рабочее пространство
      </p>
      <div className="relative mt-7 h-1.5 w-52 overflow-hidden rounded-full bg-blue-100 dark:bg-slate-800" role="progressbar" aria-label="Загрузка приложения" aria-valuetext="Загрузка продолжается">
        <div className="startup-progress absolute inset-y-0 left-0 w-1/3 rounded-full bg-gradient-to-r from-sky-400 via-blue-500 to-sky-400 dark:from-sky-400 dark:via-blue-400 dark:to-sky-400" />
      </div>
      <span className="mt-3 text-[11px] font-medium tracking-wide text-slate-400 dark:text-slate-500">ИНИЦИАЛИЗАЦИЯ СИСТЕМЫ</span>
    </div>
  </main>
);
