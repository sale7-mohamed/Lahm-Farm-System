import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react(),

  ],
  server: {
    port: 5174,
    host: 'localhost',
    hmr: {
      host: 'localhost',
      port: 5174,
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
        changeOrigin: true,
        secure: false,
      },
      '/media': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/static': { target: 'http://127.0.0.1:8000', changeOrigin: true }
    },
  },
  build: {
    target: 'es2015',
    minify: 'terser',
    cssMinify: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          ui: ['react-bootstrap', 'bootstrap'],
          icons: ['lucide-react'],
        }
      }
    },
    chunkSizeWarningLimit: 800,
    assetsInlineLimit: 4096,
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      }
    }
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom'],
    exclude: ['lucide-react']
  }
});
