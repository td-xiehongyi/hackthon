import { expect, test } from '@playwright/test';

test('教学楼群停车场展示二维码端口并支持筛选与详情', async ({ page }) => {
  await page.goto('/#teaching');
  await expect(page.getByRole('heading', { name: '课表与蹭课中心' })).toBeVisible();

  await page.getByRole('button', { name: '停车场' }).click();
  await expect(page.getByRole('heading', { name: '停车场 / 充电位' })).toBeVisible();
  await expect(page.getByText('全部端口').locator('..').getByRole('strong')).toHaveText('10');
  await expect(page.getByRole('list', { name: '充电端口列表' }).getByRole('listitem')).toHaveCount(10);
  await expect(page.getByText('照片状态')).toBeVisible();

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
