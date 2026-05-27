import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    env: {
      META_APP_SECRET: 'test-app-secret',
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
});
