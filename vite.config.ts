import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    proxy: {
      '/proxy-jira': {
        target: 'https://project49--project49-45f16.asia-east1.hosted.app',
        changeOrigin: true,
        secure: false
      },
      '/api': {
        target: 'https://project49--project49-45f16.asia-east1.hosted.app',
        changeOrigin: true,
        secure: false
      }
    },
  },
  build: {
    minify: 'esbuild',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
        },
      },
    },
  },
});