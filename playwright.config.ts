import { defineConfig } from '@playwright/test';

/**
 * 浏览器测试同时启动前端（Vite）与本机数据服务。
 * 数据服务使用独立的测试数据目录 .cache/e2e-data（每次运行前清空并重新初始化），
 * 并启用开发测试图片政策；不会读写项目 data/。
 * 为避免误把测试图片写进真实相册，数据服务不复用已在运行的服务；请先停止 8787 上的服务。
 */
export default defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    channel: 'chrome',
    viewport: { width: 1440, height: 1000 },
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command:
        'node -e "require(\'fs\').rmSync(\'.cache/e2e-data\',{recursive:true,force:true})" && node server/main.ts --init && node server/main.ts --dev-image-policy',
      url: 'http://127.0.0.1:8787/api/v1/capabilities',
      env: { CSU_DATA_DIR: '.cache/e2e-data' },
      reuseExistingServer: false,
      stdout: 'ignore',
    },
    {
      command: 'npm run dev',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: !process.env.CI,
    },
  ],
});
