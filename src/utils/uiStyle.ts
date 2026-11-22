import type { UiStylePreset } from '../types/onecore';

export interface UiStyleTokens {
  id: UiStylePreset;
  label: string;
  subtitle: string;
  shellBg: string;
  pageSurface: string;
  headerBg: string;
  sidebarBg: string;
  cardBg: string;
  cardBorder: string;
  cardRadius: string;
  inputRadius: string;
  accentButton: string;
  activeHighlight: string;
  taskBannerBg: string;
  userBubbleBg: string;
  assistantBubbleBg: string;
  isMonoHeavy: boolean;
}

export const UI_STYLE_META: Record<UiStylePreset, UiStyleTokens> = {
  'cline-vscode': {
    id: 'cline-vscode',
    label: 'Clean Light',
    subtitle: 'Чистый светлый интерфейс с нейтральными поверхностями и аккуратными границами',
    shellBg: 'bg-zinc-100 text-zinc-900 dark:bg-[#18181B] dark:text-zinc-100',
    pageSurface: 'bg-zinc-100 dark:bg-[#18181B]',
    headerBg: 'bg-white dark:bg-[#1F1F23] border-zinc-200 dark:border-[#2C2C32]',
    sidebarBg: 'bg-zinc-50 dark:bg-[#18181B] border-zinc-200 dark:border-[#2C2C32]',
    cardBg: 'bg-white dark:bg-[#222227]',
    cardBorder: 'border-zinc-200 dark:border-[#32323A]',
    cardRadius: 'rounded-lg',
    inputRadius: 'rounded-lg',
    accentButton: 'bg-blue-600 hover:bg-blue-500 text-white',
    activeHighlight: 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400',
    taskBannerBg: 'bg-zinc-50 dark:bg-[#1E1E24] border-zinc-200 dark:border-[#2E2E36]',
    userBubbleBg: 'border-blue-500/30 bg-blue-50/70 dark:bg-[#1E2430]',
    assistantBubbleBg: 'border-zinc-200 dark:border-[#2E2E36] bg-white dark:bg-[#1F1F25]',
    isMonoHeavy: false,
  },
  'mica-windows': {
    id: 'mica-windows',
    label: 'Mica Blue',
    subtitle: 'Серо-голубой полупрозрачный фон, белые панели и мягкие скругления',
    shellBg: 'bg-[#F7FAFF] text-zinc-900 dark:bg-[#09090B] dark:text-zinc-100',
    pageSurface: 'bg-[#F7FAFF] dark:bg-[#09090B]',
    headerBg: 'bg-[#E8EEF5]/85 dark:bg-[#111114]/85 mica-panel border-transparent dark:border-zinc-800/90',
    sidebarBg: 'bg-white/75 dark:bg-[#0D0D10] border-slate-200/80 dark:border-zinc-800/90',
    cardBg: 'bg-white/90 dark:bg-[#111114]',
    cardBorder: 'border-slate-200/80 dark:border-zinc-800',
    cardRadius: 'rounded-xl',
    inputRadius: 'rounded-xl',
    accentButton: 'bg-blue-600 hover:bg-blue-500 text-white',
    activeHighlight: 'border-blue-500/50 bg-blue-500/10 text-blue-600 dark:text-blue-400',
    taskBannerBg: 'bg-white/65 dark:bg-[#111114]/90 border-slate-200/80 dark:border-zinc-800',
    userBubbleBg: 'border-slate-200 dark:border-zinc-800 bg-slate-50/80 dark:bg-zinc-900/50',
    assistantBubbleBg: 'border-slate-200/80 dark:border-zinc-800/80 bg-white/90 dark:bg-[#111114]',
    isMonoHeavy: false,
  },
  'cyber-terminal': {
    id: 'cyber-terminal',
    label: 'Cyber Terminal',
    subtitle: 'Тёмная техническая тема с изумрудным акцентом и моноширинной типографикой',
    shellBg: 'bg-zinc-100 text-zinc-900 dark:bg-[#050608] dark:text-zinc-100 font-mono',
    pageSurface: 'bg-zinc-100 dark:bg-[#050608]',
    headerBg: 'bg-white dark:bg-[#080A0D] border-zinc-300 dark:border-emerald-500/25',
    sidebarBg: 'bg-zinc-50 dark:bg-[#07090C] border-zinc-300 dark:border-emerald-500/20',
    cardBg: 'bg-white dark:bg-[#0A0D12]',
    cardBorder: 'border-zinc-300 dark:border-emerald-500/25',
    cardRadius: 'rounded-md',
    inputRadius: 'rounded-md',
    accentButton: 'bg-emerald-600 hover:bg-emerald-500 text-white',
    activeHighlight: 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    taskBannerBg: 'bg-zinc-50 dark:bg-[#090C10] border-zinc-300 dark:border-emerald-500/25',
    userBubbleBg: 'border-zinc-300 dark:border-emerald-500/30 bg-zinc-50 dark:bg-[#0C1216]',
    assistantBubbleBg: 'border-zinc-300 dark:border-zinc-800 bg-white dark:bg-[#080B0F]',
    isMonoHeavy: true,
  },
  lavender: {
    id: 'lavender',
    label: 'Lavender',
    subtitle: 'Светлая лавандовая палитра с мягкими фиолетовыми акцентами',
    shellBg: 'bg-[#F0ECF7] text-slate-900 dark:bg-[#17131F] dark:text-slate-100',
    pageSurface: 'bg-[#F0ECF7] dark:bg-[#17131F]',
    headerBg: 'bg-[#F8F5FC]/90 dark:bg-[#211B2B]/90 mica-panel border-[#E4DCEE] dark:border-[#393044]',
    sidebarBg: 'bg-white/80 dark:bg-[#1D1826] border-[#E4DCEE] dark:border-[#393044]',
    cardBg: 'bg-white/90 dark:bg-[#211B2B]',
    cardBorder: 'border-[#E4DCEE] dark:border-[#393044]',
    cardRadius: 'rounded-xl',
    inputRadius: 'rounded-lg',
    accentButton: 'bg-violet-600 hover:bg-violet-500 text-white',
    activeHighlight: 'border-violet-500/50 bg-violet-500/10 text-violet-700 dark:text-violet-300',
    taskBannerBg: 'bg-[#F8F5FC]/80 dark:bg-[#211B2B]/90 border-[#E4DCEE] dark:border-[#393044]',
    userBubbleBg: 'border-violet-200 bg-violet-50/80 dark:border-violet-900 dark:bg-violet-950/30',
    assistantBubbleBg: 'border-[#E4DCEE] bg-white/90 dark:border-[#393044] dark:bg-[#211B2B]',
    isMonoHeavy: false,
  },
  sage: {
    id: 'sage',
    label: 'Sage',
    subtitle: 'Спокойные зелёно-серые оттенки с деликатными природными акцентами',
    shellBg: 'bg-[#EAF0EB] text-slate-900 dark:bg-[#111A16] dark:text-slate-100',
    pageSurface: 'bg-[#EAF0EB] dark:bg-[#111A16]',
    headerBg: 'bg-[#F2F6F2]/90 dark:bg-[#18231D]/90 mica-panel border-[#D8E3D9] dark:border-[#2D4034]',
    sidebarBg: 'bg-white/80 dark:bg-[#17211B] border-[#D8E3D9] dark:border-[#2D4034]',
    cardBg: 'bg-white/90 dark:bg-[#18231D]',
    cardBorder: 'border-[#D8E3D9] dark:border-[#2D4034]',
    cardRadius: 'rounded-xl',
    inputRadius: 'rounded-lg',
    accentButton: 'bg-emerald-700 hover:bg-emerald-600 text-white',
    activeHighlight: 'border-emerald-600/50 bg-emerald-600/10 text-emerald-800 dark:text-emerald-300',
    taskBannerBg: 'bg-[#F2F6F2]/80 dark:bg-[#18231D]/90 border-[#D8E3D9] dark:border-[#2D4034]',
    userBubbleBg: 'border-emerald-200 bg-emerald-50/80 dark:border-emerald-900 dark:bg-emerald-950/30',
    assistantBubbleBg: 'border-[#D8E3D9] bg-white/90 dark:border-[#2D4034] dark:bg-[#18231D]',
    isMonoHeavy: false,
  },
  'warm-sand': {
    id: 'warm-sand',
    label: 'Warm Sand',
    subtitle: 'Тёплый песочный фон, светлые поверхности и спокойные терракотовые акценты',
    shellBg: 'bg-[#F1EAE0] text-[#332D27] dark:bg-[#1C1916] dark:text-[#F2ECE5]',
    pageSurface: 'bg-[#F1EAE0] dark:bg-[#1C1916]',
    headerBg: 'bg-[#FAF6F0]/90 dark:bg-[#27211C]/90 mica-panel border-[#E5D9CA] dark:border-[#40352B]',
    sidebarBg: 'bg-white/80 dark:bg-[#211C18] border-[#E5D9CA] dark:border-[#40352B]',
    cardBg: 'bg-white/90 dark:bg-[#27211C]',
    cardBorder: 'border-[#E5D9CA] dark:border-[#40352B]',
    cardRadius: 'rounded-xl',
    inputRadius: 'rounded-lg',
    accentButton: 'bg-amber-700 hover:bg-amber-600 text-white',
    activeHighlight: 'border-amber-600/50 bg-amber-600/10 text-amber-800 dark:text-amber-300',
    taskBannerBg: 'bg-[#FAF6F0]/80 dark:bg-[#27211C]/90 border-[#E5D9CA] dark:border-[#40352B]',
    userBubbleBg: 'border-amber-200 bg-amber-50/80 dark:border-amber-900 dark:bg-amber-950/30',
    assistantBubbleBg: 'border-[#E5D9CA] bg-white/90 dark:border-[#40352B] dark:bg-[#27211C]',
    isMonoHeavy: false,
  },
};

