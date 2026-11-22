import { readAppSettings } from '../settingsManager';
import { execProjectCommand } from '../projectAgent';
import { isProjectToolAllowed } from '../permissionManager';
import { recordAgentEvent } from '../agentJournal';
import type { AppHookConfig, AppHookEvent } from '../../src/types/onecore';

export interface HookExecutionOutcome {
  hookId: string;
  name: string;
  event: AppHookEvent;
  command: string;
  executed: boolean;
  exitCode: number | null;
  output: string;
  error?: string;
}

export async function runLifecycleHooks(input: {
  event: AppHookEvent;
  projectId: string;
  signal?: AbortSignal;
}): Promise<HookExecutionOutcome[]> {
  const manifest = await readAppSettings();
  const configuredHooks: AppHookConfig[] = Array.isArray(manifest?.settings.hooks) ? manifest!.settings.hooks : [];
  const matching = configuredHooks.filter((hook) => hook.enabled && hook.event === input.event && hook.command.trim());
  if (matching.length === 0) return [];

  const outcomes: HookExecutionOutcome[] = [];
  if (!isProjectToolAllowed(input.projectId, 'run_command')) {
    for (const hook of matching) {
      const error = 'В разрешениях проекта отключён запуск команд (run_command), hook пропущен.';
      recordAgentEvent({
        category: 'system',
        level: 'warning',
        status: 'failed',
        title: `Hook «${hook.name}» заблокирован`,
        summary: error,
        source: 'hook-runner',
        projectId: input.projectId,
        details: { hookId: hook.id, event: hook.event },
      });
      outcomes.push({
        hookId: hook.id,
        name: hook.name,
        event: hook.event,
        command: hook.command,
        executed: false,
        exitCode: null,
        output: '',
        error,
      });
    }
    return outcomes;
  }

  for (const hook of matching) {
    if (input.signal?.aborted) break;
    try {
      const result = await execProjectCommand(
        input.projectId,
        hook.command,
        Math.min(Math.max(hook.timeoutMs ?? 15000, 1000), 60000),
        input.signal,
      );
      const combinedOutput = [result.stdout, result.stderr].filter(Boolean).join('\n').slice(0, 1000);
      recordAgentEvent({
        category: 'terminal',
        level: result.exitCode === 0 ? 'info' : 'error',
        status: result.exitCode === 0 ? 'completed' : 'failed',
        title: `Hook «${hook.name}» (${hook.event})`,
        summary: result.exitCode === 0 ? `Выполнен за ${result.durationMs} мс` : `Завершился с кодом ${result.exitCode}`,
        source: 'hook-runner',
        projectId: input.projectId,
        durationMs: result.durationMs,
        details: { hookId: hook.id, event: hook.event, exitCode: result.exitCode },
      });
      outcomes.push({
        hookId: hook.id,
        name: hook.name,
        event: hook.event,
        command: hook.command,
        executed: true,
        exitCode: result.exitCode,
        output: combinedOutput,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Ошибка выполнения hook';
      outcomes.push({
        hookId: hook.id,
        name: hook.name,
        event: hook.event,
        command: hook.command,
        executed: false,
        exitCode: null,
        output: '',
        error: message,
      });
    }
  }

  return outcomes;
}
