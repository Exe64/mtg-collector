import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: 'Magic Collection Manager',
        short_name: 'MTG Collection',
        description: 'Inventaire et valorisation de collection Magic: The Gathering',
        start_url: '/',
        display: 'standalone',
        background_color: '#0f172a',
        theme_color: '#0f172a',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        // Précache l'app shell -> chargement offline de l'interface.
        // Pas de cache des réponses /api (données authentifiées, multi-utilisateur).
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        // woff2 uniquement (pas les .svg/.ttf/.eot legacy des fonts d'icônes, lourds)
        globPatterns: ['**/*.{js,css,html,png,woff2}'],
        maximumFileSizeToCacheInBytes: 700 * 1024,
      },
    }),
  ],
  server: {
    port: 3000,
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
