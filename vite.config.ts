import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import sitemap from 'vite-plugin-sitemap'

export default defineConfig({
  plugins: [
    react(), 
    tailwindcss(),
    sitemap({
      hostname: 'https://merodeutsch.pramods.com.np',
      dynamicRoutes: [
        '/',
        '/auth',
        '/alphabet',
        '/numbers',
        '/calendar',
        '/articles',
        '/greetings',
        '/glossary',
        '/dictation',
        '/grammar',
        '/pronunciation',
        '/roleplay',
        '/dashboard',
        '/learn',
        '/practice',
        '/stories',
        '/analytics',
        '/import',
        '/rapid-fire',
        '/settings',
        '/privacy',
        '/terms',
        '/help',
        '/feedback',
      ],
    }),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      devOptions: {
        // Generate + serve /sw.js during `vite dev` so the Worker registers
        // with the correct MIME type instead of falling back to index.html.
        enabled: true,
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        cleanupOutdatedCaches: true,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        // Offline-first AUDIO caching: dictation/TTS audio blobs are fetched
        // once, then served instantly from the Cache Storage API on every
        // later visit (including fully offline) — matching the reliability of
        // our Dexie text data. CacheFirst: audio files are immutable content;
        // a 30-entry / 30-day LRU keeps storage bounded.
        runtimeCaching: [
          {
            // Match same- and cross-origin audio by request destination OR
            // file extension (covers bundled assets and CDN-hosted clips).
            urlPattern: ({ request, url }) =>
              request.destination === 'audio' ||
              /\.(mp3|wav|ogg|m4a)$/i.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'md-audio-v1',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
                purgeOnQuotaError: true,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      manifest: {
        name: 'MeroDeutsch',
        short_name: 'MeroDeutsch',
        description: 'Learn German from zero — with Nepali support.',
        theme_color: '#2563eb',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/logo.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
})
