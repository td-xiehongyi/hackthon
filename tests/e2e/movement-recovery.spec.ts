import { expect, test, type Page } from '@playwright/test';
import { dragMap, enterCampusAt } from './helpers/campus';

const position = async (page: Page) => (await page.getByTestId('character-status').textContent())!.match(/位置 [\d.]+, [\d.]+/)![0];
async function move(page: Page, key = 'KeyD') {
  const before = await position(page);
  await page.keyboard.down(key);
  try { await expect.poll(() => position(page)).not.toBe(before); }
  finally { await page.keyboard.up(key); }
}

test('拖动地图后新按 WASD 恢复角色移动并保留缩放', async ({ page }) => {
  await enterCampusAt(page, 180, 1300);
  await page.getByRole('button', { name: '放大地图', exact: true }).click();
  const zoom = await page.getByLabel('当前缩放').textContent();
  await dragMap(page);
  await expect(page.locator('.explorer-map-status')).toContainText('自由浏览');
  await move(page);
  await expect(page.locator('.explorer-map-status')).toContainText('角色跟随');
  await expect(page.getByLabel('当前缩放')).toHaveText(zoom!);
});

test('自由浏览后返回首页重进、关闭全图仍可用 WASD 恢复', async ({ page }) => {
  await enterCampusAt(page, 180, 1300);
  await dragMap(page);
  await page.getByRole('button', { name: '返回首页', exact: true }).click();
  await page.getByRole('button', { name: '进入校园', exact: true }).click();
  await page.keyboard.press('KeyM');
  await page.getByRole('button', { name: '关闭地图' }).click();
  await move(page);
});

test('切换窗口后重新按键可移动，失焦时不沿用旧按键', async ({ page }) => {
  await enterCampusAt(page, 180, 1300);
  await move(page);
  await page.keyboard.down('KeyD');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  const stopped = await position(page);
  await page.waitForTimeout(150);
  expect(await position(page)).toBe(stopped);
  await page.keyboard.up('KeyD');
  await page.locator('.map-canvas canvas').focus();
  await move(page);
});

test('自由浏览时输入文字、组合键与重复按键不恢复移动', async ({ page }) => {
  await enterCampusAt(page, 180, 1300);
  await dragMap(page);
  const before = await position(page);
  await page.evaluate(() => {
    const input = document.createElement('input');
    input.setAttribute('aria-label', '检查文本输入');
    document.body.append(input);
    input.focus();
  });
  await page.keyboard.type('wasd');
  await expect(page.getByLabel('检查文本输入')).toHaveValue('wasd');
  await page.locator('.map-canvas canvas').focus();
  await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD', ctrlKey: true }));
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyD' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD', repeat: true }));
  });
  await expect(page.locator('.explorer-map-status')).toContainText('自由浏览');
  expect(await position(page)).toBe(before);
  await move(page);
});

test('拖动中的按键和全图内的按键不提前解锁角色', async ({ page }) => {
  await enterCampusAt(page, 180, 1300);
  await dragMap(page);
  const before = await position(page);
  await page.mouse.down();
  await page.keyboard.down('KeyD');
  await expect(page.locator('.explorer-map-status')).toContainText('自由浏览');
  expect(await position(page)).toBe(before);
  await page.keyboard.up('KeyD');
  await page.mouse.up();
  await page.keyboard.press('KeyM');
  await expect(page.getByRole('dialog', { name: '校园地图' })).toBeVisible();
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(150);
  expect(await position(page)).toBe(before);
  await page.keyboard.up('KeyD');
  await page.keyboard.press('Escape');
  await move(page);
});

for (const place of [
  { name: '图书馆', x: 600, y: 1320 },
  { name: '教学楼', x: 506, y: 1234 },
  { name: '体育场', x: 425, y: 934 },
  { name: '食堂', x: 560, y: 748 },
  { name: '公寓', x: 342, y: 615 },
]) {
  test(`${place.name}多次进入相册并返回后仍可移动`, async ({ page }) => {
    await enterCampusAt(page, place.x, place.y);
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('KeyE');
      await page.locator('.place-overlay button').filter({ hasText: /^地点相册$/ }).click();
      await page.getByRole('button', { name: '返回校园', exact: true }).click();
      await expect(page.locator('.place-overlay')).toHaveCount(0);
      await page.keyboard.press('KeyM');
      await page.keyboard.press('Escape');
    }
    await move(page, 'KeyA');
  });
}
