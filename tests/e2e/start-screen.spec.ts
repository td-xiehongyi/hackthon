import { expect, test } from '@playwright/test';

test('首页选择现有照片角色、记住选择，并带入校园后返回', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '选择角色' })).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(0);
  for (const name of ['小颖', '顾哈哈', 'Joy', '小黄鸭', 'Loopy', '小奶鸡']) {
    await expect(page.getByRole('button', { name: `选择${name}`, exact: true })).toBeVisible();
  }
  await expect(page.locator('.start-character-pending')).toHaveCount(0);
  await page.getByRole('button', { name: '选择顾哈哈', exact: true }).click();
  await expect(page.getByRole('button', { name: '选择顾哈哈', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(page.getByRole('button', { name: '选择顾哈哈', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '下一个角色' }).click();
  await expect(page.getByRole('button', { name: '选择Joy', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '上一个角色' }).click();
  await page.getByRole('button', { name: '进入校园', exact: true }).click();
  await expect(page.getByRole('status', { name: '地图加载状态' })).toHaveText('地图已加载');
  await expect(page.getByTestId('character-status')).toContainText('顾哈哈');
  await expect(page.locator('canvas')).toBeVisible();
  const status = page.getByTestId('character-status');
  const before = (await status.innerText()).match(/位置 \d+, \d+/)![0];
  await page.keyboard.down('KeyA');
  try { await expect(status).not.toContainText(before); }
  finally { await page.keyboard.up('KeyA'); }
  await page.getByRole('button', { name: '返回首页', exact: true }).click();
  await expect(page.getByRole('heading', { name: '选择角色' })).toBeVisible();
  await expect(page.getByRole('button', { name: '选择顾哈哈', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(errors).toEqual([]);
});

test('完整地图可打开并用 Escape 关闭，窄屏首页没有横向溢出', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: '查看完整地图', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '完整校园地图' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('img')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
