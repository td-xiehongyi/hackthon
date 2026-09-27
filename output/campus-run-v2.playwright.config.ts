import { defineConfig } from '@playwright/test';
import { resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
import base from '../playwright.config';

// Dedicated ports and disposable test data avoid interrupting the other active chat.
const root = resolve('.');
const data = resolve('.cache', `campus-run-v2-${process.pid}`);
mkdirSync(data, { recursive: true });
export default defineConfig({
  ...base,
  testDir: resolve(root, 'tests/e2e'),
  use: { ...base.use, baseURL: 'http://127.0.0.1:5177' },
  webServer: [
    { command: 'node server/index.ts', cwd: root, url: 'http://127.0.0.1:8790/api/v1/capabilities', reuseExistingServer: false,
      env: { CAMPUS_DATA_ROOT: data, CAMPUS_PORT: '8790', CAMPUS_ALLOWED_ORIGINS: 'http://127.0.0.1:5177,http://127.0.0.1:8790', CAMPUS_IMAGE_POLICY: 'dev' } },
    { command: 'npm run dev -- --port 5177', cwd: root, url: 'http://127.0.0.1:5177', reuseExistingServer: false,
      env: { CAMPUS_API_PORT: '8790', CSU_COMMUNITY_SCHEDULE_FILE: resolve(data, 'schedules.json') } },
  ],
});
