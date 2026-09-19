import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
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
  server: {
    port: 5173,
    proxy: {
      // The proxy Worker holds the Anthropic key; the client never sees it.
      '/api': { target: 'http://127.0.0.1:8787', changeOrigin: true },
    },
  },
})
