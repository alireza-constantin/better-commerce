import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

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

  return {
    base: '/admin/',
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
