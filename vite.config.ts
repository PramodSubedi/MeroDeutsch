import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import sitemap from 'vite-plugin-sitemap'

/**
 * Keep the PWA (manifest link + service worker) on the MAIN app entry only.
 *
 * WHY THIS PLUGIN EXISTS
 * ----------------------
 * `vite-plugin-pwa` runs its `transformIndexHtml` hook for EVERY html input and
 * has no notion of "which entry is the PWA". Once this build became multi-page
 * (`index.html` + `admin.html`), the plugin unconditionally injected
 * `<link rel="manifest" href="/manifest.webmanifest">` into `admin.html` too.
 *
 * That alone is cosmetic, but it pairs with a real hazard: the service worker is
 * emitted at `/sw.js` with scope `/`. If anything on the admin subdomain ever
 * registered it, its workbox `navigateFallback: '/index.html'` would answer EVERY
 * admin navigation (`/users`, `/curriculum`, …) with the MAIN app's index.html —
 * a silent, complete route hijack of the admin app.
 *
 * The service-worker REGISTRATION is handled in code, not here: `src/main.tsx`
 * imports `virtual:pwa-register`, which flips the plugin into
 * `useImportRegister` mode and suppresses HTML injection entirely. So this
 * plugin only has to strip the leftover manifest link from the admin bundle.
 *
 * PLACING THIS PLUGIN
 * -------------------
 * Two things are load-bearing and easy to get wrong:
 *   1. It must be listed AFTER `VitePWA` in the plugins array, and
 *   2. it must use `enforce: 'post'` with `order: 'post'`.
 * Vite runs `transformIndexHtml` hooks in array order within a phase, so a
 * normally-ordered plugin declared first would run BEFORE the PWA injection and
 * strip nothing. (`generateBundle` looks like it should work and silently does
 * not — an earlier version of this plugin used it and shipped the manifest link
 * to the admin document anyway.)
 */
function pwaMainEntryOnly(): Plugin {
  return {
    name: 'mero:pwa-main-entry-only',
    enforce: 'post',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        // `ctx.path` is the source html file; only the admin document is touched.
        if (!/(^|[\\/])admin\.html$/.test(ctx.path)) return html;
        return html
          // The learner app's web manifest (vite-plugin-pwa).
          .replace(/<link rel="manifest"[^>]*>\s*/g, '')
          // The learner app's sitemap (vite-plugin-sitemap). Harmless, but it
          // advertises the wrong document set from the control center.
          .replace(/<link rel="sitemap"[^>]*>\s*/g, '');
      },
    },
  };
}

export default defineConfig({
  plugins: [
    react(), 
    tailwindcss(),
    sitemap({
      hostname: 'https://merodeutsch.pramods.com.np',
      dynamicRoutes: [
        '/',
        '/welcome',
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
        // The admin app is a separate deploy surface on its own subdomain and is
        // deliberately NOT offline-capable. Precaching admin.html would ship the
        // whole admin shell to every learner in the Cache Storage API; excluding
        // it keeps the main app's offline budget unchanged now that the build is
        // multi-page. See `pwaMainEntryOnly()` above for the registration half.
        globIgnores: ['admin.html', 'workbox-*.js'],
        cleanupOutdatedCaches: true,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        // Offline-first AUDIO caching: a clip is fetched once, then served
        // instantly from Cache Storage on every later visit (including fully
        // offline). Two layers, deliberately:
        //
        //   1. The HTTP cache, via `Cache-Control: public, max-age=31536000,
        //      immutable` on /audio/(.*) in vercel.json. Files are named by Anki
        //      media id and never change in place, so this is correct and free.
        //      Repeat playback costs no workbox round-trip at all.
        //   2. This runtime cache, for the fully-offline case the HTTP cache
        //      cannot cover.
        //
        // CacheFirst: audio files are immutable content.
        //
        // maxEntries is 200, not 30. The previous value was sized for a handful
        // of sample clips; the catalogue is 813 files, so a learner moving
        // through A1 vocabulary evicted a clip before ever hearing it twice.
        // 200 x ~16 kB is ~3.2 MB worst case — bounded, and enough to cover the
        // words a learner actually revisits. (It does NOT match the Dexie text
        // cache's unbounded storage; an earlier comment here claimed it did.)
        //
        // The cache name is v2 to supersede the 30-entry v1 bucket rather than
        // inheriting it.
        runtimeCaching: [
          {
            // Match same- and cross-origin audio by request destination OR
            // file extension (covers bundled assets and CDN-hosted clips).
            urlPattern: ({ request, url }) =>
              request.destination === 'audio' ||
              /\.(mp3|wav|ogg|m4a)$/i.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'md-audio-v2',
              expiration: {
                maxEntries: 200,
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
    // MUST come after VitePWA: this strips the manifest link that VitePWA
    // injects into admin.html, so it has to run in a later hook phase.
    pwaMainEntryOnly(),
  ],
  build: {
    rollupOptions: {
      /**
       * Two entries, one shared Supabase backend, two browser origins.
       *
       *   main  -> index.html  -> the learner app (installable PWA)
       *   admin -> admin.html  -> the admin control center (no SW, no manifest)
       *
       * Both are emitted into the same `dist/`. They are served by SEPARATE
       * deployments (see vercel.json / vercel.admin.json): a Vercel rewrite is
       * scoped to a project, not to a hostname, so `admin.` must be its own
       * project pointed at the same build output. Locally both are reachable
       * from one dev server at /index.html and /admin.html.
       */
      input: {
        main: 'index.html',
        admin: 'admin.html',
      },
    },
  },
})
