export interface ModelMetricsSnapshot {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  fallbackRequests: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  averageLatencyMs: number | null;
  maxLatencyMs: number | null;
  lastRequestAt: string | null;
  lastError: string | null;
  startedAt: string;
}

const startedAt = new Date().toISOString();
let totalRequests = 0;
let successfulRequests = 0;
let failedRequests = 0;
let fallbackRequests = 0;
let totalPromptTokens = 0;
let totalCompletionTokens = 0;
let totalLatencyMs = 0;
let maxLatencyMs: number | null = null;
let lastRequestAt: string | null = null;
let lastError: string | null = null;

export function recordModelRequest(input: {
  success: boolean;
  latencyMs: number;
  fallback?: boolean;
  promptTokens?: number | null;
  completionTokens?: number | null;
  error?: string;
}): void {
  totalRequests += 1;
  if (input.success) successfulRequests += 1;
  else failedRequests += 1;
  if (input.fallback) fallbackRequests += 1;
  if (Number.isFinite(input.latencyMs) && input.latencyMs >= 0) {
    totalLatencyMs += input.latencyMs;
    maxLatencyMs = Math.max(maxLatencyMs ?? 0, input.latencyMs);
  }
  if (typeof input.promptTokens === 'number' && Number.isFinite(input.promptTokens)) totalPromptTokens += input.promptTokens;
  if (typeof input.completionTokens === 'number' && Number.isFinite(input.completionTokens)) totalCompletionTokens += input.completionTokens;
  lastRequestAt = new Date().toISOString();
  if (input.error) lastError = input.error.slice(0, 300);
}

export function getModelMetrics(): ModelMetricsSnapshot {
  return {
    totalRequests,
    successfulRequests,
    failedRequests,
    fallbackRequests,
    totalPromptTokens,
    totalCompletionTokens,
    averageLatencyMs: totalRequests ? Math.round(totalLatencyMs / totalRequests) : null,
    maxLatencyMs,
    lastRequestAt,
    lastError,
    startedAt,
  };
}