export function getUiTokens(style: UiStylePreset): UiStyleTokens {
  return UI_STYLE_META[style] ?? UI_STYLE_META['mica-windows'];
}


/** Stable geometry for non-chat application pages; theme presets may change colors only. */
export function getPageUiTokens(style: UiStylePreset): UiStyleTokens {
  return {
    ...getUiTokens(style),
    cardRadius: 'rounded-xl',
    inputRadius: 'rounded-lg',
    isMonoHeavy: false,
  };
}

/** Shared Tailwind tokens for every page in AI-ресурсы. */
export const AI_RESOURCE_STYLES = {
  page: 'min-w-0',
  panel: 'rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950/40',
  panelMuted: 'rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50',
  panelHeader: 'border-b border-zinc-200 px-4 py-3 text-sm font-semibold text-zinc-900 dark:border-zinc-800 dark:text-zinc-100',
  title: 'text-sm font-semibold text-zinc-900 dark:text-zinc-100',
  description: 'text-xs text-zinc-500 dark:text-zinc-400',
  label: 'text-xs font-medium text-zinc-600 dark:text-zinc-400',
  input: 'h-9 rounded-lg border border-zinc-200 bg-white px-3 text-xs text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100',
  primaryButton: 'inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50',
  secondaryButton: 'inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800',
  tableHeader: 'bg-zinc-50 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:bg-zinc-900/70 dark:text-zinc-400',
  tableRow: 'border-t border-zinc-100 text-xs text-zinc-700 dark:border-zinc-800 dark:text-zinc-300',
} as const;
