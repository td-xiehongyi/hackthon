import { defineConfig } from '@playwright/test';
import { resolve } from 'node:path';

const communityTestFile = resolve('.cache', `community-schedules-${process.pid}.json`);

export default defineConfig({
  testDir: './tests/e2e',
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:5175',
    channel: 'chrome',
    viewport: { width: 1440, height: 1000 },
    screenshot: 'only-on-failure',
  },
  webServer: [
    { command: 'node tools/test-server.mjs', url: 'http://127.0.0.1:8788/api/v1/capabilities', reuseExistingServer: false },
    { command: 'npm run dev -- --port 5175', url: 'http://127.0.0.1:5175',
      env: { CAMPUS_API_PORT: '8788', CSU_COMMUNITY_SCHEDULE_FILE: communityTestFile }, reuseExistingServer: false },
  ],
});
