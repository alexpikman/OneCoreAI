import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  Bot,
  Brain,
  Check,
  CheckCircle2,
  Container,
  Copy,
  Download,
  ExternalLink,
  Laptop,
  Loader2,
  MessageCircle,
  Play,
  Plus,
  RefreshCw,
  Server,
  Sparkles,
  Trash2,
  XCircle,
} from 'lucide-react';
import { buildGatewayStartScript } from '../../data/oneCoreSeed';
import { useOneCoreStore } from '../../store/useOneCoreStore';
import type {
  AgentMemoryKey,
  AgentSkill,
  ExecutionEnvKind,
  GatewayPlatform,
  FreeProviderKind,
  SettingsSectionId,
} from '../../types/onecore';
import { cn } from '../../utils/cn';
import { getUiTokens } from '../../utils/uiStyle';

interface Props {
  section: SettingsSectionId;
}

const PROVIDER_LINKS: Partial<Record<FreeProviderKind, { label: string; url: string }>> = {
  'deepseek-api': {
    label: 'Р’РѕР№С‚Рё Рё РїРѕР»СѓС‡РёС‚СЊ API-РєР»СЋС‡',
    url: 'https://platform.deepseek.com/api_keys',
  },
  'qwen-api': {
    label: 'Р’РѕР№С‚Рё Рё РїРѕР»СѓС‡РёС‚СЊ API-РєР»СЋС‡',
    url: 'https://bailian.console.aliyun.com/?tab=model#/api-key',
  },
  'openai-api': {
    label: 'Р’РѕР№С‚Рё Рё РїРѕР»СѓС‡РёС‚СЊ API-РєР»СЋС‡',
    url: 'https://platform.openai.com/api-keys',
  },
  'openrouter-free': {
    label: 'Р’РѕР№С‚Рё Рё РїРѕР»СѓС‡РёС‚СЊ API-РєР»СЋС‡',
    url: 'https://openrouter.ai/keys',
  },
  'groq-free': {
    label: 'Р’РѕР№С‚Рё Рё РїРѕР»СѓС‡РёС‚СЊ API-РєР»СЋС‡',
    url: 'https://console.groq.com/keys',
  },
  'llama-cpp': {
    label: 'РћС‚РєСЂС‹С‚СЊ СЃС‚СЂР°РЅРёС†Сѓ РїСЂРѕРµРєС‚Р°',
    url: 'https://github.com/ggml-org/llama.cpp/releases',
  },
  ollama: {
    label: 'РћС‚РєСЂС‹С‚СЊ СЃР°Р№С‚ Ollama',
    url: 'https://ollama.com/download',
  },
  lmstudio: {
    label: 'РћС‚РєСЂС‹С‚СЊ СЃР°Р№С‚ LM Studio',
    url: 'https://lmstudio.ai/',
  },
};

