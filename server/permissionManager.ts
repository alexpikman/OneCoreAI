import { getProjectById } from './projectsManager';

export type ProjectTool = 'read_file' | 'write_file' | 'run_command' | 'git' | 'search_code';

const LEGACY_DEFAULT_TOOLS: ProjectTool[] = [
  'read_file',
  'write_file',
  'run_command',
  'git',
  'search_code',
];

export function isProjectToolAllowed(projectId: string, tool: ProjectTool): boolean {
  const project = getProjectById(projectId);
  if (!project) return false;

  const allowedTools = Array.isArray(project.allowedTools)
    ? project.allowedTools
    : LEGACY_DEFAULT_TOOLS;

  return allowedTools.includes(tool);
}

export function assertProjectToolAllowed(projectId: string, tool: ProjectTool): void {
  if (!isProjectToolAllowed(projectId, tool)) {
    throw new Error(`Инструмент ${tool} отключён в разрешениях проекта.`);
  }
}

export function hasExplicitApproval(value: unknown): boolean {
  return value === true;
}

export type SideEffectPermissionScope =
  | 'model.download'
  | 'model.manage'
  | 'filesystem.create-directory'
  | 'project.delete'
  | 'ssh.connect'
  | 'browser.network'
  | 'github.verify'
  | 'gateway.verify'
  | 'project.file.write'
  | 'project.terminal'
  | 'project.git.mutate'
  | 'project.undo'
  | 'agent.team-run';

export interface PermissionDecision {
  allowed: boolean;
  actor: 'local-user' | 'unconfirmed';
  scope: SideEffectPermissionScope;
  resource: string;
  decidedAt: string;
}

export function evaluateSideEffectApproval(input: {
  approved: unknown;
  scope: SideEffectPermissionScope;
  resource: string;
}): PermissionDecision {
  const allowed = input.approved === true;
  const decision: PermissionDecision = {
    allowed,
    actor: allowed ? 'local-user' : 'unconfirmed',
    scope: input.scope,
    resource: input.resource.slice(0, 180),
    decidedAt: new Date().toISOString(),
  };
  return decision;
}
