import React, { useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  GitBranch,
  Play,
  Plus,
  RotateCcw,
  Shield,
  Sliders,
  Trash2,
  UserCheck,
} from 'lucide-react';
import { useOneCoreStore } from '../../store/useOneCoreStore';
import type { AgentMode, PermissionPolicy, RolePersonaKind } from '../../types/onecore';
import { cn } from '../../utils/cn';
import { ModelMascot } from '../agent/ModelMascot';

type SubSection = 'roles' | 'permissions' | 'pipeline';

export const RolesAndPipelineView: React.FC = () => {
  const {
    roles,
    activeRoleId,
    setActiveRole,
    addCustomRole,
    deleteCustomRole,
    permissions,
    setPermissionPolicy,
    directives,
    toggleDirective,
    addCustomDirective,
    pipelineStages,
    pipelineProjectName,
    pipelineStack,
    pipelineRunning,
    setPipelineConfig,
    updateStageRole,
    runSinglePipelineStage,
    runFullPipeline,
    resetPipeline,
    localModels,
    activeModelId,
    serverStatus,
    tokensPerSec,
    setActiveTab,
    sendPrompt,
  } = useOneCoreStore();

  const [section, setSection] = useState<SubSection>('roles');

  // Custom role builder state
  const [roleName, setRoleName] = useState('');
  const [roleTagline, setRoleTagline] = useState('');
  const [rolePrompt, setRolePrompt] = useState('');
  const [roleMode, setRoleMode] = useState<AgentMode>('act');
  const [roleTemp, setRoleTemp] = useState(0.2);

  // Custom directive state
  const [dirTitle, setDirTitle] = useState('');
  const [dirInstruction, setDirInstruction] = useState('');
  const [dirCategory, setDirCategory] = useState<'РљР°С‡РµСЃС‚РІРѕ РєРѕРґР°' | 'РђСЂС…РёС‚РµРєС‚СѓСЂР°' | 'Р‘РµР·РѕРїР°СЃРЅРѕСЃС‚СЊ' | 'РЎС‚РёР»СЊ РѕС‚РІРµС‚Р°'>('РљР°С‡РµСЃС‚РІРѕ РєРѕРґР°');

  // Selected pipeline stage inspector
  const [selectedStageId, setSelectedStageId] = useState(pipelineStages[0].id);

  const activeModel = localModels.find((m) => m.id === activeModelId);
  const activeRole = roles.find((r) => r.id === activeRoleId) ?? roles[0];
  const selectedStage =
    pipelineStages.find((st) => st.id === selectedStageId) ?? pipelineStages[0];

  const handleCreateRole = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleName.trim() || !rolePrompt.trim()) return;
    addCustomRole({
      name: roleName.trim(),
      persona: 'custom',
      tagline: roleTagline.trim() || 'РџРѕР»СЊР·РѕРІР°С‚РµР»СЊСЃРєР°СЏ СЃРёСЃС‚РµРјРЅР°СЏ СЂРѕР»СЊ',
      systemPrompt: rolePrompt.trim(),
      defaultMode: roleMode,
      recommendedTemp: roleTemp,
      accentHex: '#06B6D4',
    });
    setRoleName('');
    setRoleTagline('');
    setRolePrompt('');
  };

  const handleAddDirective = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dirTitle.trim() || !dirInstruction.trim()) return;
    addCustomDirective({
      category: dirCategory,
      title: dirTitle.trim(),
      instruction: dirInstruction.trim(),
      enabled: true,
    });
    setDirTitle('');
    setDirInstruction('');
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-zinc-50 dark:bg-[#09090B]">
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Top Banner */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-zinc-200 dark:border-zinc-800">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              Р РѕР»Рё РјРѕРґРµР»Рё, Р±РёР±Р»РёРѕС‚РµРєР° РїСЂР°РІРёР» Рё РїР°Р№РїР»Р°Р№РЅ РїСЂРѕРµРєС‚РѕРІ
            </h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1 max-w-2xl">
              РћРґРЅР° Р·Р°РіСЂСѓР¶РµРЅРЅР°СЏ РјРѕРґРµР»СЊ (<span className="font-mono">{activeModel?.name ?? 'GGUF'}</span>) РјРѕР¶РµС‚ РјРіРЅРѕРІРµРЅРЅРѕ РїРµСЂРµРєР»СЋС‡Р°С‚СЊСЃСЏ РјРµР¶РґСѓ РёРЅР¶РµРЅРµСЂРЅС‹РјРё СЂРѕР»СЏРјРё, СЃРѕР±Р»СЋРґР°СЏ РјР°С‚СЂРёС†Сѓ СЂР°Р·СЂРµС€РµРЅРёР№ Рё СЃРёСЃС‚РµРјРЅС‹Рµ СѓРєР°Р·Р°РЅРёСЏ.
            </p>
          </div>
          <div className="w-full lg:w-72 shrink-0">
            <ModelMascot
              status={serverStatus}
              persona={activeRole.persona}
              roleName={activeRole.name}
              modelName={activeModel?.name}
              tokensPerSec={tokensPerSec}
              compact
            />
          </div>
        </div>

        {/* Sub-navigation */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-zinc-200/75 dark:bg-zinc-800/80 w-fit">
          {(
            [
              { id: 'roles', label: 'Р РѕР»Рё РѕРґРЅРѕР№ РјРѕРґРµР»Рё', icon: <UserCheck className="w-3.5 h-3.5" /> },
              { id: 'permissions', label: 'Р Р°Р·СЂРµС€РµРЅРёСЏ Рё СѓРєР°Р·Р°РЅРёСЏ', icon: <Shield className="w-3.5 h-3.5" /> },
              { id: 'pipeline', label: 'Р’РёР·СѓР°Р»СЊРЅР°СЏ СЃС…РµРјР° РїСЂРѕРµРєС‚РѕРІ', icon: <GitBranch className="w-3.5 h-3.5" /> },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSection(t.id)}
              className={cn(
                'px-3.5 py-2 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition-colors whitespace-nowrap',
                section === t.id
                  ? 'bg-white dark:bg-zinc-950 text-zinc-950 dark:text-zinc-50 shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200',
              )}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* SECTION 1: Multi-Role Switching + Custom Role Constructor */}
        {section === 'roles' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Р”РѕСЃС‚СѓРїРЅС‹Рµ СЂРѕР»Рё РґР»СЏ РјРѕРґРµР»Рё {activeModel?.name}
                </h2>
                <span className="text-xs text-zinc-500 font-mono tabular-nums">
                  {roles.length} СЂРѕР»РµР№
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {roles.map((r) => {
                  const active = r.id === activeRoleId;
                  return (
                    <div
                      key={r.id}
                      className={cn(
                        'rounded-xl border p-4 flex flex-col justify-between gap-3 transition-colors',
                        active
                          ? 'border-blue-500 bg-blue-500/5'
                          : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111114]',
                      )}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-display text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                            {r.name}
                          </span>
                          {r.isCustom && (
                            <button
                              type="button"
                              onClick={() => deleteCustomRole(r.id)}
                              title="РЈРґР°Р»РёС‚СЊ СЂРѕР»СЊ"
                              className="p-1 rounded text-zinc-400 hover:text-rose-500"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                          {r.tagline}
                        </p>
                        <div className="mt-2 font-mono text-[11px] text-zinc-500 tabular-nums">
                          Р РµР¶РёРј: {r.defaultMode.toUpperCase()} В· temp {r.recommendedTemp.toFixed(2)}
                        </div>
                        <p className="mt-2.5 text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed line-clamp-3">
                          {r.systemPrompt}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setActiveRole(r.id)}
                        className={cn(
                          'h-8 px-3 rounded-lg text-xs font-medium transition-colors',
                          active
                            ? 'bg-blue-600 text-white'
                            : 'bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200',
                        )}
                      >
                        {active ? 'РђРєС‚РёРІРЅР° РІ СЂР°Р±РѕС‡РµР№ СЃС‚Р°РЅС†РёРё' : 'РџРµСЂРµРєР»СЋС‡РёС‚СЊСЃСЏ РЅР° СЌС‚Сѓ СЂРѕР»СЊ'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Custom Role Builder */}
            <div className="lg:col-span-5">
              <form
                onSubmit={handleCreateRole}
                className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111114] p-5 space-y-4"
              >
                <div>
                  <h2 className="font-display text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                    <Plus className="w-4 h-4 text-blue-500" />
                    РљРѕРЅСЃС‚СЂСѓРєС‚РѕСЂ РЅРѕРІРѕР№ СЂРѕР»Рё
                  </h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    РЎРѕР·РґР°Р№С‚Рµ СЃРїРµС†РёР°Р»РёР·РёСЂРѕРІР°РЅРЅСѓСЋ СЂРѕР»СЊ (РЅР°РїСЂРёРјРµСЂ, Rust Performance Tuner РёР»Рё DevOps Windows).
                  </p>
                </div>

                <div>
                  <label className="block text-xs text-zinc-600 dark:text-zinc-400 mb-1">
                    РќР°Р·РІР°РЅРёРµ СЂРѕР»Рё
                  </label>
                  <input
                    type="text"
                    required
                    value={roleName}
                    onChange={(e) => setRoleName(e.target.value)}
                    placeholder="РќР°РїСЂРёРјРµСЂ: РЎРёСЃС‚РµРјРЅС‹Р№ РѕРїС‚РёРјРёР·Р°С‚РѕСЂ"
                    className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100"
                  />
                </div>

                <div>
                  <label className="block text-xs text-zinc-600 dark:text-zinc-400 mb-1">
                    РљСЂР°С‚РєР°СЏ СЃРїРµС†РёР°Р»РёР·Р°С†РёСЏ
                  </label>
                  <input
                    type="text"
                    value={roleTagline}
                    onChange={(e) => setRoleTagline(e.target.value)}
                    placeholder="РџСЂРѕС„РёР»РёСЂРѕРІР°РЅРёРµ РїР°РјСЏС‚Рё, SIMD Рё Р°СЃРёРЅС…СЂРѕРЅРЅС‹Р№ Tokio"
                    className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100"
                  />
                </div>

                <div>
                  <label className="block text-xs text-zinc-600 dark:text-zinc-400 mb-1">
                    РЎРёСЃС‚РµРјРЅС‹Р№ РїСЂРѕРјРїС‚ СЂРѕР»Рё
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={rolePrompt}
                    onChange={(e) => setRolePrompt(e.target.value)}
                    placeholder="РћРїРёС€РёС‚Рµ СЃС‚РёР»СЊ РјС‹С€Р»РµРЅРёСЏ, С„РѕСЂРјР°С‚ РѕС‚РІРµС‚РѕРІ Рё РїСЂРёРѕСЂРёС‚РµС‚С‹ РїСЂРѕРІРµСЂРєРё РєРѕРґР°..."
                    className="w-full p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100 resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-zinc-600 dark:text-zinc-400 mb-1">
                      Р РµР¶РёРј РїРѕ СѓРјРѕР»С‡Р°РЅРёСЋ
                    </label>
                    <select
                      value={roleMode}
                      onChange={(e) => setRoleMode(e.target.value as AgentMode)}
                      className="w-full h-9 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100"
                    >
                      <option value="act">Act (Р”РёС„С„С‹ Рё С‚РµСЂРјРёРЅР°Р»)</option>
                      <option value="plan">Plan (РўРѕР»СЊРєРѕ Р°РЅР°Р»РёР·)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-600 dark:text-zinc-400 mb-1">
                      Temperature ({roleTemp.toFixed(2)})
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={roleTemp}
                      onChange={(e) => setRoleTemp(parseFloat(e.target.value))}
                      className="w-full mt-2 accent-blue-600"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full h-9 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors"
                >
                  РЎРѕР·РґР°С‚СЊ Рё Р°РєС‚РёРІРёСЂРѕРІР°С‚СЊ СЂРѕР»СЊ
                </button>
              </form>
            </div>
          </div>
        )}

        {/* SECTION 2: Permissions Matrix & Directives Library */}
        {section === 'permissions' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Permissions */}
            <div className="lg:col-span-6 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111114] p-5 space-y-4">
              <div>
                <h2 className="font-display text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  Р‘РёР±Р»РёРѕС‚РµРєР° СЂР°Р·СЂРµС€РµРЅРёР№ РјРѕРґРµР»Рё
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  РџРѕР»РёС‚РёРєРё РїСЂРёРјРµРЅСЏСЋС‚СЃСЏ РґРІРёР¶РєРѕРј Agent Core РїРµСЂРµРґ РІС‹РїРѕР»РЅРµРЅРёРµРј РєР°Р¶РґРѕРіРѕ РґРµР№СЃС‚РІРёСЏ РёР»Рё РєРѕРјР°РЅРґС‹ PowerShell.
                </p>
              </div>

              <div className="space-y-2.5">
                {permissions.map((rule) => (
                  <div
                    key={rule.id}
                    className="p-3 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-[11px] font-mono text-zinc-500">{rule.category}</div>
                      <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 mt-0.5">
                        {rule.title}
                      </div>
                      <p className="text-[11.5px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                        {rule.description}
                      </p>
                    </div>

                    <div className="inline-flex items-center p-0.5 rounded-lg bg-zinc-200/80 dark:bg-zinc-800 shrink-0">
                      {(
                        [
                          { val: 'allow', label: 'РђРІС‚Рѕ' },
                          { val: 'ask', label: 'Р—Р°РїСЂРѕСЃ' },
                          { val: 'deny', label: 'Р—Р°РїСЂРµС‚' },
                        ] as { val: PermissionPolicy; label: string }[]
                      ).map((opt) => (
                        <button
                          key={opt.val}
                          type="button"
                          onClick={() => setPermissionPolicy(rule.id, opt.val)}
                          className={cn(
                            'px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap',
                            rule.policy === opt.val
                              ? opt.val === 'deny'
                                ? 'bg-rose-600 text-white'
                                : opt.val === 'ask'
                                  ? 'bg-amber-600 text-white'
                                  : 'bg-emerald-600 text-white'
                              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200',
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Directives Library */}
            <div className="lg:col-span-6 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111114] p-5 space-y-4">
              <div>
                <h2 className="font-display text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  Р‘РёР±Р»РёРѕС‚РµРєР° СЃРёСЃС‚РµРјРЅС‹С… СѓРєР°Р·Р°РЅРёР№ (Directives)
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Р’РєР»СЋС‡С‘РЅРЅС‹Рµ РґРёСЂРµРєС‚РёРІС‹ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё РґРѕР±Р°РІР»СЏСЋС‚СЃСЏ Рє СЃРёСЃС‚РµРјРЅРѕРјСѓ РїСЂРѕРјРїС‚Сѓ Р°РєС‚РёРІРЅРѕР№ СЂРѕР»Рё.
                </p>
              </div>

              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {directives.map((dir) => (
                  <label
                    key={dir.id}
                    className={cn(
                      'block p-3 rounded-xl border cursor-pointer transition-colors',
                      dir.enabled
                        ? 'border-blue-500/40 bg-blue-500/5'
                        : 'border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/30 opacity-75',
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[11px] font-mono text-zinc-500">{dir.category}</div>
                        <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 mt-0.5">
                          {dir.title}
                        </div>
                        <p className="text-[11.5px] text-zinc-600 dark:text-zinc-400 mt-0.5 leading-relaxed">
                          {dir.instruction}
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={dir.enabled}
                        onChange={() => toggleDirective(dir.id)}
                        className="mt-1 accent-blue-600 rounded shrink-0"
                      />
                    </div>
                  </label>
                ))}
              </div>

              <form onSubmit={handleAddDirective} className="pt-3 border-t border-zinc-200 dark:border-zinc-800 space-y-2.5">
                <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  Р”РѕР±Р°РІРёС‚СЊ СЃРІРѕС‘ СѓРєР°Р·Р°РЅРёРµ
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={dirTitle}
                    onChange={(e) => setDirTitle(e.target.value)}
                    placeholder="РќР°Р·РІР°РЅРёРµ РїСЂР°РІРёР»Р°"
                    className="sm:col-span-2 h-8 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs"
                  />
                  <select
                    value={dirCategory}
                    onChange={(e) => setDirCategory(e.target.value as typeof dirCategory)}
                    className="h-8 px-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs"
                  >
                    <option value="РљР°С‡РµСЃС‚РІРѕ РєРѕРґР°">РљР°С‡РµСЃС‚РІРѕ РєРѕРґР°</option>
                    <option value="РђСЂС…РёС‚РµРєС‚СѓСЂР°">РђСЂС…РёС‚РµРєС‚СѓСЂР°</option>
                    <option value="Р‘РµР·РѕРїР°СЃРЅРѕСЃС‚СЊ">Р‘РµР·РѕРїР°СЃРЅРѕСЃС‚СЊ</option>
                    <option value="РЎС‚РёР»СЊ РѕС‚РІРµС‚Р°">РЎС‚РёР»СЊ РѕС‚РІРµС‚Р°</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={dirInstruction}
                    onChange={(e) => setDirInstruction(e.target.value)}
                    placeholder="РўРµРєСЃС‚ РёРЅСЃС‚СЂСѓРєС†РёРё РґР»СЏ РјРѕРґРµР»Рё..."
                    className="flex-1 h-8 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs"
                  />
                  <button
                    type="submit"
                    disabled={!dirTitle.trim() || !dirInstruction.trim()}
                    className="h-8 px-3 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 disabled:opacity-45 text-xs font-medium whitespace-nowrap"
                  >
                    Р”РѕР±Р°РІРёС‚СЊ
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* SECTION 3: Visual Interactive Project Creation Pipeline */}
        {section === 'pipeline' && (
          <div className="space-y-5">
            {/* Pipeline Config Bar */}
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111114] p-4 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
                <div>
                  <label className="block text-[11px] text-zinc-500 mb-1">
                    Р¦РµР»РµРІРѕР№ РїСЂРѕРµРєС‚
                  </label>
                  <input
                    type="text"
                    value={pipelineProjectName}
                    onChange={(e) => setPipelineConfig(e.target.value, pipelineStack)}
                    className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs font-medium text-zinc-900 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-zinc-500 mb-1">
                    РўРµС…РЅРѕР»РѕРіРёС‡РµСЃРєРёР№ СЃС‚РµРє
                  </label>
                  <input
                    type="text"
                    value={pipelineStack}
                    onChange={(e) => setPipelineConfig(pipelineProjectName, e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 font-mono text-xs text-zinc-900 dark:text-zinc-100"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={resetPipeline}
                  className="h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-300 inline-flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>РЎР±СЂРѕСЃРёС‚СЊ</span>
                </button>
                <button
                  type="button"
                  disabled={pipelineRunning}
                  onClick={runFullPipeline}
                  className="h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>{pipelineRunning ? 'Р’С‹РїРѕР»РЅСЏРµС‚СЃСЏ РїР°Р№РїР»Р°Р№РЅ...' : 'Р—Р°РїСѓСЃС‚РёС‚СЊ РїР°Р№РїР»Р°Р№РЅ'}</span>
                </button>
              </div>
            </div>

            {/* Interactive Connected Nodes Graph */}
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111114] p-5 overflow-x-auto">
              <div className="flex items-stretch gap-2 min-w-[920px]">
                {pipelineStages.map((stage, idx) => {
                  const stageRole = roles.find((r) => r.id === stage.assignedRoleId) ?? roles[0];
                  const isSelected = stage.id === selectedStageId;
                  return (
                    <React.Fragment key={stage.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedStageId(stage.id)}
                        className={cn(
                          'flex-1 text-left p-3.5 rounded-xl border transition-all flex flex-col justify-between gap-3',
                          isSelected
                            ? 'border-blue-500 bg-blue-500/5 ring-1 ring-blue-500/30'
                            : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/40 hover:border-zinc-300 dark:hover:border-zinc-700',
                        )}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-[11px] text-zinc-500 tabular-nums">
                              0{stage.stepNumber}
                            </span>
                            <span
                              className={cn(
                                'text-[10.5px] font-medium',
                                stage.status === 'done'
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : stage.status === 'error'
                                    ? 'text-rose-600 dark:text-rose-400'
                                    : stage.status === 'running'
                                      ? 'text-blue-600 dark:text-blue-400'
                                      : 'text-zinc-400',
                              )}
                            >
                              {stage.status === 'done'
                                ? 'Р“РѕС‚РѕРІРѕ'
                                : stage.status === 'error'
                                  ? 'РћС€РёР±РєР°'
                                  : stage.status === 'running'
                                    ? 'Р’ СЂР°Р±РѕС‚Рµ...'
                                    : 'РћР¶РёРґР°РЅРёРµ'}
                            </span>
                          </div>
                          <div className="font-display text-sm font-semibold text-zinc-900 dark:text-zinc-100 mt-1.5">
                            {stage.title}
                          </div>
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                            {stage.shortGoal}
                          </p>
                        </div>

                        <div className="pt-2 border-t border-zinc-200/70 dark:border-zinc-800/80 text-[11px]">
                          <div className="font-medium text-zinc-800 dark:text-zinc-200 truncate">
                            Р РѕР»СЊ: {stageRole.name}
                          </div>
                          <div className="font-mono text-[10.5px] text-zinc-400 truncate mt-0.5">
                            {stage.outputArtifact}
                          </div>
                        </div>
                      </button>

                      {idx < pipelineStages.length - 1 && (
                        <div className="flex items-center justify-center text-zinc-400 dark:text-zinc-600 shrink-0">
                          <ArrowRight className="w-4 h-4" />
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>

            {/* Stage Inspector & Runner */}
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111114] p-5 grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
              <div className="lg:col-span-7 space-y-2">
                <div className="flex items-center gap-2 text-xs text-zinc-500 font-mono">
                  <span>Р­С‚Р°Рї 0{selectedStage.stepNumber}</span>
                  <span>В·</span>
                  <span>Р РµР¶РёРј {selectedStage.mode.toUpperCase()}</span>
                  <span>В·</span>
                  <span>РђСЂС‚РµС„Р°РєС‚: {selectedStage.outputArtifact}</span>
                </div>
                <h3 className="font-display text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  {selectedStage.title}
                </h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {selectedStage.shortGoal}
                </p>
                {selectedStage.resultNote && (
                  <div
                    className={cn(
                      'mt-2 p-2.5 rounded-lg border text-xs flex items-center gap-2',
                      selectedStage.status === 'error'
                        ? 'border-rose-500/30 bg-rose-500/5 text-rose-700 dark:text-rose-300'
                        : 'border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300',
                    )}
                  >
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{selectedStage.resultNote}</span>
                  </div>
                )}
              </div>

              <div className="lg:col-span-5 space-y-3">
                <div>
                  <label className="block text-xs text-zinc-500 mb-1 inline-flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5" />
                    РќР°Р·РЅР°С‡РµРЅРЅР°СЏ СЂРѕР»СЊ РјРѕРґРµР»Рё РґР»СЏ СЌС‚РѕРіРѕ С€Р°РіР°
                  </label>
                  <select
                    value={selectedStage.assignedRoleId}
                    onChange={(e) => updateStageRole(selectedStage.id, e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100"
                  >
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.defaultMode.toUpperCase()})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => runSinglePipelineStage(selectedStage.id)}
                    className="h-9 px-3.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-medium inline-flex items-center gap-1.5"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Р’С‹РїРѕР»РЅРёС‚СЊ СЌС‚РѕС‚ С€Р°Рі</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveRole(selectedStage.assignedRoleId);
                      setActiveTab('workstation');
                      sendPrompt(
                        `Р’С‹РїРѕР»РЅРё СЌС‚Р°Рї В«${selectedStage.title}В» РґР»СЏ РїСЂРѕРµРєС‚Р° ${pipelineProjectName} (${pipelineStack}): ${selectedStage.shortGoal}`,
                      );
                    }}
                    className="h-9 px-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:border-blue-500 text-xs font-medium text-zinc-700 dark:text-zinc-200"
                  >
                    РћС‚РєСЂС‹С‚СЊ РІ С‡Р°С‚Рµ Р°РіРµРЅС‚Р°
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
