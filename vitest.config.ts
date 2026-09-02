import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    setupFiles: ['./src/test/setup.ts'],
    environmentMatchGlobs: [
      ['src/features/production-planning/**', 'node'], // pure-logic productionModel test
      ['src/features/spatial-twin/**', 'node'], // pure-logic spatial twin tests
      ['src/{__tests__,pages,shared,features}/**', 'jsdom'],
    ],
  },
});
