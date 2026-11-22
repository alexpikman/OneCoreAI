import express from 'express';
import http from 'http';
import path from 'path';
import { createApiApp } from './server/app';
import { flushAgentJournal } from './server/agentJournal';
import { stopLlamaCppServer } from './server/llamaCppRuntime';

async function startServer() {
  const appRoot = process.env.ONECORE_APP_ROOT?.trim() || process.cwd();
  const app = createApiApp(appRoot);
  const PORT = Number(process.env.PORT) || 3000;
  const HOST = process.env.HOST?.trim() || '0.0.0.0';
  const httpServer = http.createServer(app);
  let closeViteServer: (() => Promise<void>) | undefined;
  const isProduction = process.env.NODE_ENV === 'production' || process.argv.includes('--production');
  const backendOnly = process.env.ONECORE_BACKEND_ONLY === 'true';

  if (!isProduction) {
    if (process.env.DISABLE_HMR === 'true') {
      app.get('/@vite/client', (_req, res) => {
        res.type('application/javascript').send(
          `const sheetsMap = new Map();
export const createHotContext = () => ({ accept() {}, dispose() {}, prune() {}, invalidate() {}, decline() {}, on() {}, off() {}, send() {} });
export const injectQuery = (u) => u;
export const updateStyle = (id, content) => {
  let style = sheetsMap.get(id);
  if (!style) {
    style = document.createElement('style');
    style.setAttribute('type', 'text/css');
    style.setAttribute('data-vite-dev-id', id);
    style.textContent = content;
    document.head.appendChild(style);
    sheetsMap.set(id, style);
  } else {
    style.textContent = content;
  }
};
export const removeStyle = (id) => {
  const style = sheetsMap.get(id);
  if (style) {
    document.head.removeChild(style);
    sheetsMap.delete(id);
  }
};`,
        );
      });
    }

    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : { server: httpServer },
        ws: process.env.DISABLE_HMR === 'true' ? false : { server: httpServer },
      },
      appType: 'spa',
    });
    closeViteServer = () => vite.close();
    app.use(vite.middlewares);
  } else if (!backendOnly) {
    const distPath = path.resolve(appRoot, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, HOST, () => {
    const address = httpServer.address();
    const actualPort = address && typeof address === 'object' ? address.port : PORT;
    console.log(`ONE CORE AI server listening on http://localhost:${actualPort}`);
  });

  let shuttingDown = false;
  const shutdown = async (exitCode: number) => {
    if (shuttingDown) return;
    shuttingDown = true;

    httpServer.close();
    httpServer.closeAllConnections();

    try {
      await closeViteServer?.();
    } catch (error) {
      console.error('Failed to close Vite during shutdown:', error);
    }

    try {
      await stopLlamaCppServer();
      await flushAgentJournal();
      process.exitCode = exitCode;
    } catch (error) {
      console.error('Failed to stop local runtimes or flush the agent journal during shutdown:', error);
      process.exitCode = 1;
    }
  };

  process.once('SIGINT', () => {
    void shutdown(130);
  });
  process.once('SIGTERM', () => {
    void shutdown(0);
  });
}

startServer();
