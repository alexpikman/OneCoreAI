import express from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { createApiApp } from './server/app';
import { flushAgentJournal } from './server/agentJournal';
import { stopLlamaCppServer } from './server/llamaCppRuntime';

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);

function resolvePort(): number {
  const envPort = Number(process.env.PORT);
  if (Number.isInteger(envPort) && envPort > 0 && envPort <= 65535) {
    return envPort;
  }
  const portFlagIndex = process.argv.indexOf('--port');
  if (portFlagIndex >= 0) {
    const cliPort = Number(process.argv[portFlagIndex + 1]);
    if (Number.isInteger(cliPort) && cliPort > 0 && cliPort <= 65535) {
      return cliPort;
    }
  }
  return 3000;
}

function resolveDistPath(appRoot: string): string {
  const candidates = [
    path.resolve(appRoot, 'dist'),
    ...(typeof __dirname === 'string' ? [path.resolve(__dirname)] : []),
    path.resolve(process.cwd(), 'dist'),
  ];
  return (
    candidates.find((candidate) => fs.existsSync(path.join(candidate, 'index.html'))) ??
    candidates[0]
  );
}

async function startServer() {
  const appRoot = process.env.ONECORE_APP_ROOT?.trim() || process.cwd();
  const app = createApiApp(appRoot);
  const PORT = resolvePort();
  const requestedHost = process.env.HOST?.trim() || '';
  const backendOnly = process.env.ONECORE_BACKEND_ONLY === 'true';
  const strictLoopback = process.env.ONECORE_STRICT_LOOPBACK === 'true';
  const isBundledBackend =
    typeof __filename === 'string' && path.basename(__filename) === 'backend.cjs';
  const isProduction =
    process.env.NODE_ENV === 'production' ||
    process.argv.includes('--production') ||
    isBundledBackend;

  const httpServer = http.createServer(app);
  let closeViteServer: (() => Promise<void>) | undefined;

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
    const distPath = resolveDistPath(appRoot);
    app.use(express.static(distPath));
    app.get('*', (req, res, next) => {
      if (req.path === '/api' || req.path.startsWith('/api/')) {
        next();
        return;
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const normalizedRequestedHost = requestedHost.toLowerCase();
  const explicitPublicHost =
    requestedHost &&
    normalizedRequestedHost !== '0.0.0.0' &&
    normalizedRequestedHost !== '::' &&
    !LOOPBACK_HOSTS.has(normalizedRequestedHost)
      ? requestedHost
      : undefined;
  const targetHost =
    backendOnly || strictLoopback
      ? requestedHost || '127.0.0.1'
      : explicitPublicHost;

  let retriedIpv4Fallback = false;
  httpServer.on('error', (error: NodeJS.ErrnoException) => {
    if (
      !retriedIpv4Fallback &&
      targetHost === undefined &&
      (error.code === 'EAFNOSUPPORT' || error.code === 'EADDRNOTAVAIL')
    ) {
      retriedIpv4Fallback = true;
      httpServer.listen(PORT, '0.0.0.0');
      return;
    }
    console.error('ONE CORE AI HTTP server error:', error);
    process.exitCode = 1;
  });

  const onListening = () => {
    const address = httpServer.address();
    const actualPort = address && typeof address === 'object' ? address.port : PORT;
    console.log(`ONE CORE AI server listening on http://localhost:${actualPort}`);
  };

  if (targetHost) {
    httpServer.listen(PORT, targetHost, onListening);
  } else {
    httpServer.listen(PORT, onListening);
  }

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
