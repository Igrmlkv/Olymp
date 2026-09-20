import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      // We register the worker ourselves in UpdatePrompt, which is what makes
      // "prompt" mean anything; the injected script had no one to prompt.
      injectRegister: null,
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        name: 'Олимп — математика и русский',
        short_name: 'Олимп',
        description: 'Задачи уровня школьного этапа ВсОШ для русскоязычных детей в Нидерландах',
        lang: 'ru',
        start_url: '/',
        display: 'standalone',
        background_color: '#0f172a',
        theme_color: '#0f172a',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Take control of the page that installed us. Without it the first
        // session stays uncontrolled, and then "Обновить" has no controller to
        // swap: the new worker activates and the page never reloads.
        clientsClaim: true,
        // Content packages are versioned and immutable, so cache-first is safe:
        // a new version means a new URL.
        runtimeCaching: [
          {
            urlPattern: /\/api\/packages\/.*\.json$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'olymp-content-packages',
              expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        // Split the heavy, rarely-changing libraries out of the app chunk so a
        // content or UI change does not invalidate them in the service worker.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router'],
          markdown: ['react-markdown', 'remark-gfm'],
          schema: ['zod', 'dexie'],
        },
      },
    },
  },
  // The proxy Worker holds the Anthropic key; the client never sees it.
  // `preview` needs it as well: without it the built app — the only build that
  // has a service worker — cannot load a package at all.
  server: {
    port: 5173,
    proxy: { '/api': { target: 'http://127.0.0.1:8787', changeOrigin: true } },
  },
  preview: {
    port: 4173,
    proxy: { '/api': { target: 'http://127.0.0.1:8787', changeOrigin: true } },
  },
})
