import { expect, test } from '@playwright/test';

test('地图可加载、缩放、拖动并恢复全图', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '中南大学像素校园' })).toBeVisible();
  await expect(page.getByRole('status', { name: '地图加载状态' })).toHaveText('地图已加载');
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();
  const zoom = page.getByLabel('当前缩放');
  const fittedZoom = await zoom.innerText();
  const before = await canvas.screenshot();
  await page.getByRole('button', { name: '放大地图', exact: true }).click();
  await expect(zoom).not.toHaveText(fittedZoom);
  // Screenshot comparison observes actual camera rendering, not just button labels.
  await expect.poll(async () => (await canvas.screenshot()).equals(before)).toBe(false);
  const box = (await canvas.boundingBox())!;
  const zoomed = await canvas.screenshot();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 90, box.y + box.height / 2 + 50, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => (await canvas.screenshot()).equals(zoomed)).toBe(false);
  await page.getByRole('button', { name: '适应窗口' }).click();
  await expect(zoom).toHaveText(fittedZoom);
  await expect.poll(async () => (await canvas.screenshot()).equals(before)).toBe(true);
  await expect(page.getByText('角色移动与地点交互待接入')).toBeVisible();
  expect(errors).toEqual([]);
});

test('图片读取失败时明确提示，不能显示加载成功', async ({ page }) => {
  await page.route('**/maps/campus-final-v9.png', (route) => route.abort());
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('地图加载失败');
  await expect(page.getByRole('button', { name: '放大地图', exact: true })).toBeDisabled();
  await expect(page.getByRole('status', { name: '地图加载状态' })).not.toHaveText('地图已加载');
});
