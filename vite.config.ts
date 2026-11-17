/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { agentPlugin } from './site/agent-plugin';

// Libraries that change far less often than the site: each in a chunk of its
// own, so a redeploy of the site leaves them in the visitor's cache.
const vendorChunks: Record<string, RegExp> = {
  react: /\/node_modules\/(react|react-dom|scheduler)\//,
  chartjs: /\/node_modules\/(chart\.js|@kurkle\/color|chartjs-[\w-]+)\//,
};

export default defineConfig({
  root: 'site',
  plugins: [react(), agentPlugin()],
  resolve: { dedupe: ['react', 'react-dom'] },
  server: { port: 5310 },
  build: {
    // .vite/manifest.json says which chunks a page needs: scripts/site-build.mjs
    // reads it to preload them from each page's HTML, then removes it.
    manifest: true,
    // One stylesheet, linked from every page's HTML. Split by chunk, a page's
    // CSS would arrive with its JavaScript, after the static HTML is on screen.
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        manualChunks: (id) => Object.keys(vendorChunks).find((name) => vendorChunks[name]!.test(id)),
      },
    },
  },
  test: {
    root: '.',
    environment: 'jsdom',
    include: ['tests/**/*.test.{ts,tsx}'],
  },
});
