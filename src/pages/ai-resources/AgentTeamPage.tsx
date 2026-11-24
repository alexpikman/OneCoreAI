import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  FileCode2,
  GitBranch,
  Loader2,
  Play,
  Plus,
  RotateCcw,
  Shield,
  Sliders,
  Terminal,
  Trash2,
  UserCheck,
} from 'lucide-react';
import { AIResourcePageLayout as PageLayout } from '../../components/layout/AIResourcePageLayout';
import { PageContent } from '../../components/layout/PageContent';
import { PageHeader } from '../../components/layout/PageHeader';
import { SecondaryTabBar } from '../../components/layout/SecondaryTabBar';
import { useOneCoreStore } from '../../store/useOneCoreStore';
import type { AgentMode, PermissionPolicy } from '../../types/onecore';
import { cn } from '../../utils/cn';
import { requestDeleteWarning } from '../../utils/deleteWarning';

type SubSection = 'roles' | 'permissions' | 'pipeline';

const SPECIALIST_ROLES = [
  { id: 'role-researcher', label: 'Researcher' },
  { id: 'role-analyst', label: 'Analyst' },
  { id: 'role-architect', label: 'Architect' },
  { id: 'role-coder', label: 'Coder' },
  { id: 'role-developer', label: 'Developer' },
  { id: 'role-tester', label: 'Tester' },
  { id: 'role-qa', label: 'QA' },
];

