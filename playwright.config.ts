import { defineConfig } from '@playwright/test';
import { resolve } from 'node:path';

const communityTestFile = resolve('test-results', `community-schedules-${process.pid}.json`);

export default defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL: 'http://127.0.0.1:5174',
    channel: 'msedge',
    viewport: { width: 1440, height: 1000 },
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --port 5174',
    url: 'http://127.0.0.1:5174',
    reuseExistingServer: false,
    env: {
      ...process.env,
      CSU_COMMUNITY_SCHEDULE_FILE: communityTestFile,
    },
  },
});
