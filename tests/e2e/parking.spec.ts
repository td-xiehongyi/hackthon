import { expect, test } from '@playwright/test';

test('教学楼群停车场展示二维码端口并支持筛选与详情', async ({ page }) => {
  await page.goto('/#teaching');
  await expect(page.getByRole('heading', { name: '课表与蹭课中心' })).toBeVisible();

  await page.getByRole('button', { name: '停车场' }).click();
  await expect(page.getByRole('heading', { name: '停车场 / 充电位' })).toBeVisible();
  await expect(page.getByText('全部端口').locator('..').getByRole('strong')).toHaveText('10');
  await expect(page.getByRole('list', { name: '充电端口列表' }).getByRole('listitem')).toHaveCount(10);
  await expect(page.getByText('照片状态')).toBeVisible();
  const response = await page.request.get('/api/parking/status');
  expect(response.ok()).toBe(true);
  const status = await response.json();
  expect(status).toMatchObject({ live: false, source: 'photo-demo' });
  expect(status.data).toHaveLength(10);

  await page.getByRole('button', { name: '未占用', exact: true }).click();
  await expect(page.getByText('显示 7 / 10 个端口')).toBeVisible();
  await page.getByRole('button', { name: /3 号端口，未占用/ }).click();
  const dialog = page.getByRole('dialog', { name: '3 号充电位' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('120000040145', { exact: true })).toBeVisible();
  await expect(dialog.getByText('完整二维码内容')).toBeVisible();
  await page.getByRole('button', { name: '关闭端口详情' }).click();

  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('停车场支持在浏览器本地选择二维码图片并给出识别反馈', async ({ page }) => {
  await page.goto('/#teaching');
  await page.getByRole('button', { name: '停车场' }).click();
  await page.getByRole('button', { name: /本地扫码识别/ }).click();
  await expect(page.getByRole('heading', { name: '识别二维码' })).toBeVisible();
  await page.locator('input[type="file"][accept="image/*"]').setInputFiles({
    name: 'not-a-qr.png',
    mimeType: 'image/png',
    // A valid 1×1 PNG; the decoder should fail locally and explain what to do.
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'),
  });
  await expect(page.getByRole('status')).toContainText(/二维码|图片/);
  await expect(page.getByText('图片不会上传到服务器')).toBeVisible();
});

test('停车场支持暂停、手动触发和可控间隔的状态刷新', async ({ page }) => {
  let requestCount = 0;
  await page.route('**/api/parking/status**', async (route) => {
    requestCount += 1;
    const live = requestCount > 1;
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        live,
        source: live ? 'test-upstream' : 'photo-demo',
        updatedAt: '2026-09-27T00:00:00.000Z',
        data: [{
          deviceNumber: '120000032056',
          status: live ? 'available' : 'occupied',
          remainingSeconds: live ? 0 : 120,
        }],
      }),
    });
  });

  await page.goto('/#teaching');
  await page.getByRole('button', { name: '停车场' }).click();
  await expect(page.getByText('照片状态')).toBeVisible();

  const interval = page.getByLabel('自动刷新间隔');
  await expect(interval).toHaveValue('15');
  await interval.selectOption('0');
  await expect(page.getByText('自动刷新已暂停，可手动同步')).toBeVisible();

  await page.getByRole('button', { name: '立即刷新' }).click();
  await expect(page.getByText('实时状态')).toBeVisible();
  await expect(page.getByRole('button', { name: /1 号端口，未占用/ })).toBeVisible();
  expect(requestCount).toBeGreaterThanOrEqual(2);
});
