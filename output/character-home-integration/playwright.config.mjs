import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '../../tests/e2e',
  testMatch: ['added-characters.spec.ts', 'start-screen.spec.ts'],
  outputDir: './browser-results',
  workers: 1,
  reporter: [['list'], ['json', { outputFile: './output/character-home-integration/browser-report.json' }]],
  use: { baseURL: 'http://127.0.0.1:5207', channel: 'msedge', viewport: { width: 1440, height: 1000 }, screenshot: 'only-on-failure' },
});
