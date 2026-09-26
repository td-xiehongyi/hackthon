import { expect, test } from '@playwright/test';

test('正式探索页应用预览布局，附近地图跟随真实角色，返回首页保留选角', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: '选择青青', exact: true }).click();
  await page.getByRole('button', { name: '进入校园', exact: true }).click();
  await expect(page.getByRole('region', { name: '个人信息' })).toBeVisible();
  await expect(page.getByRole('status', { name: '地图加载状态' })).toHaveText('地图已加载');
  await expect(page.getByRole('region', { name: '个人信息' }).getByText('待填写', { exact: true })).toHaveCount(3);
  await expect(page.getByRole('button', { name: '浏览', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '进入教学楼群', exact: true })).toHaveCount(0);
  const mini = page.getByRole('img', { name: '角色附近的校园小地图' });
  const crop = await mini.getAttribute('viewBox');
  await page.keyboard.down('KeyA');
  try { await expect(mini).not.toHaveAttribute('viewBox', crop!); }
  finally { await page.keyboard.up('KeyA'); }
  for (const size of [{ width: 1440, height: 960 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(size);
    await expect.poll(async () => Math.round((await page.locator('.map-canvas').boundingBox())!.height)).toBe(size.height);
    const map = (await page.locator('.map-canvas').boundingBox())!;
    expect(map.y).toBe(0);
    expect(Math.round(map.x + map.width)).toBe(size.width);
    const home = (await page.getByRole('button', { name: '返回首页', exact: true }).boundingBox())!;
    expect(home.x).toBeLessThan(map.x);
    expect(size.height - home.y - home.height).toBeLessThan(45);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight)).toBe(false);
  }
  await page.getByRole('button', { name: '返回首页', exact: true }).click();
  await expect(page.getByRole('button', { name: '选择青青', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(errors).toEqual([]);
});
