import { expect, test } from '@playwright/test';
import { enterCampusAt } from './helpers/campus';

for (const place of [
  { name: '教学楼群', x: 506, y: 1234 },
  { name: '图书馆', x: 600, y: 1320 },
  { name: '体育场', x: 425, y: 934 },
]) {
  test(`${place.name}浮层保留左栏与地图，返回原位`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await enterCampusAt(page, place.x, place.y);
    await expect(page.getByTestId('interact-prompt')).toContainText(place.name);
    const position = await page.getByTestId('character-status').textContent();
    await page.keyboard.press('KeyE');
    await expect(page.getByRole('button', { name: '返回校园', exact: true })).toBeVisible();
    await expect(page.getByRole('region', { name: '个人信息' })).toBeVisible();
    await expect(page.locator('.map-canvas canvas')).toBeVisible();
    await expect(page.getByRole('button', { name: '返回首页', exact: true })).toBeDisabled();
    for (const size of [{ width: 1440, height: 900 }, { width: 1366, height: 768 }, { width: 768, height: 1024 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(size);
      const rail = (await page.locator('.explorer-sidebar').boundingBox())!;
      const panel = (await page.locator('.place-overlay').boundingBox())!;
      expect(panel.x).toBeGreaterThan(rail.width);
      expect(panel.x + panel.width).toBeLessThan(size.width - 20);
      expect(panel.y).toBeGreaterThan(20);
      expect(panel.y + panel.height).toBeLessThan(size.height - 20);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight)).toBe(false);
      expect(await page.locator('.place-overlay').evaluate(el => el.scrollWidth > el.clientWidth)).toBe(false);
      if (size.width === 1440 || size.width === 390) await page.screenshot({ path: testInfo.outputPath(`place-${size.width}.png`) });
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.keyboard.press('KeyD');
    await expect(page.getByTestId('character-status')).toHaveText(position!);
    await page.getByRole('button', { name: '返回校园', exact: true }).click();
    await expect(page.locator('.place-overlay')).toHaveCount(0);
    await expect(page.getByTestId('character-status')).toHaveText(position!);
    await expect(page.getByRole('button', { name: '返回首页', exact: true })).toBeEnabled();
    await expect(page.getByTestId('interact-prompt')).toContainText(place.name);
  });
}

test('正式地图内运行图书馆小游戏，游戏按键不移动校园角色', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await enterCampusAt(page, 600, 1320);
  const position = await page.getByTestId('character-status').textContent();
  await page.keyboard.press('KeyE');
  await page.getByRole('tab', { name: '发呆 · 小游戏' }).click();
  const game = page.getByRole('region', { name: '封校倒计时小游戏' });
  await game.getByRole('button', { name: '开始逃生' }).click();
  await page.keyboard.press('KeyD');
  await expect(game.getByLabel('玩家')).toHaveAttribute('style', /left: 14%/);
  await page.keyboard.press('KeyE');
  await expect(game.getByRole('status')).toHaveText('这里没有可以操作的东西。');
  await expect(page.getByTestId('character-status')).toHaveText(position!);
  await expect(page.getByRole('region', { name: '个人信息' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('library-game-desktop.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.locator('.place-overlay').evaluate(el => el.scrollWidth > el.clientWidth)).toBe(false);
  await game.getByRole('button', { name: '→', exact: true }).click();
  await expect(game.getByLabel('玩家')).toHaveAttribute('style', /left: 18%/);
  await page.screenshot({ path: testInfo.outputPath('library-game-mobile.png') });
  await page.getByRole('button', { name: '返回校园', exact: true }).click();
  await expect(game).toHaveCount(0);
  await expect(page.getByTestId('character-status')).toHaveText(position!);
  await page.keyboard.down('KeyA');
  try { await expect(page.getByTestId('character-status')).not.toHaveText(position!); }
  finally { await page.keyboard.up('KeyA'); }
  expect(errors).toEqual([]);
});
