import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'متجر لَحِم',
        short_name: 'لَحِم',
        description: 'متجر لَحِم لبيع المواشي واللحوم الطازجة',
        theme_color: '#198754',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        dir: 'rtl',
        lang: 'ar',
        start_url: '/',
        icons: [
          {
            src: '/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: '/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  server: {
    host: true,
    hmr: {
      protocol: 'ws',
      host: 'localhost',
    },
    proxy: {
      '/ws': {
        target: 'ws://127.0.0.1:8000',
        ws: true,
        changeOrigin: true,
        secure: false,
      },
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      },
      '/media': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      },
      '/static': { target: 'http://127.0.0.1:8000', changeOrigin: true }
    }
  }
})

