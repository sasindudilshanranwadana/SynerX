import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const rawBackend = env.VITE_BACKEND_URL || 'http://127.0.0.1:8000';
  const normalizedBackend = rawBackend
    .replace('localhost', '127.0.0.1')
    .replace('::1', '127.0.0.1');

  return {
    plugins: [react()],
    optimizeDeps: {
      exclude: ['lucide-react'],
      include: ['aws-sdk'],
    },
    resolve: {
      alias: {
        './runtimeConfig': './runtimeConfig.browser',
      },
    },
    define: {
      'global': 'globalThis',
      'process.env': {},
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: normalizedBackend,
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
        '/ws': {
          target: normalizedBackend.replace(/^http/, 'ws'),
          changeOrigin: true,
          ws: true,
          secure: false,
        },
      },
    },
    preview: {
      port: 4173,
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            'chart-vendor': ['chart.js', 'recharts', 'react-plotly.js'],
            'ui-vendor': ['lucide-react', 'jspdf', 'jspdf-autotable'],
          },
        },
      },
    },
  };
});