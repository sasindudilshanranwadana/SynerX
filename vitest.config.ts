import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
    env: {
      VITE_SUPABASE_URL: 'https://test.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key',
      VITE_RUNPOD_URL: 'https://test.runpod.net',
      VITE_RUNPOD_API_KEY: 'test-api-key',
      VITE_BACKEND_URL: 'https://test.backend.net',
      VITE_CLOUDFLARE_ACCOUNT_ID: 'test-account-id',
      VITE_R2_ACCESS_KEY_ID: 'test-access-key',
      VITE_R2_SECRET_ACCESS_KEY: 'test-secret-key',
      VITE_R2_BUCKET_NAME: 'test-bucket',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData.ts',
        'dist/',
      ],
      thresholds: {
        statements: 70,
        branches: 65,
        functions: 70,
        lines: 70,
      },
    },
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    testTimeout: 10000,
    hookTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
