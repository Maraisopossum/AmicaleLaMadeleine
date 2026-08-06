import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon-32x32.png', 'apple-touch-icon.png'],
      // Précache uniquement le bundle app (JS/CSS/HTML/icônes) pour un chargement
      // instantané et l'installation sur l'écran d'accueil. Pas de runtimeCaching
      // sur les appels Supabase : l'app dépend d'auth/données toujours à jour,
      // un cache d'API introduirait des données périmées sans bénéfice réel
      // (pas de vrai mode hors-ligne possible pour ce type d'app).
      manifest: {
        name: 'Amicale des Sapeurs-Pompiers de La Madeleine',
        short_name: 'Amicale La Madeleine',
        description: 'Gestion associative de l\'Amicale des Sapeurs-Pompiers de La Madeleine',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        lang: 'fr',
        theme_color: '#181410',
        background_color: '#F3ECDC',
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  server: {
    port: 3000,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
})