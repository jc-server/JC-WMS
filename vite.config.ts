import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // `autoUpdate` → new SW version auto-activates on next visit.
      // `immediate: true` in main.tsx's `registerSW` makes the update
      // apply without requiring a manual refresh.
      registerType: 'autoUpdate',
      // We register the SW ourselves in src/main.tsx so we control the
      // timing and can hook into onNeedRefresh/onOfflineReady if desired.
      injectRegister: null,
      includeAssets: [
        'favicon.ico',
        'favicon.svg',
        'favicon-96x96.png',
        'apple-touch-icon.png',
        'logo.png',
      ],
      manifest: {
        name: 'Jaiswal Construction — Workers Management',
        short_name: 'JCWMS',
        description:
          'Jaiswal Construction workers, attendance, wages, advances and site ledger management.',
        theme_color: '#09090b',
        background_color: '#09090b',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: 'web-app-manifest-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'web-app-manifest-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'web-app-manifest-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Precache every build artifact so the app cold-starts offline.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [
          /^\/api\//,
          // Vercel Analytics beacons must always hit the real network.
          /^\/_vercel\//,
        ],
        // NEVER cache Firebase. Firestore owns its own IndexedDB cache
        // (persistentLocalCache). Proxying Firebase calls through the SW
        // would corrupt that cache and break auth.
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/firestore\.googleapis\.com\/.*/i,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /^https:\/\/identitytoolkit\.googleapis\.com\/.*/i,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /^https:\/\/securetoken\.googleapis\.com\/.*/i,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /^https:\/\/.*\.gstatic\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'gstatic',
              expiration: {
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
            },
          },
        ],
      },
      // Keep SW disabled in dev — only enable temporarily if you need
      // to debug offline behavior locally. Otherwise it interferes with
      // HMR and can serve stale bundles.
      devOptions: {
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
  },
  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          // Splits the Firebase SDK (~280 KB) and React (~140 KB) into
          // separate chunks so first-paint isn't blocked by either.
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          react: ['react', 'react-dom'],
        },
      },
    },
  },
});