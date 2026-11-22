export type ModelTier = 'lightweight' | 'standard' | 'strong';

export interface RoleCapabilityContract {
  roleKey: string;
  knowledgeDocId: string;
  uiRoleId: string;
  title: string;
  readOnly: boolean;
  modelTier: ModelTier;
  allowedCapabilities: string[];
}

export const ROLE_CONTRACTS: Record<string, RoleCapabilityContract> = {
  coordinator: {
    roleKey: 'coordinator',
    knowledgeDocId: 'role.coordinator',
    uiRoleId: 'role-architect',
    title: 'Координатор',
    readOnly: true,
    modelTier: 'standard',
    allowedCapabilities: ['read_file', 'search_code', 'list_files', 'read_knowledge'],
  },
  manager: {
    roleKey: 'manager',
    knowledgeDocId: 'role.manager',
    uiRoleId: 'role-architect',
    title: 'Менеджер',
    readOnly: true,
    modelTier: 'strong',
    allowedCapabilities: ['read_file', 'search_code', 'list_files', 'read_knowledge', 'approve_graph'],
  },
  dispatcher: {
    roleKey: 'dispatcher',
    knowledgeDocId: 'role.dispatcher',
    uiRoleId: 'role-architect',
    title: 'Диспетчер',
    readOnly: true,
    modelTier: 'lightweight',
    allowedCapabilities: ['read_file', 'search_code', 'list_files', 'read_knowledge', 'decompose_tasks'],
  },
  researcher: {
    roleKey: 'researcher',
    knowledgeDocId: 'role.researcher',
    uiRoleId: 'role-reviewer',
    title: 'Исследователь',
    readOnly: true,
    modelTier: 'lightweight',
    allowedCapabilities: ['read_file', 'search_code', 'list_files', 'read_knowledge'],
  },
  analyst: {
    roleKey: 'analyst',
    knowledgeDocId: 'role.analyst',
    uiRoleId: 'role-reviewer',
    title: 'Аналитик',
    readOnly: true,
    modelTier: 'standard',
    allowedCapabilities: ['read_file', 'search_code', 'list_files', 'read_knowledge'],
  },
  architect: {
    roleKey: 'architect',
    knowledgeDocId: 'role.architect',
    uiRoleId: 'role-architect',
    title: 'Архитектор',
    readOnly: true,
    modelTier: 'strong',
    allowedCapabilities: ['read_file', 'search_code', 'list_files', 'read_knowledge'],
  },
  developer: {
    roleKey: 'developer',
    knowledgeDocId: 'role.developer',
    uiRoleId: 'role-developer',
    title: 'Разработчик',
    readOnly: false,
    modelTier: 'strong',
    allowedCapabilities: ['read_file', 'search_code', 'list_files', 'read_knowledge', 'write_file_proposal', 'run_command_proposal'],
  },
  coder: {
    roleKey: 'coder',
    knowledgeDocId: 'role.coder',
    uiRoleId: 'role-developer',
    title: 'Кодер',
    readOnly: false,
    modelTier: 'standard',
    allowedCapabilities: ['read_file', 'search_code', 'list_files', 'read_knowledge', 'write_file_proposal'],
  },
  tester: {
    roleKey: 'tester',
    knowledgeDocId: 'role.tester',
    uiRoleId: 'role-qa',
    title: 'Тестировщик',
    readOnly: true,
    modelTier: 'standard',
    allowedCapabilities: ['read_file', 'search_code', 'list_files', 'read_knowledge', 'run_command_proposal'],
  },
  qa: {
    roleKey: 'qa',
    knowledgeDocId: 'role.qa',
    uiRoleId: 'role-qa',
    title: 'QA-инженер',
    readOnly: true,
    modelTier: 'strong',
    allowedCapabilities: ['read_file', 'search_code', 'list_files', 'read_knowledge', 'run_command_proposal'],
  },
};

export function resolveRoleContract(roleInput: string): RoleCapabilityContract {
  const normalized = roleInput.trim().toLowerCase().replace(/^role[.-]/, '');
  if (normalized === 'reviewer') return ROLE_CONTRACTS.analyst;
  return ROLE_CONTRACTS[normalized] ?? ROLE_CONTRACTS.analyst;
}

export function intersectCapabilities(projectAllowedTools: string[], contract: RoleCapabilityContract): string[] {
  const projectSet = new Set(projectAllowedTools);
  return contract.allowedCapabilities.filter((cap) => {
    if (cap === 'list_files' || cap === 'read_file') return projectSet.has('read_file');
    if (cap === 'search_code') return projectSet.has('search_code') && projectSet.has('read_file');
    if (cap === 'write_file_proposal') return !contract.readOnly && projectSet.has('write_file');
    if (cap === 'run_command_proposal') return projectSet.has('run_command');
    if (cap === 'read_knowledge' || cap === 'approve_graph' || cap === 'decompose_tasks') return true;
    return projectSet.has(cap);
  });
}
