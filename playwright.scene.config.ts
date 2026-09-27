import { defineConfig } from '@playwright/test';

const existingServer = process.env.SCENE_TEST_URL;
// ZIP scenes use browser storage and do not need the campus API server.
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'scene-package.spec.ts',
  workers: 1,
  use: {
    baseURL: existingServer ?? 'http://127.0.0.1:5183', channel: 'chrome',
    viewport: { width: 1440, height: 1000 }, screenshot: 'only-on-failure',
  },
  webServer: existingServer ? undefined : {
    command: 'node node_modules/vite/bin/vite.js --port 5183',
    url: 'http://127.0.0.1:5183', reuseExistingServer: false,
  },
});