export const OneCoreSettingsSections: React.FC<Props> = ({ section }) => {
  const {
    uiStyle,
    freeProviders,
    activeProviderId,
    setActiveProvider,
    updateFreeProvider,
    fetchProviderModels,
    skills,
    toggleSkill,
    addSkill,
    updateSkill,
    deleteSkill,
    memoryDocs,
    updateMemoryDoc,
    subagentConfig,
    updateSubagentConfig,
    subagentRuns,
    launchSubagent,
    roles,
    executionEnv,
    setActiveExecutionEnv,
    updateExecutionEnv,
    sshHosts,
    gateways,
    updateGateway,
    verifyTelegramGateway,
    openSettingsSection,
  } = useOneCoreStore();

  const tokens = getUiTokens(uiStyle);
  const activeProvider = freeProviders.find((p) => p.id === activeProviderId) ?? freeProviders[0];

  // Local UI states for editors
  const [newSkillOpen, setNewSkillOpen] = useState(false);
  const [skillTitle, setSkillTitle] = useState('');
  const [skillCategory, setSkillCategory] = useState<AgentSkill['category']>('Р Р°Р·СЂР°Р±РѕС‚РєР°');
  const [skillTrigger, setSkillTrigger] = useState('');
  const [skillBody, setSkillBody] = useState('');
  const [selectedSkillId, setSelectedSkillId] = useState<string>(skills[0]?.id ?? '');
  const [activeMemKey, setActiveMemKey] = useState<AgentMemoryKey>('soul');
  const [subagentTaskInput, setSubagentTaskInput] = useState('');
  const [activeGatewayId, setActiveGatewayId] = useState<GatewayPlatform>('telegram');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const selectedSkill = skills.find((s) => s.id === selectedSkillId) ?? skills[0];
  const activeMemoryDoc = memoryDocs.find((m) => m.key === activeMemKey) ?? memoryDocs[0];
  const activeGateway = gateways.find((g) => g.id === activeGatewayId) ?? gateways[0];

  const gatewayScript = useMemo(
    () => buildGatewayStartScript(gateways, activeProvider, executionEnv),
    [gateways, activeProvider, executionEnv],
  );

  const copyText = (id: string, value: string) => {
    navigator.clipboard?.writeText(value);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const downloadFile = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCreateSkill = (e: React.FormEvent) => {
    e.preventDefault();
    if (!skillTitle.trim()) return;
    addSkill({
      title: skillTitle,
      category: skillCategory,
      triggerHint: skillTrigger || 'РђРєС‚РёРІРёСЂСѓРµС‚СЃСЏ РїСЂРё СЃРѕРІРїР°РґРµРЅРёРё РєРѕРЅС‚РµРєСЃС‚Р° Р·Р°РґР°С‡Рё',
      contentMarkdown:
        skillBody.trim() ||
        `---\nname: ${skillTitle.toLowerCase().replace(/[^a-z0-9]+/gi, '-')}\n---\nРРЅСЃС‚СЂСѓРєС†РёСЏ РЅР°РІС‹РєР°: ${skillTitle}`,
      source: 'custom',
    });
    setSkillTitle('');
    setSkillTrigger('');
    setSkillBody('');
    setNewSkillOpen(false);
  };

  if (section === 'providers') {
    return (
      <div className="max-w-5xl mx-auto px-6 py-6 space-y-5">
        <div className={cn('p-5 border space-y-4', tokens.cardRadius, tokens.cardBg, tokens.cardBorder)}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-lg font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-500" />
                <span>РџСЂРѕРІР°Р№РґРµСЂС‹ РР (OneCore Multi-Provider)</span>
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Р›РѕРєР°Р»СЊРЅС‹Рµ РјРѕРґРµР»Рё Рё РѕР±Р»Р°С‡РЅС‹Рµ API. Р”Р»СЏ РѕР±Р»Р°С‡РЅС‹С… РїСЂРѕРІР°Р№РґРµСЂРѕРІ РїРѕРЅР°РґРѕР±РёС‚СЃСЏ РёС… API-РєР»СЋС‡; С‚Р°СЂРёС„С‹ Рё РІРѕР·РјРѕР¶РЅР°СЏ РѕРїР»Р°С‚Р° Р·Р°РІРёСЃСЏС‚ РѕС‚ РїСЂРѕРІР°Р№РґРµСЂР°.
              </p>
            </div>
            <div className="text-xs font-mono text-emerald-600 dark:text-emerald-400 shrink-0">
              РђРєС‚РёРІРµРЅ: {activeProvider.name}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {freeProviders.map((prov) => {
              const isActive = prov.id === activeProviderId;
              const providerLink = PROVIDER_LINKS[prov.kind];
              return (
                <div
                  key={prov.id}
                  className={cn(
                    'p-4 border space-y-3 transition-colors',
                    tokens.cardRadius,
                    isActive
                      ? tokens.activeHighlight
                      : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/60',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                        {prov.name}
                      </div>
                      <div className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 mt-0.5">
                        {prov.badgeText}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveProvider(prov.id)}
                      className={cn(
                        'h-7 px-2.5 text-[11px] font-medium border transition-colors shrink-0',
                        tokens.inputRadius,
                        isActive
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : 'border-zinc-300 dark:border-zinc-700 hover:bg-zinc-200/70 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200',
                      )}
                    >
                      {isActive ? 'Р’С‹Р±СЂР°РЅ' : 'Р’С‹Р±СЂР°С‚СЊ'}
                    </button>
                  </div>

                  <p className="text-[11.5px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    {prov.description}
                  </p>

                  {providerLink ? (
                    <a
                      href={providerLink.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {providerLink.label}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : prov.kind === 'custom' ? (
                    <p className="text-[11px] text-zinc-500">
                      Р”Р»СЏ СЃРѕР±СЃС‚РІРµРЅРЅРѕРіРѕ СЃРµСЂРІРµСЂР° СЃС‚СЂР°РЅРёС†Р° РєР»СЋС‡РµР№ Р·Р°РІРёСЃРёС‚ РѕС‚ РµРіРѕ РїРѕСЃС‚Р°РІС‰РёРєР°.
                    </p>
                  ) : null}

                  <div className="space-y-2">
                    <div>
                      <label className="block text-[10.5px] text-zinc-500 mb-1">Base URL (OpenAI-compatible)</label>
                      <input
                        type="text"
                        value={prov.baseUrl}
                        onChange={(e) => updateFreeProvider(prov.id, { baseUrl: e.target.value })}
                        className={cn('w-full h-8 px-2.5 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 font-mono text-[11px] text-zinc-900 dark:text-zinc-100', tokens.inputRadius)}
                      />
                    </div>

                    {prov.requiresKey && (
                      <div>
                        <label className="block text-[10.5px] text-zinc-500 mb-1">
                          {prov.kind === 'custom'
                            ? 'API-РєР»СЋС‡ (РµСЃР»Рё С‚СЂРµР±СѓРµС‚СЃСЏ)'
                            : 'API-РєР»СЋС‡ РїСЂРѕРІР°Р№РґРµСЂР°'}
                        </label>
                        <input
                          type="password"
                          value={prov.apiKey}
                          onChange={(e) => updateFreeProvider(prov.id, { apiKey: e.target.value })}
                          placeholder={
                            prov.kind === 'openrouter-free'
                              ? 'sk-or-v1-...'
                              : prov.kind === 'groq-free'
                                ? 'gsk_...'
                                : 'API-РєР»СЋС‡ РїСЂРѕРІР°Р№РґРµСЂР°'
                          }
                          className={cn('w-full h-8 px-2.5 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 font-mono text-[11px] text-zinc-900 dark:text-zinc-100', tokens.inputRadius)}
                        />
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10.5px] text-zinc-500 mb-1">РњРѕРґРµР»СЊ РёР· СЃРїРёСЃРєР°</label>
                        <select
                          value={prov.selectedModel}
                          onChange={(e) => updateFreeProvider(prov.id, { selectedModel: e.target.value })}
                          className={cn('w-full h-8 px-2 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 font-mono text-[11px] text-zinc-900 dark:text-zinc-100', tokens.inputRadius)}
                        >
                          {prov.availableModels.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-end">
                        <button
                          type="button"
                          onClick={() => fetchProviderModels(prov.id)}
                          disabled={prov.status === 'checking'}
                          className={cn('w-full h-8 px-2.5 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-[11px] font-medium text-zinc-800 dark:text-zinc-200 inline-flex items-center justify-center gap-1.5', tokens.inputRadius)}
                        >
                          {prov.status === 'checking' ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <RefreshCw className="w-3 h-3" />
                          )}
                          <span>Р—Р°РіСЂСѓР·РёС‚СЊ РјРѕРґРµР»Рё</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {prov.lastCheckMessage && (
                    <div
                      className={cn(
                        'text-[11px] flex items-center gap-1.5 font-mono',
                        prov.status === 'connected'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : prov.status === 'error'
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-zinc-500',
                      )}
                    >
                      {prov.status === 'connected' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      ) : prov.status === 'error' ? (
                        <XCircle className="w-3.5 h-3.5 shrink-0" />
                      ) : null}
                      <span className="truncate">{prov.lastCheckMessage}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  if (section === 'skills-memory') {
    return (
      <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">
        {/* Skills Library */}
        <div className={cn('p-5 border space-y-4', tokens.cardRadius, tokens.cardBg, tokens.cardBorder)}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-base font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-blue-500" />
                <span>РЎР°РјРѕРѕР±СѓС‡Р°СЋС‰РёРµСЃСЏ РЅР°РІС‹РєРё SKILL.md (agentskills.io)</span>
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Р‘РµР·Р»РёРјРёС‚РЅР°СЏ Р±РёР±Р»РёРѕС‚РµРєР° РЅР°РІС‹РєРѕРІ: Р°РіРµРЅС‚ РёСЃРїРѕР»СЊР·СѓРµС‚ Р°РєС‚РёРІРЅС‹Рµ РЅР°РІС‹РєРё Рё СѓРјРµРµС‚ СЃРѕС…СЂР°РЅСЏС‚СЊ РЅРѕРІС‹Рµ РїСЂСЏРјРѕ РёР· С‡Р°С‚Р°.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setNewSkillOpen((v) => !v)}
              className={cn('h-8 px-3 text-xs font-medium inline-flex items-center gap-1.5 shrink-0', tokens.inputRadius, tokens.accentButton)}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>РЎРѕР·РґР°С‚СЊ РЅР°РІС‹Рє</span>
            </button>
          </div>

          {newSkillOpen && (
            <form onSubmit={handleCreateSkill} className={cn('p-4 border border-blue-500/30 bg-blue-500/5 space-y-3', tokens.cardRadius)}>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  required
                  value={skillTitle}
                  onChange={(e) => setSkillTitle(e.target.value)}
                  placeholder="РќР°Р·РІР°РЅРёРµ РЅР°РІС‹РєР°..."
                  className={cn('sm:col-span-2 h-8 px-2.5 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs', tokens.inputRadius)}
                />
                <select
                  value={skillCategory}
                  onChange={(e) => setSkillCategory(e.target.value as AgentSkill['category'])}
                  className={cn('h-8 px-2 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs', tokens.inputRadius)}
                >
                  <option value="Р Р°Р·СЂР°Р±РѕС‚РєР°">Р Р°Р·СЂР°Р±РѕС‚РєР°</option>
                  <option value="DevOps">DevOps</option>
                  <option value="РСЃСЃР»РµРґРѕРІР°РЅРёРµ">РСЃСЃР»РµРґРѕРІР°РЅРёРµ</option>
                  <option value="РђРІС‚РѕРјР°С‚РёР·Р°С†РёСЏ">РђРІС‚РѕРјР°С‚РёР·Р°С†РёСЏ</option>
                </select>
              </div>
              <input
                type="text"
                value={skillTrigger}
                onChange={(e) => setSkillTrigger(e.target.value)}
                placeholder="РљРѕРіРґР° РїСЂРёРјРµРЅСЏС‚СЊ (С‚СЂРёРіРіРµСЂ)..."
                className={cn('w-full h-8 px-2.5 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs', tokens.inputRadius)}
              />
              <textarea
                rows={4}
                value={skillBody}
                onChange={(e) => setSkillBody(e.target.value)}
                placeholder="Markdown-РёРЅСЃС‚СЂСѓРєС†РёСЏ SKILL.md..."
                className={cn('w-full p-2.5 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 font-mono text-xs', tokens.inputRadius)}
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setNewSkillOpen(false)}
                  className={cn('h-8 px-3 border border-zinc-200 dark:border-zinc-800 text-xs', tokens.inputRadius)}
                >
                  РћС‚РјРµРЅР°
                </button>
                <button type="submit" className={cn('h-8 px-3 text-xs font-medium', tokens.inputRadius, tokens.accentButton)}>
                  РЎРѕС…СЂР°РЅРёС‚СЊ РІ Р±РёР±Р»РёРѕС‚РµРєСѓ
                </button>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-5 space-y-2 max-h-80 overflow-y-auto pr-1">
              {skills.map((sk) => (
                <div
                  key={sk.id}
                  onClick={() => setSelectedSkillId(sk.id)}
                  className={cn(
                    'p-3 border cursor-pointer flex items-start justify-between gap-2 transition-colors',
                    tokens.cardRadius,
                    selectedSkill?.id === sk.id
                      ? tokens.activeHighlight
                      : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950/50',
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                      {sk.title}
                    </div>
                    <div className="text-[11px] font-mono text-zinc-500 mt-0.5 tabular-nums">
                      {sk.category} В· {sk.usageCount}x В· {sk.source}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={sk.enabled}
                      onChange={() => toggleSkill(sk.id)}
                      className="accent-blue-600"
                    />
                    {sk.source !== 'builtin' && (
                      <button
                        type="button"
                        onClick={() => deleteSkill(sk.id)}
                        className="p-1 text-zinc-400 hover:text-rose-500"
                        title="РЈРґР°Р»РёС‚СЊ РЅР°РІС‹Рє"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {selectedSkill && (
              <div className="lg:col-span-7 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono text-zinc-500">{selectedSkill.slug}/SKILL.md</span>
                  <span className="text-[11px] text-zinc-500">{selectedSkill.triggerHint}</span>
                </div>
                <textarea
                  rows={10}
                  value={selectedSkill.contentMarkdown}
                  onChange={(e) => updateSkill(selectedSkill.id, { contentMarkdown: e.target.value })}
                  className={cn('w-full p-3 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 font-mono text-xs leading-relaxed text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-blue-500', tokens.inputRadius)}
                />
              </div>
            )}
          </div>
        </div>

        {/* 3-Layer Persistent Memory */}
        <div className={cn('p-5 border space-y-4', tokens.cardRadius, tokens.cardBg, tokens.cardBorder)}>
          <div>
            <h2 className="font-display text-base font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Brain className="w-4 h-4 text-emerald-500" />
              <span>РўСЂС‘С…СЃР»РѕР№РЅР°СЏ РїР°РјСЏС‚СЊ OneCore (SOUL.md / MEMORY.md / USER.md)</span>
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              РЎРѕС…СЂР°РЅСЏРµС‚СЃСЏ РјРµР¶РґСѓ РІСЃРµРјРё СЃРµСЃСЃРёСЏРјРё Рё Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё РїРµСЂРµРґР°С‘С‚СЃСЏ РєР°Рє СЃРёСЃС‚РµРјРЅС‹Р№ РєРѕРЅС‚РµРєСЃС‚.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {memoryDocs.map((doc) => (
              <button
                key={doc.key}
                type="button"
                onClick={() => setActiveMemKey(doc.key)}
                className={cn(
                  'px-3 py-1.5 border font-mono text-xs transition-colors',
                  tokens.inputRadius,
                  activeMemKey === doc.key
                    ? tokens.activeHighlight
                    : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400',
                )}
              >
                {doc.filename} В· {doc.title}
              </button>
            ))}
          </div>

          {activeMemoryDoc && (
            <textarea
              rows={7}
              value={activeMemoryDoc.content}
              onChange={(e) => updateMemoryDoc(activeMemoryDoc.key, e.target.value)}
              className={cn('w-full p-3 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 font-mono text-xs leading-relaxed text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500', tokens.inputRadius)}
            />
          )}
        </div>

        {/* Subagents Delegation Settings */}
        <div className={cn('p-5 border space-y-4', tokens.cardRadius, tokens.cardBg, tokens.cardBorder)}>
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-base font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Bot className="w-4 h-4 text-blue-500" />
                <span>РЎСѓР±Р°РіРµРЅС‚С‹ Рё РїР°СЂР°Р»Р»РµР»СЊРЅРѕРµ РґРµР»РµРіРёСЂРѕРІР°РЅРёРµ</span>
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                РР·РѕР»РёСЂРѕРІР°РЅРЅС‹Рµ РІРѕСЂРєРµСЂС‹ Р±РµР· Р»РёРјРёС‚РѕРІ: РІС‹Р±РµСЂРёС‚Рµ СЂРѕР»СЊ Рё Р±РµСЃРїР»Р°С‚РЅРѕРіРѕ РїСЂРѕРІР°Р№РґРµСЂР° РїРѕ СѓРјРѕР»С‡Р°РЅРёСЋ.
              </p>
            </div>
            <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={subagentConfig.enabled}
                onChange={(e) => updateSubagentConfig({ enabled: e.target.checked })}
                className="accent-blue-600"
              />
              <span>Р’РєР»СЋС‡РµРЅРѕ</span>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] text-zinc-500 mb-1">РџР°СЂР°Р»Р»РµР»СЊРЅС‹С… РІРѕСЂРєРµСЂРѕРІ</label>
              <input
                type="number"
                min={1}
                max={32}
                value={subagentConfig.maxParallel}
                onChange={(e) =>
                  updateSubagentConfig({ maxParallel: Math.max(1, Number(e.target.value) || 4) })
                }
                className={cn('w-full h-9 px-3 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 font-mono text-xs tabular-nums', tokens.inputRadius)}
              />
            </div>
            <div>
              <label className="block text-[11px] text-zinc-500 mb-1">Р›РёРјРёС‚ С€Р°РіРѕРІ (РёС‚РµСЂР°С†РёР№)</label>
              <input
                type="number"
                min={1}
                max={100}
                value={subagentConfig.maxIterations}
                onChange={(e) =>
                  updateSubagentConfig({ maxIterations: Math.max(1, Number(e.target.value) || 12) })
                }
                className={cn('w-full h-9 px-3 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 font-mono text-xs tabular-nums', tokens.inputRadius)}
              />
            </div>
            <div>
              <label className="block text-[11px] text-zinc-500 mb-1">Р РѕР»СЊ РїРѕ СѓРјРѕР»С‡Р°РЅРёСЋ</label>
              <select
                value={subagentConfig.defaultRoleId}
                onChange={(e) => updateSubagentConfig({ defaultRoleId: e.target.value })}
                className={cn('w-full h-9 px-2.5 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs', tokens.inputRadius)}
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-zinc-500 mb-1">Р‘РµСЃРїР»Р°С‚РЅС‹Р№ РїСЂРѕРІР°Р№РґРµСЂ</label>
              <select
                value={subagentConfig.defaultProviderId}
                onChange={(e) => updateSubagentConfig({ defaultProviderId: e.target.value })}
                className={cn('w-full h-9 px-2.5 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs', tokens.inputRadius)}
              >
                {freeProviders.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!subagentTaskInput.trim()) return;
              launchSubagent({ prompt: subagentTaskInput });
              setSubagentTaskInput('');
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={subagentTaskInput}
              onChange={(e) => setSubagentTaskInput(e.target.value)}
              placeholder="РўРµСЃС‚РѕРІС‹Р№ Р·Р°РїСѓСЃРє СЃСѓР±Р°РіРµРЅС‚Р° (РЅР°РїСЂРёРјРµСЂ: РџСЂРѕРІРµСЂСЊ РїРѕРєСЂС‹С‚РёРµ С‚РµСЃС‚Р°РјРё)..."
              className={cn('flex-1 h-9 px-3 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs', tokens.inputRadius)}
            />
            <button
              type="submit"
              disabled={!subagentTaskInput.trim()}
              className={cn('h-9 px-3.5 disabled:opacity-45 text-xs font-medium inline-flex items-center gap-1.5', tokens.inputRadius, tokens.accentButton)}
            >
              <Play className="w-3.5 h-3.5" />
              <span>Р—Р°РїСѓСЃС‚РёС‚СЊ ({subagentRuns.length})</span>
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (section === 'execution-env') {
    const envCards: { id: ExecutionEnvKind; title: string; subtitle: string; icon: React.ComponentType<{ className?: string }> }[] = [
      { id: 'local', title: 'Р›РѕРєР°Р»СЊРЅРѕ (Windows)', subtitle: 'PowerShell / CMD РЅР°РїСЂСЏРјСѓСЋ РІ РїР°РїРєРµ РїСЂРѕРµРєС‚Р°', icon: Laptop },
      { id: 'ssh', title: 'РЈРґР°Р»С‘РЅРЅС‹Р№ SSH-С…РѕСЃС‚', subtitle: 'РСЃРїРѕР»СЊР·СѓРµС‚ РїСЂРѕС„РёР»Рё OpenSSH РёР· СЂР°Р·РґРµР»Р° SSH Рё GitHub', icon: Server },
      { id: 'docker', title: 'Docker-РєРѕРЅС‚РµР№РЅРµСЂ', subtitle: 'РР·РѕР»РёСЂРѕРІР°РЅРЅР°СЏ РїРµСЃРѕС‡РЅРёС†Р° Р±РµР· СЂРёСЃРєР° РґР»СЏ С…РѕСЃС‚Р°', icon: Container },
    ];

    return (
      <div className="max-w-4xl mx-auto px-6 py-6 space-y-5">
        <div className={cn('p-6 border space-y-5', tokens.cardRadius, tokens.cardBg, tokens.cardBorder)}>
          <div>
            <h2 className="font-display text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              РЎСЂРµРґС‹ РІС‹РїРѕР»РЅРµРЅРёСЏ РєРѕРјР°РЅРґ (Execution Environments)
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Р’С‹Р±РµСЂРёС‚Рµ, РіРґРµ Р°РіРµРЅС‚ Р·Р°РїСѓСЃРєР°РµС‚ СЃР±РѕСЂРєСѓ, С‚РµСЃС‚С‹ Рё С‚РµСЂРјРёРЅР°Р»СЊРЅС‹Рµ РєРѕРјР°РЅРґС‹: Р»РѕРєР°Р»СЊРЅРѕ РЅР° Windows, РїРѕ SSH РёР»Рё РІРЅСѓС‚СЂРё Docker.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {envCards.map((card) => {
              const Icon = card.icon;
              const selected = executionEnv.activeEnv === card.id;
              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => setActiveExecutionEnv(card.id)}
                  className={cn(
                    'p-4 border text-left transition-colors space-y-1.5',
                    tokens.cardRadius,
                    selected
                      ? tokens.activeHighlight
                      : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/60',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <Icon className="w-4 h-4 text-blue-500" />
                    {selected && <Check className="w-4 h-4 text-blue-500" />}
                  </div>
                  <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">{card.title}</div>
                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400">{card.subtitle}</div>
                </button>
              );
            })}
          </div>

          {executionEnv.activeEnv === 'local' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-zinc-200 dark:border-zinc-800">
              <div>
                <label className="block text-[11px] text-zinc-500 mb-1">РћР±РѕР»РѕС‡РєР° Windows</label>
                <select
                  value={executionEnv.localShell}
                  onChange={(e) =>
                    updateExecutionEnv({ localShell: e.target.value as 'powershell' | 'cmd' })
                  }
                  className={cn('w-full h-9 px-2.5 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs', tokens.inputRadius)}
                >
                  <option value="powershell">PowerShell 7 / Windows PowerShell</option>
                  <option value="cmd">Command Prompt (cmd.exe)</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-zinc-500 mb-1">Р Р°Р±РѕС‡РёР№ РєР°С‚Р°Р»РѕРі</label>
                <input
                  type="text"
                  value={executionEnv.localWorkdir}
                  onChange={(e) => updateExecutionEnv({ localWorkdir: e.target.value })}
                  className={cn('w-full h-9 px-3 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 font-mono text-xs', tokens.inputRadius)}
                />
              </div>
            </div>
          )}

          {executionEnv.activeEnv === 'ssh' && (
            <div className="space-y-3 pt-2 border-t border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Р¦РµР»РµРІРѕР№ SSH-С…РѕСЃС‚ РёР· ~/.ssh/config
                </label>
                <button
                  type="button"
                  onClick={() => openSettingsSection('ssh-github')}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  РќР°СЃС‚СЂРѕРёС‚СЊ РєР»СЋС‡Рё Рё С…РѕСЃС‚С‹ SSH в†’
                </button>
              </div>
              <select
                value={executionEnv.sshHostId}
                onChange={(e) => updateExecutionEnv({ sshHostId: e.target.value })}
                className={cn('w-full h-9 px-3 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 font-mono text-xs', tokens.inputRadius)}
              >
                {sshHosts.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.alias} ({h.user}@{h.hostName}:{h.port})
                  </option>
                ))}
              </select>
            </div>
          )}

          {executionEnv.activeEnv === 'docker' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-zinc-200 dark:border-zinc-800">
              <div>
                <label className="block text-[11px] text-zinc-500 mb-1">РћР±СЂР°Р· РєРѕРЅС‚РµР№РЅРµСЂР°</label>
                <input
                  type="text"
                  value={executionEnv.dockerImage}
                  onChange={(e) => updateExecutionEnv({ dockerImage: e.target.value })}
                  className={cn('w-full h-9 px-3 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 font-mono text-xs', tokens.inputRadius)}
                />
              </div>
              <div>
                <label className="block text-[11px] text-zinc-500 mb-1">РљР°С‚Р°Р»РѕРі РІРЅСѓС‚СЂРё (/workspace)</label>
                <input
                  type="text"
                  value={executionEnv.dockerWorkdir}
                  onChange={(e) => updateExecutionEnv({ dockerWorkdir: e.target.value })}
                  className={cn('w-full h-9 px-3 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 font-mono text-xs', tokens.inputRadius)}
                />
              </div>
              <div>
                <label className="block text-[11px] text-zinc-500 mb-1">РЎРµС‚СЊ РєРѕРЅС‚РµР№РЅРµСЂР°</label>
                <select
                  value={executionEnv.dockerNetworkMode}
                  onChange={(e) =>
                    updateExecutionEnv({ dockerNetworkMode: e.target.value as 'bridge' | 'none' })
                  }
                  className={cn('w-full h-9 px-2.5 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs', tokens.inputRadius)}
                >
                  <option value="bridge">bridge (РґРѕСЃС‚СѓРї РІ СЃРµС‚СЊ)</option>
                  <option value="none">none (СЃС‚СЂРѕРіРёР№ РѕС„Р»Р°Р№РЅ)</option>
                </select>
              </div>
            </div>
          )}

          <label className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer pt-2">
            <input
              type="checkbox"
              checked={executionEnv.requireApprovalBeforeExec}
              onChange={(e) => updateExecutionEnv({ requireApprovalBeforeExec: e.target.checked })}
              className="accent-blue-600"
            />
            <span>Р—Р°РїСЂР°С€РёРІР°С‚СЊ РїРѕРґС‚РІРµСЂР¶РґРµРЅРёРµ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ РїРµСЂРµРґ РІС‹РїРѕР»РЅРµРЅРёРµРј РєРѕРјР°РЅРґ РІ С‚РµСЂРјРёРЅР°Р»Рµ (Cline Safe Act)</span>
          </label>
        </div>
      </div>
    );
  }

  // Gateway Section (Telegram, Discord, Slack)
  return (
    <div className="max-w-4xl mx-auto px-6 py-6 space-y-5">
      <div className={cn('p-6 border space-y-5', tokens.cardRadius, tokens.cardBg, tokens.cardBorder)}>
        <div>
          <h2 className="font-display text-lg font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-blue-500" />
            <span>РЁР»СЋР· РјРµСЃСЃРµРЅРґР¶РµСЂРѕРІ (Telegram, Discord, Slack)</span>
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            РЈРїСЂР°РІР»СЏР№С‚Рµ Р°РіРµРЅС‚РѕРј ONE CORE AI СЃ С‚РµР»РµС„РѕРЅР° РёР»Рё РєРѕРјР°РЅРґРЅС‹С… С‡Р°С‚РѕРІ Р±РµР· РїР»Р°С‚РЅС‹С… С€Р»СЋР·РѕРІ Рё РѕРіСЂР°РЅРёС‡РµРЅРёР№.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {gateways.map((gw) => (
            <button
              key={gw.id}
              type="button"
              onClick={() => setActiveGatewayId(gw.id)}
              className={cn(
                'p-3 border text-left transition-colors',
                tokens.cardRadius,
                activeGatewayId === gw.id
                  ? tokens.activeHighlight
                  : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/60',
              )}
            >
              <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">{gw.name}</div>
              <div className="text-[11px] font-mono text-zinc-500 mt-0.5">
                {gw.enabled ? 'Р’РєР»СЋС‡С‘РЅ' : 'РћС‚РєР»СЋС‡С‘РЅ'} В· {gw.prefixCommand}
              </div>
            </button>
          ))}
        </div>

        {activeGateway && (
          <div className="space-y-4 pt-2 border-t border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center justify-between gap-2">
              <label className="inline-flex items-center gap-2 text-xs font-medium text-zinc-800 dark:text-zinc-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={activeGateway.enabled}
                  onChange={(e) => updateGateway(activeGateway.id, { enabled: e.target.checked })}
                  className="accent-blue-600"
                />
                <span>РђРєС‚РёРІРёСЂРѕРІР°С‚СЊ С€Р»СЋР· {activeGateway.name}</span>
              </label>

              {activeGateway.id === 'telegram' && (
                <button
                  type="button"
                  onClick={() => verifyTelegramGateway()}
                  disabled={activeGateway.status === 'checking'}
                  className={cn('h-8 px-3 text-xs font-medium inline-flex items-center gap-1.5', tokens.inputRadius, tokens.accentButton)}
                >
                  {activeGateway.status === 'checking' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5" />
                  )}
                  <span>РџСЂРѕРІРµСЂРёС‚СЊ С‚РѕРєРµРЅ РІ Telegram API</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-zinc-500 mb-1">Bot Token</label>
                <input
                  type="password"
                  value={activeGateway.botToken}
                  onChange={(e) => updateGateway(activeGateway.id, { botToken: e.target.value })}
                  placeholder={activeGateway.id === 'telegram' ? '123456789:AAH...' : 'РўРѕРєРµРЅ Р±РѕС‚Р°...'}
                  className={cn('w-full h-9 px-3 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 font-mono text-xs', tokens.inputRadius)}
                />
              </div>
              <div>
                <label className="block text-[11px] text-zinc-500 mb-1">
                  Р Р°Р·СЂРµС€С‘РЅРЅС‹Рµ User / Chat ID (С‡РµСЂРµР· Р·Р°РїСЏС‚СѓСЋ)
                </label>
                <input
                  type="text"
                  value={activeGateway.allowedChatIds}
                  onChange={(e) => updateGateway(activeGateway.id, { allowedChatIds: e.target.value })}
                  placeholder="РќР°РїСЂРёРјРµСЂ: 123456789, 987654321"
                  className={cn('w-full h-9 px-3 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 font-mono text-xs', tokens.inputRadius)}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-4 text-xs text-zinc-700 dark:text-zinc-300">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={activeGateway.requireApprovalForWrite}
                  onChange={(e) =>
                    updateGateway(activeGateway.id, { requireApprovalForWrite: e.target.checked })
                  }
                  className="accent-blue-600"
                />
                <span>РўСЂРµР±РѕРІР°С‚СЊ РїРѕРґС‚РІРµСЂР¶РґРµРЅРёРµ РІ С‡Р°С‚Рµ РїРµСЂРµРґ Р·Р°РїРёСЃСЊСЋ С„Р°Р№Р»РѕРІ</span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={activeGateway.autoReplyVoiceNotes}
                  onChange={(e) =>
                    updateGateway(activeGateway.id, { autoReplyVoiceNotes: e.target.checked })
                  }
                  className="accent-blue-600"
                />
                <span>Р Р°СЃРїРѕР·РЅР°РІР°С‚СЊ РіРѕР»РѕСЃРѕРІС‹Рµ Р·Р°РјРµС‚РєРё (Whisper local)</span>
              </label>
            </div>

            <div
              className={cn(
                'p-3 border text-xs font-mono flex items-center gap-2',
                tokens.cardRadius,
                activeGateway.status === 'connected'
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                  : activeGateway.status === 'error'
                    ? 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300'
                    : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-500',
              )}
            >
              <span>{activeGateway.statusMessage}</span>
            </div>
          </div>
        )}

        {/* Exportable PowerShell Gateway Launcher */}
        <div className={cn('bg-zinc-950 text-zinc-100 p-4 space-y-2', tokens.cardRadius)}>
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-mono text-emerald-400">Start-OneCore-Gateway.ps1</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => copyText('gw-ps1', gatewayScript)}
                className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-100 inline-flex items-center gap-1 text-[11px]"
              >
                {copiedId === 'gw-ps1' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedId === 'gw-ps1' ? 'РЎРєРѕРїРёСЂРѕРІР°РЅРѕ' : 'РљРѕРїРёСЂРѕРІР°С‚СЊ'}</span>
              </button>
              <button
                type="button"
                onClick={() => downloadFile('Start-OneCore-Gateway.ps1', gatewayScript)}
                className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-100 inline-flex items-center gap-1 text-[11px]"
              >
                <Download className="w-3 h-3" />
                <span>РЎРєР°С‡Р°С‚СЊ</span>
              </button>
            </div>
          </div>
          <pre className="font-mono text-[11px] leading-5 overflow-x-auto">{gatewayScript}</pre>
        </div>
      </div>
    </div>
  );
};
