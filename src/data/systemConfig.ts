export interface SystemConfig {
  providerRequestTimeoutMs: number;
  providerStreamIdleTimeoutMs: number;
  agentOperationTimeoutMs: number;
  modelFallbackAttempts: number;
  maxToolRounds: number;
  maxToolCalls: number;
}

export const DEFAULT_SYSTEM_CONFIG: SystemConfig = {
  providerRequestTimeoutMs: 30000,
  providerStreamIdleTimeoutMs: 60000,
  agentOperationTimeoutMs: 120000,
  modelFallbackAttempts: 5,
  maxToolRounds: 6,
  maxToolCalls: 12,
};

export function normalizeSystemConfig(value: unknown): SystemConfig {
  const input = value && typeof value === 'object' ? value as Partial<SystemConfig> : {};
  const bounded = (candidate: unknown, fallback: number, min: number, max: number) =>
    typeof candidate === 'number' && Number.isInteger(candidate)
      ? Math.max(min, Math.min(max, candidate))
      : fallback;
  return {
    providerRequestTimeoutMs: bounded(input.providerRequestTimeoutMs, DEFAULT_SYSTEM_CONFIG.providerRequestTimeoutMs, 1000, 300000),
    providerStreamIdleTimeoutMs: bounded(input.providerStreamIdleTimeoutMs, DEFAULT_SYSTEM_CONFIG.providerStreamIdleTimeoutMs, 1000, 300000),
    agentOperationTimeoutMs: bounded(input.agentOperationTimeoutMs, DEFAULT_SYSTEM_CONFIG.agentOperationTimeoutMs, 5000, 600000),
    modelFallbackAttempts: bounded(input.modelFallbackAttempts, DEFAULT_SYSTEM_CONFIG.modelFallbackAttempts, 1, 10),
    maxToolRounds: bounded(input.maxToolRounds, DEFAULT_SYSTEM_CONFIG.maxToolRounds, 1, 20),
    maxToolCalls: bounded(input.maxToolCalls, DEFAULT_SYSTEM_CONFIG.maxToolCalls, 1, 100),
  };
}
