import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

// https://vite.dev/config/
export default defineConfig({
  // optimizeDeps: {
  //   force: true,
  //   include: ['@doritokit/core'],
  // },
  plugins: [
    react(),
    nodePolyfills({ globals: { Buffer: true, global: true } }),
  ],
  server: {
    port: 3000,
  },
});
