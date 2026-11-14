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
