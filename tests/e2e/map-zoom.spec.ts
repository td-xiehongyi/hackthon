import { expect, test } from '@playwright/test';
import { enterCampusAt } from './helpers/campus';

for (const place of [
  { name: '教学楼', x: 506, y: 1234 },
  { name: '图书馆', x: 600, y: 1320 },
  { name: '体育场', x: 425, y: 934 },
]) {
  test(`${place.name}：初始233%，交互返回保留原比例及手动缩放`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await enterCampusAt(page, place.x, place.y);
    const zoom = page.getByLabel('当前缩放');
    await expect(zoom).toHaveText('233%');
    for (const expected of ['233%', '291%']) {
      if (expected === '291%') await page.getByRole('button', { name: '放大地图', exact: true }).click();
      await expect(zoom).toHaveText(expected);
      await page.keyboard.press('KeyE');
      await expect(page.locator('.place-overlay')).toBeVisible();
      await page.getByRole('button', { name: '返回校园', exact: true }).click();
      await expect(page.locator('.place-overlay')).toHaveCount(0);
      // 等待恢复地图后的镜头适配帧，避免在重置发生前误判通过。
      await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
      await expect(zoom).toHaveText(expected);
    }
  });
}
