import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { communitySchedulePlugin } from './server/communitySchedulePlugin.js';

export default defineConfig({
  plugins: [react(), communitySchedulePlugin()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: false,
      },
    },
  },
  preview: { host: '127.0.0.1', port: 5173, strictPort: true },
});
