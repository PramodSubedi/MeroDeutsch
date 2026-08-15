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
