import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { communitySchedulePlugin } from './server/communitySchedulePlugin.js';
import { dormChatPlugin } from './server/dormChatPlugin.js';
import { parkingStatusPlugin } from './server/parkingStatusPlugin.js';

export default defineConfig({
  plugins: [react(), communitySchedulePlugin(), dormChatPlugin(), parkingStatusPlugin()],
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
