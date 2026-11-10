/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'site',
  plugins: [react()],
  resolve: { dedupe: ['react', 'react-dom'] },
  server: { port: 5310 },
  test: {
    root: '.',
    environment: 'jsdom',
    include: ['tests/**/*.test.tsx'],
  },
});
