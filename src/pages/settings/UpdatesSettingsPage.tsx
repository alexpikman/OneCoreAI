import React from 'react';
import { Download, ExternalLink, RefreshCw } from 'lucide-react';
import { PageContent } from '../../components/layout/PageContent';
import { PageHeader } from '../../components/layout/PageHeader';
import { PageLayout } from '../../components/layout/StandardPageLayout';
import { useOneCoreStore } from '../../store/useOneCoreStore';
import { APP_VERSION } from '../../utils/appUpdates';
import { cn } from '../../utils/cn';
import { getPageUiTokens } from '../../utils/uiStyle';

export const UpdatesSettingsPage: React.FC = () => {
  const { uiStyle, latestUpdate, updateCheckStatus, updateCheckError, checkForUpdates } = useOneCoreStore();
  const tokens = getPageUiTokens(uiStyle);

  return (
    <PageLayout>
      <PageHeader>
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
            <RefreshCw className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <h1 className="text-xl font-semibold">Обновления</h1>
          </div>
        </div>
      </PageHeader>
      <PageContent contentClassName="space-y-5 py-6">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Текущая версия: <span className="font-mono">v{APP_VERSION}</span>
        </p>
        <div className={cn('p-6 border space-y-4', tokens.cardRadius, tokens.cardBg, tokens.cardBorder)}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Доступные обновления
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                Проверка выполняется по публичным GitHub Releases без API-ключа.
              </p>
            </div>
            <button
              type="button"
              disabled={updateCheckStatus === 'checking'}
              onClick={() => void checkForUpdates()}
              className={cn(
                'h-9 px-3.5 border text-xs font-medium inline-flex items-center gap-2 transition-colors disabled:opacity-50 whitespace-nowrap',
                tokens.cardRadius,
                tokens.accentButton,
              )}
            >
              <RefreshCw className={cn('w-3.5 h-3.5', updateCheckStatus === 'checking' && 'animate-spin')} />
              <span>{updateCheckStatus === 'checking' ? 'Проверяем…' : 'Проверить обновления'}</span>
            </button>
          </div>

          {updateCheckStatus === 'error' && (
            <div className="p-3 border border-rose-500/30 bg-rose-500/5 text-xs text-rose-700 dark:text-rose-300">
              {updateCheckError || 'Не удалось проверить обновления.'}
            </div>
          )}

          {updateCheckStatus === 'current' && (
            <div className="p-3 border border-emerald-500/30 bg-emerald-500/5 text-xs text-emerald-700 dark:text-emerald-300">
              Установлена последняя версия{latestUpdate ? ` (v${latestUpdate.version})` : ''}.
            </div>
          )}

          {latestUpdate?.isNewer && (
            <div className="p-4 border border-blue-500/30 bg-blue-500/5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    Доступна версия v{latestUpdate.version}
                  </div>
                  {latestUpdate.publishedAt && (
                    <div className="text-[11px] text-zinc-500 mt-0.5">
                      Опубликована {new Date(latestUpdate.publishedAt).toLocaleDateString()}
                    </div>
                  )}
                </div>
                <a
                  href={latestUpdate.downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    'h-9 px-3.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap',
                    tokens.cardRadius,
                  )}
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Скачать установщик</span>
                </a>
              </div>
              {latestUpdate.notes && (
                <p className="text-xs text-zinc-600 dark:text-zinc-300 whitespace-pre-wrap line-clamp-8">
                  {latestUpdate.notes}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <a
                  href={latestUpdate.releaseUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                >
                  Примечания к релизу <ExternalLink className="w-3 h-3" />
                </a>
                <span className="text-[11px] text-zinc-500">
                  Установку нужно подтвердить в загруженном установщике. Фоновая автоустановка требует подписи обновлений.
                </span>
              </div>
            </div>
          )}

          {updateCheckStatus === 'idle' && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Проверка версии запускается автоматически при старте приложения.
            </p>
          )}
        </div>
      </PageContent>
    </PageLayout>
  );
};
