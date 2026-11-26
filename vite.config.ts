import { defineConfig, loadEnv, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const devSwCleanupPlugin = (): Plugin => ({
  name: 'dev-sw-cleanup',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const reqUrl = (req as { url?: string }).url || '';
      const urlPath = reqUrl.split('?')[0];
      if (urlPath === '/sw.js' || urlPath === '/dev-sw.js') {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.end(
          "self.addEventListener('install', () => self.skipWaiting());\n" +
          "self.addEventListener('activate', (e) => {\n" +
          "  e.waitUntil((async () => {\n" +
          "    const keys = await caches.keys();\n" +
          "    await Promise.all(keys.map(k => caches.delete(k)));\n" +
          "    await self.registration.unregister();\n" +
          "  })());\n" +
          "});\n"
        );
        return;
      }
      if (urlPath === '/registerSW.js') {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.end(
          "if ('serviceWorker' in navigator) {\n" +
          "  navigator.serviceWorker.getRegistrations().then((regs) => Promise.all(regs.map((r) => r.unregister()))).catch(() => {});\n" +
          "}\n"
        );
        return;
      }
      if ((urlPath.startsWith('/assets/') || /^\/workbox-/.test(urlPath)) && /\.(js|mjs|css|map)$/.test(urlPath)) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end('Not found in dev server');
        return;
      }
      next();
    });
  }
});

/**
 * Determina automaticamente il base path di Vite:
 * - Locale (dev / preview / build locale): '/'
 * - GitHub Actions (GitHub Pages): '/<nome-repository>/' (oppure '/' per repository <owner>.github.io)
 * - Override manuale opzionale tramite variabile d'ambiente VITE_BASE_PATH
 */
const resolveBasePath = (env: Record<string, string | undefined>): string => {
  const customBase = env.VITE_BASE_PATH?.trim();
  if (customBase) {
    if (customBase === '/' || customBase === './') return customBase;
    return `/${customBase.replace(/^\/+|\/+$/g, '')}/`;
  }

  const isGitHubActions = env.GITHUB_ACTIONS === 'true';
  const githubRepository = env.GITHUB_REPOSITORY?.trim();

  if (isGitHubActions && githubRepository && githubRepository.includes('/')) {
    const [owner, repoName] = githubRepository.split('/');
    if (repoName && owner && repoName.toLowerCase() === `${owner.toLowerCase()}.github.io`) {
      return '/';
    }
    if (repoName) {
      return `/${repoName}/`;
    }
  }

  return '/';
};

export default defineConfig(({ mode }) => {
  const fileEnv = loadEnv(mode, '.', '');
  const runtimeEnv =
    (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
  const mergedEnv: Record<string, string | undefined> = { ...fileEnv, ...runtimeEnv };
  const basePath = resolveBasePath(mergedEnv);

  return {
    base: basePath,
    plugins: [
      devSwCleanupPlugin(),
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        includeAssets: [
          'favicon.ico',
          'favicon.svg',
          'icon.svg',
          'apple-touch-icon.png',
          'favicon-16x16.png',
          'favicon-32x32.png',
          'pwa-64x64.png',
          'pwa-192x192.png',
          'pwa-512x512.png',
          'pwa-maskable-192x192.png',
          'pwa-maskable-512x512.png'
        ],
        devOptions: {
          enabled: false
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          navigateFallback: 'index.html',
          navigateFallbackDenylist: [/\/assets\//, /\/[^/?]+\.[^/]+$/],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'magiclass-google-fonts-css',
                expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }
              }
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'magiclass-google-fonts-files',
                expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
                cacheableResponse: { statuses: [0, 200] }
              }
            }
          ]
        },
        manifest: {
          id: basePath,
          name: 'MagiClass',
          short_name: 'MagiClass',
          description: 'Diario scolastico locale e offline per docenti.',
          lang: 'it',
          theme_color: '#810027',
          background_color: '#f3ede1',
          display: 'standalone',
          orientation: 'any',
          start_url: basePath,
          scope: basePath,
          icons: [
            {
              src: `${basePath}pwa-64x64.png`,
              sizes: '64x64',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: `${basePath}pwa-192x192.png`,
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: `${basePath}pwa-512x512.png`,
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: `${basePath}pwa-maskable-192x192.png`,
              sizes: '192x192',
              type: 'image/png',
              purpose: 'maskable'
            },
            {
              src: `${basePath}pwa-maskable-512x512.png`,
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable'
            }
          ]
        }
      })
    ],
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom'],
            'vendor-icons': ['lucide-react']
          }
        }
      }
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      strictPort: true,
      allowedHosts: true,
      hmr: mergedEnv.DISABLE_HMR !== 'true'
    },
    preview: {
      port: 3000,
      host: '0.0.0.0',
      strictPort: true,
      allowedHosts: true
    }
  };
});