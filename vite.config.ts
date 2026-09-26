import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { communitySchedulePlugin } from './server/communitySchedulePlugin.js';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react(), communitySchedulePlugin()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${process.env.CAMPUS_API_PORT ?? '8787'}`,
        changeOrigin: false,
      },
    },
  },
  preview: { host: '127.0.0.1', port: 5173, strictPort: true,
    proxy: { '/api': { target: `http://127.0.0.1:${process.env.CAMPUS_API_PORT ?? '8787'}`, changeOrigin: false } },
  },
});
