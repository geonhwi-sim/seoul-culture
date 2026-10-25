import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// base './' → GitHub Pages 저장소 이름과 무관하게 동작 (HashRouter 사용)
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'icon.svg'],
      manifest: {
        name: '지금 서울 · 전시와 공연',
        short_name: '지금 서울',
        description: '서울에서 지금 열리는 전시와 공연, 예매 링크까지 한곳에서',
        lang: 'ko',
        theme_color: '#f6f6f4',
        background_color: '#f6f6f4',
        display: 'standalone',
        start_url: './',
        scope: './',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            // 행사 데이터: 온라인이면 최신, 오프라인이면 캐시
            urlPattern: ({ url }) => url.pathname.endsWith('/events.json'),
            handler: 'NetworkFirst',
            options: { cacheName: 'events', networkTimeoutSeconds: 5 },
          },
          {
            // 포스터 이미지 (다른 도메인이라 opaque 응답도 허용)
            urlPattern: ({ request, sameOrigin }) => !sameOrigin && request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'posters',
              expiration: { maxEntries: 600, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url }) => url.origin === 'https://cdn.jsdelivr.net',
            handler: 'CacheFirst',
            options: { cacheName: 'cdn', expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 120 } },
          },
        ],
      },
    }),
  ],
})
