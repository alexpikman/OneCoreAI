import React, { useMemo, useState } from 'react';
import { Check, Copy, Download, Loader2, MessageCircle, RefreshCw } from 'lucide-react';
import { PageContent } from '../../components/layout/PageContent';
import { PageHeader } from '../../components/layout/PageHeader';
import { PageLayout } from '../../components/layout/StandardPageLayout';
import { buildGatewayStartScript } from '../../data/oneCoreSeed';
import { useOneCoreStore } from '../../store/useOneCoreStore';
import { cn } from '../../utils/cn';
import { getPageUiTokens } from '../../utils/uiStyle';

export const GatewayPage: React.FC = () => {
  const {
    uiStyle,
    freeProviders,
    activeProviderId,
    executionEnv,
    gateways,
    updateGateway,
    verifyTelegramGateway,
    gatewayPlatform,
    setGatewayPlatform,
  } = useOneCoreStore();

  const tokens = getPageUiTokens(uiStyle);
  const activeProvider = freeProviders.find((p) => p.id === activeProviderId) ?? freeProviders[0];
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const activeGateway = gateways.find((g) => g.id === gatewayPlatform) ?? gateways[0];
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

  return (
    <PageLayout>
      <PageHeader>
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
            <MessageCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <h1 className="text-xl font-semibold">Шлюз мессенджеров</h1>
          </div>
        </div>
      </PageHeader>
      <PageContent contentClassName="space-y-5 py-6">
        <div className="mx-auto w-full max-w-4xl space-y-5">
          <div className={cn('p-6 border space-y-5', tokens.cardRadius, tokens.cardBg, tokens.cardBorder)}>
            <div>
              <h2 className="font-display text-lg font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-blue-500" />
                <span>Шлюз мессенджеров (Telegram, Discord, Slack)</span>
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Управляйте агентом ONE CORE AI с телефона или командных чатов без платных шлюзов и ограничений.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {gateways.map((gw) => (
                <button
                  key={gw.id}
                  type="button"
                  onClick={() => setGatewayPlatform(gw.id)}
                  className={cn(
                    'p-3 border text-left transition-colors',
                    tokens.cardRadius,
                    gatewayPlatform === gw.id
                      ? tokens.activeHighlight
                      : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/60',
                  )}
                >
                  <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">{gw.name}</div>
                  <div className="text-[11px] font-mono text-zinc-500 mt-0.5">
                    {gw.enabled ? 'Включён' : 'Отключён'} · {gw.prefixCommand}
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
                    <span>Активировать шлюз {activeGateway.name}</span>
                  </label>

                  {activeGateway.id === 'telegram' && (
                    <button
                      type="button"
                      onClick={() => verifyTelegramGateway()}
                      disabled={activeGateway.status === 'checking'}
                      className={cn(
                        'h-8 px-3 text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap',
                        tokens.inputRadius,
                        tokens.accentButton,
                      )}
                    >
                      {activeGateway.status === 'checking' ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3.5 h-3.5" />
                      )}
                      <span>Проверить токен в Telegram API</span>
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
                      placeholder={activeGateway.id === 'telegram' ? '123456789:AAH...' : 'Токен бота...'}
                      className={cn(
                        'w-full h-9 px-3 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 font-mono text-xs',
                        tokens.inputRadius,
                      )}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-zinc-500 mb-1">
                      Разрешённые User / Chat ID (через запятую)
                    </label>
                    <input
                      type="text"
                      value={activeGateway.allowedChatIds}
                      onChange={(e) => updateGateway(activeGateway.id, { allowedChatIds: e.target.value })}
                      placeholder="Например: 123456789, 987654321"
                      className={cn(
                        'w-full h-9 px-3 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 font-mono text-xs',
                        tokens.inputRadius,
                      )}
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
                    <span>Требовать подтверждение в чате перед записью файлов</span>
                  </label>
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={activeGateway.autoReplyVoiceNotes}
                      onChange={(e) => updateGateway(activeGateway.id, { autoReplyVoiceNotes: e.target.checked })}
                      className="accent-blue-600"
                    />
                    <span>Распознавать голосовые заметки (Whisper local)</span>
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
                    <span>{copiedId === 'gw-ps1' ? 'Скопировано' : 'Копировать'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadFile('Start-OneCore-Gateway.ps1', gatewayScript)}
                    className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-100 inline-flex items-center gap-1 text-[11px]"
                  >
                    <Download className="w-3 h-3" />
                    <span>Скачать</span>
                  </button>
                </div>
              </div>
              <pre className="font-mono text-[11px] leading-5 overflow-x-auto">{gatewayScript}</pre>
            </div>
          </div>
        </div>
      </PageContent>
    </PageLayout>
  );
};
