import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
    deps: {
      // This will process `jsdom` and its dependencies through Vitest's transformers
      inline: [/.*/],
    },
    server: {
      deps: {
        inline: [/.*/],
      },
    },
  },
});