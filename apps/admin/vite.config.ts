import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { createLogger, defineConfig, loadEnv } from 'vite';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const apiUnavailableProblem = JSON.stringify({
  type: 'urn:better-commerce:problem:admin-api-unavailable',
  title: 'Commerce API unavailable',
  status: 503,
  detail:
    'The Admin cannot reach the Commerce API. Start the local dependencies and API, then try again.',
  code: 'admin.api_unavailable',
});

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, currentDirectory, '');
  const apiProxyTarget =
    environment.VITE_API_PROXY_TARGET ??
    'http://127.0.0.1:3000';
  const logger = createLogger();
  const logError = logger.error.bind(logger);
  let apiUnavailable = false;

  logger.error = (message, options) => {
    if (message.includes('http proxy error:')) {
      if (!apiUnavailable) {
        apiUnavailable = true;
        logger.warn(
          `[admin] Commerce API is unavailable at ${apiProxyTarget}. Start the API and its local dependencies with "pnpm db:up". Repeated connection errors are suppressed.`,
        );
      }
      return;
    }

    logError(message, options);
  };

  return {
    base: '/admin/',
    customLogger: logger,
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(currentDirectory, 'src'),
      },
    },
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true,
          configure(proxy) {
            proxy.on('proxyRes', () => {
              if (!apiUnavailable) return;
              apiUnavailable = false;
              logger.info('[admin] Commerce API connection restored.');
            });
            proxy.on('error', (_error, _request, response) => {
              if (
                !('req' in response) ||
                response.headersSent ||
                response.writableEnded
              )
                return;

              response
                .writeHead(503, {
                  'Cache-Control': 'no-store',
                  'Content-Type': 'application/problem+json; charset=utf-8',
                })
                .end(apiUnavailableProblem);
            });
          },
        },
      },
    },
  };
});