export const AgentTeamPage: React.FC<{ initialSection?: SubSection }> = ({ initialSection = 'roles' }) => {
  const {
    roles,
    enabledRoleIds,
    generalAgentConfig,
    updateGeneralAgentConfig,
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
    projects,
    activeProjectId,
    teamExecutionResult,
    teamExecutionRunning,
    teamExecutionError,
    runTeamExecution,
    clearTeamExecutionResult,
    settingsError,
    setActiveTab,
    sendPrompt,
    saveSettings,
    agentTeamSection,
    setAgentTeamSection,
  } = useOneCoreStore();

  const [section, setSection] = useState<SubSection>(initialSection || agentTeamSection);

  useEffect(() => {
    if (initialSection) {
      setSection(initialSection);
      setAgentTeamSection(initialSection);
    } else if (agentTeamSection) {
      setSection(agentTeamSection);
    }
  }, [initialSection, agentTeamSection, setAgentTeamSection]);

  const handleSelectSection = (id: string) => {
    const sub = id as SubSection;
    setSection(sub);
    setAgentTeamSection(sub);
  };

  const [generalAgentSaveStatus, setGeneralAgentSaveStatus] = useState<string | null>(null);

  // Custom role builder state
  const [roleName, setRoleName] = useState('');
  const [roleTagline, setRoleTagline] = useState('');
  const [rolePrompt, setRolePrompt] = useState('');
  const [roleMode, setRoleMode] = useState<AgentMode>('act');
  const [roleTemp, setRoleTemp] = useState(0.2);

  // Custom directive state
  const [dirTitle, setDirTitle] = useState('');
  const [dirInstruction, setDirInstruction] = useState('');
  const [dirCategory, setDirCategory] = useState<
    'Качество кода' | 'Архитектура' | 'Безопасность' | 'Стиль ответа'
  >('Качество кода');

  // Selected pipeline stage inspector
  const [selectedStageId, setSelectedStageId] = useState(pipelineStages[0].id);

  // Team orchestration state
  const [teamObjective, setTeamObjective] = useState('');
  const [teamMaxCycles, setTeamMaxCycles] = useState(2);
  const [selectedSpecialistRoles, setSelectedSpecialistRoles] = useState<string[]>([
    'role-researcher',
    'role-architect',
    'role-tester',
    'role-qa',
  ]);
  const [selectedTeamProjectId, setSelectedTeamProjectId] = useState<string>(activeProjectId || '');

  const activeModel = localModels.find((m) => m.id === activeModelId);
  const selectedStage = pipelineStages.find((st) => st.id === selectedStageId) ?? pipelineStages[0];

  const handleCreateRole = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleName.trim() || !rolePrompt.trim()) return;
    addCustomRole({
      name: roleName.trim(),
      persona: 'custom',
      tagline: roleTagline.trim() || 'Пользовательская системная роль',
      systemPrompt: rolePrompt.trim(),
      defaultMode: roleMode,
      recommendedTemp: roleTemp,
      accentHex: '#06B6D4',
    });
    setRoleName('');
    setRoleTagline('');
    setRolePrompt('');
  };

  const handleSaveGeneralAgentConfig = async () => {
    const result = await saveSettings();
    setGeneralAgentSaveStatus(
      result.ok ? 'Настройки общего агента сохранены.' : result.error || 'Не удалось сохранить настройки.',
    );
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

  const toggleSpecialistRole = (roleId: string) => {
    setSelectedSpecialistRoles((current) =>
      current.includes(roleId) ? current.filter((item) => item !== roleId) : [...current, roleId],
    );
  };

  const handleRunTeamExecution = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!teamObjective.trim()) return;
    await runTeamExecution({
      projectId: selectedTeamProjectId || activeProjectId || undefined,
      objective: teamObjective.trim(),
      requestedRoles: selectedSpecialistRoles,
      maxCycles: teamMaxCycles,
    });
  };

  return (
    <PageLayout>
      <PageHeader>
        <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
          <UserCheck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <h1 className="text-xl font-semibold">{section === 'pipeline' ? 'Субагенты и делегирование' : 'General Agent и роли'}</h1>
        </div>
      </PageHeader>
      <PageContent contentClassName="space-y-6 pb-6 pt-2">
        <SecondaryTabBar
          ariaLabel="Внутренние страницы: Агенты и роли"
          items={[
            { id: 'roles', label: 'Роли одной модели', icon: <UserCheck className="h-3.5 w-3.5" /> },
            { id: 'permissions', label: 'Разрешения и указания', icon: <Shield className="h-3.5 w-3.5" /> },
            { id: 'pipeline', label: 'Субагенты и делегирование', icon: <GitBranch className="h-3.5 w-3.5" /> },
          ]}
          selectedId={section}
          onSelect={handleSelectSection}
        />
        {settingsError && (
          <p
            role="alert"
            className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300"
          >
            {settingsError}
          </p>
        )}

        {section === 'roles' && (
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111114] p-5 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-sm font-semibold text-zinc-900 dark:text-zinc-100">Общий агент</h2>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Отдельная конфигурация, используемая, когда все инженерные роли отключены.
                </p>
              </div>
              <span className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-2 py-1 text-[10px] font-medium text-zinc-600 dark:text-zinc-300">
                Универсальный режим
              </span>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <label className="block min-w-0">
                <span className="mb-1.5 block text-xs font-medium text-zinc-700 dark:text-zinc-300">Инструкции</span>
                <textarea
                  rows={8}
                  value={generalAgentConfig.instructions}
                  onChange={(event) => {
                    updateGeneralAgentConfig({ instructions: event.target.value });
                    setGeneralAgentSaveStatus(null);
                  }}
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-3 text-xs leading-relaxed text-zinc-900 dark:text-zinc-100 resize-y"
                />
              </label>
              <label className="block min-w-0">
                <span className="mb-1.5 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Схема поведения: этапы, правила и ограничения
                </span>
                <textarea
                  rows={8}
                  value={generalAgentConfig.behaviorSchema}
                  onChange={(event) => {
                    updateGeneralAgentConfig({ behaviorSchema: event.target.value });
                    setGeneralAgentSaveStatus(null);
                  }}
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-3 text-xs leading-relaxed text-zinc-900 dark:text-zinc-100 resize-y"
                />
              </label>
              <label className="block min-w-0">
                <span className="mb-1.5 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Системный промпт
                </span>
                <textarea
                  rows={8}
                  value={generalAgentConfig.systemPrompt}
                  onChange={(event) => {
                    updateGeneralAgentConfig({ systemPrompt: event.target.value });
                    setGeneralAgentSaveStatus(null);
                  }}
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-3 text-xs leading-relaxed text-zinc-900 dark:text-zinc-100 resize-y"
                />
              </label>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                {generalAgentSaveStatus ??
                  'Изменения применяются к контексту общего агента; нажмите «Сохранить», чтобы записать их в настройки.'}
              </span>
              <button
                type="button"
                onClick={() => void handleSaveGeneralAgentConfig()}
                className="h-9 rounded-lg bg-blue-600 hover:bg-blue-500 px-4 text-xs font-medium text-white transition-colors whitespace-nowrap"
              >
                Сохранить общий агент
              </button>
            </div>
          </div>
        )}

        {section === 'roles' && (
          <div className="space-y-6">
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111114] p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Доступные роли для модели {activeModel?.name}
                </h2>
                <span className="text-xs text-zinc-500 font-mono tabular-nums">{roles.length} ролей</span>
              </div>

              <div className="space-y-3">
                {roles.map((r) => {
                  const active = enabledRoleIds.includes(r.id);
                  return (
                    <div
                      key={r.id}
                      className={cn(
                        'rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors',
                        active
                          ? 'border-blue-500 bg-blue-500/5'
                          : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40',
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-display text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                            {r.name}
                          </span>
                          {active && (
                            <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400">
                              Активна в чате
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{r.tagline}</p>
                        <div className="mt-1 font-mono text-[11px] text-zinc-500 tabular-nums">
                          Режим: {r.defaultMode.toUpperCase()} · temp {r.recommendedTemp.toFixed(2)}
                        </div>
                        <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                          {r.systemPrompt}
                        </p>
                      </div>

                      {r.isCustom && (
                        <button
                          type="button"
                          onClick={async () => {
                            const confirmed = await requestDeleteWarning({
                              variant: 'simple',
                              title: 'Удалить роль агента?',
                              description: 'Пользовательская роль будет удалена.',
                              itemName: r.name,
                            });
                            if (confirmed) deleteCustomRole(r.id);
                          }}
                          title="Удалить роль"
                          className="h-8 px-3 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-400 dark:hover:bg-rose-950/30 text-xs font-medium inline-flex items-center gap-1.5 shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Удалить</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111114] p-5">
              <form onSubmit={handleCreateRole} className="space-y-4">
                <div>
                  <h2 className="font-display text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                    <Plus className="w-4 h-4 text-blue-500" />
                    Конструктор новой роли
                  </h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Создайте специализированную роль (например, Rust Performance Tuner или DevOps Windows).
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-zinc-600 dark:text-zinc-400 mb-1">Название роли</label>
                    <input
                      type="text"
                      required
                      value={roleName}
                      onChange={(e) => setRoleName(e.target.value)}
                      placeholder="Например: Системный оптимизатор"
                      className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-600 dark:text-zinc-400 mb-1">Краткая специализация</label>
                    <input
                      type="text"
                      value={roleTagline}
                      onChange={(e) => setRoleTagline(e.target.value)}
                      placeholder="Профилирование памяти, SIMD и асинхронный Tokio"
                      className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-zinc-600 dark:text-zinc-400 mb-1">Системный промпт роли</label>
                  <textarea
                    rows={3}
                    required
                    value={rolePrompt}
                    onChange={(e) => setRolePrompt(e.target.value)}
                    placeholder="Опишите стиль мышления, формат ответов и приоритеты проверки кода..."
                    className="w-full p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100 resize-none"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-zinc-600 dark:text-zinc-400 mb-1">Режим по умолчанию</label>
                    <select
                      value={roleMode}
                      onChange={(e) => setRoleMode(e.target.value as AgentMode)}
                      className="w-full h-9 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100"
                    >
                      <option value="act">Act (Диффы и терминал)</option>
                      <option value="plan">Plan (Только анализ)</option>
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
                  Создать и активировать роль
                </button>
              </form>
            </div>
          </div>
        )}

        {section === 'permissions' && (
          <div className="space-y-6">
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111114] p-5 space-y-4">
              <div>
                <h2 className="font-display text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  Библиотека разрешений модели
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Политики применяются движком Agent Core перед выполнением каждого действия или команды.
                </p>
              </div>

              <div className="space-y-2.5">
                {permissions.map((rule) => (
                  <div
                    key={rule.id}
                    className="p-3.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-[11px] font-mono text-zinc-500">{rule.category}</div>
                      <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 mt-0.5">
                        {rule.title}
                      </div>
                      <p className="text-[11.5px] text-zinc-500 dark:text-zinc-400 mt-0.5">{rule.description}</p>
                    </div>

                    <div className="inline-flex items-center p-0.5 rounded-lg bg-zinc-200/80 dark:bg-zinc-800 shrink-0">
                      {(
                        [
                          { val: 'allow', label: 'Авто' },
                          { val: 'ask', label: 'Запрос' },
                          { val: 'deny', label: 'Запрет' },
                        ] as { val: PermissionPolicy; label: string }[]
                      ).map((opt) => (
                        <button
                          key={opt.val}
                          type="button"
                          onClick={() => setPermissionPolicy(rule.id, opt.val)}
                          className={cn(
                            'px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors whitespace-nowrap',
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

            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111114] p-5 space-y-4">
              <div>
                <h2 className="font-display text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  Библиотека системных указаний (Directives)
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Включённые директивы автоматически добавляются к системному промпту активной роли.
                </p>
              </div>

              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {directives.map((dir) => (
                  <label
                    key={dir.id}
                    className={cn(
                      'block p-3.5 rounded-xl border cursor-pointer transition-colors',
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
                <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Добавить своё указание</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={dirTitle}
                    onChange={(e) => setDirTitle(e.target.value)}
                    placeholder="Название правила"
                    className="sm:col-span-2 h-8 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs"
                  />
                  <select
                    value={dirCategory}
                    onChange={(e) => setDirCategory(e.target.value as typeof dirCategory)}
                    className="h-8 px-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs"
                  >
                    <option value="Качество кода">Качество кода</option>
                    <option value="Архитектура">Архитектура</option>
                    <option value="Безопасность">Безопасность</option>
                    <option value="Стиль ответа">Стиль ответа</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={dirInstruction}
                    onChange={(e) => setDirInstruction(e.target.value)}
                    placeholder="Текст инструкции для модели..."
                    className="flex-1 h-8 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs"
                  />
                  <button
                    type="submit"
                    disabled={!dirTitle.trim() || !dirInstruction.trim()}
                    className="h-8 px-3 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 disabled:opacity-45 text-xs font-medium whitespace-nowrap"
                  >
                    Добавить
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {section === 'pipeline' && (
          <div className="space-y-6">
            {/* Real Bounded Multi-Agent Orchestrator Runner */}
            <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111114] p-5 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-base font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <Bot className="w-4 h-4 text-blue-500" />
                    <span>Командное выполнение (Manager → Dispatcher → Specialists)</span>
                  </h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                    Ограниченный цикл оркестрации по регламенту team-execution v1.0.0: контракты agent-handoff.v1 и
                    worker-result.v1 проверяются перед завершением каждого шага.
                  </p>
                </div>
                {teamExecutionResult && (
                  <button
                    type="button"
                    onClick={clearTeamExecutionResult}
                    className="h-8 rounded-lg border border-zinc-200 px-3 text-xs text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 whitespace-nowrap"
                  >
                    Очистить отчёт
                  </button>
                )}
              </div>

              <form onSubmit={(e) => void handleRunTeamExecution(e)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                  <div className="md:col-span-6">
                    <label className="block text-[11px] text-zinc-500 mb-1">Целевой проект</label>
                    <select
                      value={selectedTeamProjectId || activeProjectId || ''}
                      onChange={(e) => setSelectedTeamProjectId(e.target.value)}
                      className="w-full h-9 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100"
                    >
                      {projects.length === 0 ? (
                        <option value="">Нет подключённых проектов</option>
                      ) : (
                        projects.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.folderPath})
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                  <div className="md:col-span-3">
                    <label className="block text-[11px] text-zinc-500 mb-1">Макс. циклов (1–4)</label>
                    <input
                      type="number"
                      min={1}
                      max={4}
                      value={teamMaxCycles}
                      onChange={(e) =>
                        setTeamMaxCycles(Math.max(1, Math.min(4, Number(e.target.value) || 1)))
                      }
                      className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 font-mono text-xs tabular-nums text-zinc-900 dark:text-zinc-100"
                    />
                  </div>
                  <div className="md:col-span-3 flex items-end">
                    <button
                      type="submit"
                      disabled={teamExecutionRunning || !teamObjective.trim()}
                      className="w-full h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
                    >
                      {teamExecutionRunning ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Play className="w-3.5 h-3.5" />
                      )}
                      <span>{teamExecutionRunning ? 'Оркестрация…' : 'Запустить команду'}</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-zinc-500 mb-1">Задача для команды агентов</label>
                  <textarea
                    rows={3}
                    required
                    value={teamObjective}
                    onChange={(e) => setTeamObjective(e.target.value)}
                    placeholder="Например: Провести аудит маршрутов API и контрактов валидации, выявить пробелы в проверках и предложить план исправления."
                    className="w-full p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100"
                  />
                </div>

                <div>
                  <div className="text-[11px] text-zinc-500 mb-1.5">Подключаемые роли специалистов</div>
                  <div className="flex flex-wrap gap-2">
                    {SPECIALIST_ROLES.map((spec) => {
                      const active = selectedSpecialistRoles.includes(spec.id);
                      return (
                        <button
                          key={spec.id}
                          type="button"
                          onClick={() => toggleSpecialistRole(spec.id)}
                          aria-pressed={active}
                          className={cn(
                            'h-8 px-3 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap',
                            active
                              ? 'border-blue-500 bg-blue-500/10 text-blue-700 dark:text-blue-300'
                              : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400',
                          )}
                        >
                          {spec.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </form>

              {teamExecutionError && (
                <div
                  role="alert"
                  className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300"
                >
                  {teamExecutionError}
                </div>
              )}

              {teamExecutionResult && (
                <div className="space-y-4 border-t border-zinc-200 pt-4 dark:border-zinc-800">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-3 text-xs">
                      <span
                        className={cn(
                          'rounded-md px-2 py-0.5 font-semibold',
                          teamExecutionResult.status === 'completed'
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                            : 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
                        )}
                      >
                        Статус: {teamExecutionResult.status}
                      </span>
                      <span className="font-mono text-zinc-500 tabular-nums">
                        Риск: {teamExecutionResult.riskLevel} · Циклы: {teamExecutionResult.cyclesExecuted}/
                        {teamExecutionResult.maxCycles} · Задач: {teamExecutionResult.tasks.length}
                      </span>
                    </div>
                    <span className="font-mono text-[10px] text-zinc-400">{teamExecutionResult.operationId}</span>
                  </div>

                  <div className="space-y-2.5">
                    {teamExecutionResult.tasks.map((task) => (
                      <article
                        key={task.taskId}
                        className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/50 space-y-2.5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="font-mono text-[10px] text-zinc-400">
                              Цикл {task.cycle} · {task.taskId}
                            </span>
                            <span className="font-semibold text-zinc-900 dark:text-zinc-100">{task.roleTitle}</span>
                            <span className="rounded bg-zinc-200/70 px-1.5 py-0.5 font-mono text-[10px] text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                              {task.modelTier} · {task.modelName}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[10px]">
                            <span
                              className={
                                task.validationOk
                                  ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                                  : 'text-rose-600 dark:text-rose-400 font-semibold'
                              }
                            >
                              {task.validationOk ? 'Контракт v1 валиден' : 'Ошибка контракта'}
                            </span>
                            <span className="font-mono text-zinc-400 tabular-nums">{task.durationMs} мс</span>
                          </div>
                        </div>

                        <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
                          {task.result.summary}
                        </p>

                        {task.validationErrors.length > 0 && (
                          <div className="rounded-lg border border-rose-300 bg-rose-50/80 p-2 text-[11px] text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
                            {task.validationErrors.join('; ')}
                          </div>
                        )}

                        {task.result.filesInspected.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-zinc-500">
                            <FileCode2 className="h-3 w-3" />
                            {task.result.filesInspected.map((file) => (
                              <code
                                key={file}
                                className="rounded bg-zinc-200/60 px-1.5 py-0.5 font-mono dark:bg-zinc-800"
                              >
                                {file}
                              </code>
                            ))}
                          </div>
                        )}

                        {task.result.checks.length > 0 && (
                          <div className="space-y-1">
                            {task.result.checks.map((chk, idx) => (
                              <div
                                key={`${task.taskId}-chk-${idx}`}
                                className="flex items-center justify-between gap-2 rounded bg-zinc-950 px-2.5 py-1.5 font-mono text-[10px] text-zinc-200"
                              >
                                <span className="inline-flex items-center gap-1.5 truncate">
                                  <Terminal className="h-3 w-3 text-emerald-400 shrink-0" />
                                  {chk.command}
                                </span>
                                <span
                                  className={
                                    chk.status === 'passed' ? 'text-emerald-400 shrink-0' : 'text-amber-400 shrink-0'
                                  }
                                >
                                  {chk.status} (exit {chk.exitCode ?? '—'})
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        {task.result.findings.length > 0 && (
                          <div className="space-y-1">
                            {task.result.findings.map((finding, idx) => (
                              <div
                                key={`${task.taskId}-f-${idx}`}
                                className="rounded border border-zinc-200 bg-white px-2.5 py-2 text-[11px] dark:border-zinc-800 dark:bg-zinc-950"
                              >
                                <span className="font-mono uppercase text-[10px] text-amber-600 dark:text-amber-400">
                                  [{finding.severity}]
                                </span>{' '}
                                <span className="text-zinc-800 dark:text-zinc-200">{finding.statement}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </article>
                    ))}
                  </div>

                  {teamExecutionResult.unresolvedQuestions.length > 0 && (
                    <div className="rounded-lg border border-amber-300/70 bg-amber-50/70 p-3 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200 space-y-1">
                      <div className="font-semibold inline-flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Открытые вопросы:
                      </div>
                      <ul className="list-disc ml-5 space-y-0.5">
                        {teamExecutionResult.unresolvedQuestions.map((q, idx) => (
                          <li key={idx}>{q}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-2">
                    <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      Итоговый отчёт Manager Reconciliation
                    </div>
                    <pre className="whitespace-pre-wrap break-words font-sans text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">
                      {teamExecutionResult.finalReport}
                    </pre>
                  </div>
                </div>
              )}
            </section>

            {/* Pipeline Config Bar */}
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111114] p-4 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
                <div>
                  <label className="block text-[11px] text-zinc-500 mb-1">Целевой проект</label>
                  <input
                    type="text"
                    value={pipelineProjectName}
                    onChange={(e) => setPipelineConfig(e.target.value, pipelineStack)}
                    className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs font-medium text-zinc-900 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-zinc-500 mb-1">Технологический стек</label>
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
                  className="h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-300 inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Сбросить</span>
                </button>
                <button
                  type="button"
                  disabled={pipelineRunning}
                  onClick={runFullPipeline}
                  className="h-9 px-4 rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 disabled:opacity-50 text-white text-xs font-medium inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>{pipelineRunning ? 'Выполняется пайплайн...' : 'Запустить пайплайн'}</span>
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
                                ? 'Готово'
                                : stage.status === 'error'
                                  ? 'Ошибка'
                                  : stage.status === 'running'
                                    ? 'В работе...'
                                    : 'Ожидание'}
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
                            Роль: {stageRole.name}
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
                  <span>Этап 0{selectedStage.stepNumber}</span>
                  <span>·</span>
                  <span>Режим {selectedStage.mode.toUpperCase()}</span>
                  <span>·</span>
                  <span>Артефакт: {selectedStage.outputArtifact}</span>
                </div>
                <h3 className="font-display text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  {selectedStage.title}
                </h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">{selectedStage.shortGoal}</p>
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
                    Назначенная роль модели для этого шага
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
                    className="h-9 px-3.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Выполнить этот шаг</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveRole(selectedStage.assignedRoleId);
                      setActiveTab('workstation');
                      sendPrompt(
                        `Выполни этап «${selectedStage.title}» для проекта ${pipelineProjectName} (${pipelineStack}): ${selectedStage.shortGoal}`,
                      );
                    }}
                    className="h-9 px-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:border-blue-500 text-xs font-medium text-zinc-700 dark:text-zinc-200 whitespace-nowrap"
                  >
                    Открыть в чате агента
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </PageContent>
    </PageLayout>
  );
};
