import { expect, test } from '@playwright/test';
import { enterCampusAt } from './helpers/campus';

test('大地图可缩放、拖动和回到当前位置，标记保持醒目', async ({ page }, testInfo) => {
  await enterCampusAt(page, 600, 1320);
  await page.keyboard.press('KeyM');
  const dialog = page.getByRole('dialog', { name: '校园地图' });
  const map = dialog.getByRole('img', { name: '完整校园地图与当前位置' });
  const marker = dialog.getByTestId('map-player-marker');
  await expect(dialog.getByText('你在这里', { exact: true })).toBeVisible();
  const original = await map.getAttribute('viewBox');
  const markerSize = (await marker.boundingBox())!.width;
  await dialog.getByRole('button', { name: '放大地图', exact: true }).click();
  await expect(dialog.getByLabel('大地图缩放比例')).toHaveText('125%');
  await expect(map).not.toHaveAttribute('viewBox', original!);
  expect((await marker.boundingBox())!.width).toBeCloseTo(markerSize, 0);
  await dialog.getByRole('button', { name: '缩小地图', exact: true }).click();
  await expect(map).toHaveAttribute('viewBox', original!);
  const box = (await map.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -500);
  await expect(dialog.getByLabel('大地图缩放比例')).not.toHaveText('100%');
  const zoomed = await map.getAttribute('viewBox');
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2 + 80, { steps: 8 });
  await page.mouse.up();
  await expect(map).not.toHaveAttribute('viewBox', zoomed!);
  await dialog.getByRole('button', { name: '定位当前位置' }).click();
  const located = (await marker.boundingBox())!;
  expect(located.x + located.width / 2).toBeGreaterThan(box.x);
  expect(located.x + located.width / 2).toBeLessThan(box.x + box.width);
  expect(located.y + located.height / 2).toBeGreaterThan(box.y);
  expect(located.y + located.height / 2).toBeLessThan(box.y + box.height);
  await page.screenshot({ path: testInfo.outputPath('map-location-zoom.png') });
  await dialog.getByRole('button', { name: '查看全图' }).click();
  await expect(dialog.getByLabel('大地图缩放比例')).toHaveText('100%');
  await expect(map).toHaveAttribute('viewBox', original!);
  await expect(dialog.getByRole('button', { name: '缩小地图', exact: true })).toBeDisabled();
  for (let i = 0; i < 9; i++) await dialog.getByRole('button', { name: '放大地图', exact: true }).click();
  await expect(dialog.getByLabel('大地图缩放比例')).toHaveText('600%');
  await expect(dialog.getByRole('button', { name: '放大地图', exact: true })).toBeDisabled();
});

test('M 打开完整地图，暂停移动，关闭后继续游玩', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await enterCampusAt(page, 600, 1320);
  const position = page.getByTestId('character-status');
  const before = await position.textContent();
  const dialog = page.getByRole('dialog', { name: '校园地图' });
  await page.keyboard.down('KeyM');
  await expect(dialog).toBeVisible();
  await page.keyboard.down('KeyM'); // 自动重复不应关掉地图。
  await page.keyboard.up('KeyM');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('img', { name: '完整校园地图与当前位置' })).toBeVisible();
  await expect(dialog.getByTestId('map-player-marker')).toHaveAttribute('cx', '600');
  await expect(dialog.getByTestId('map-player-marker')).toHaveAttribute('cy', '1320');
  await page.keyboard.down('KeyA');
  await page.waitForTimeout(300);
  await expect(position).toHaveText(before!);
  await page.keyboard.press('KeyE');
  await expect(page.getByRole('region', { name: '地点功能面板' })).toHaveCount(0);
  await page.keyboard.press('KeyM');
  await expect(dialog).toHaveCount(0);
  await page.waitForTimeout(200); // 关闭清键，不延续打开前/弹窗内按住的移动键。
  await expect(position).toHaveText(before!);
  await page.keyboard.up('KeyA');
  await page.keyboard.press('KeyM');
  await page.screenshot({ path: testInfo.outputPath('map-overlay-desktop.png') });
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await page.keyboard.press('KeyM');
  await dialog.getByRole('button', { name: '关闭地图' }).click();
  await expect(page.locator('.map-canvas canvas')).toBeFocused();
  await page.keyboard.down('KeyA');
  try { await expect(position).not.toHaveText(before!); }
  finally { await page.keyboard.up('KeyA'); }
  expect(errors).toEqual([]);
});

test('地图和地点交互面板尺寸一致，地点交互中不响应 M', async ({ page }, testInfo) => {
  await enterCampusAt(page, 600, 1320);
  for (const size of [{ width: 1440, height: 900 }, { width: 768, height: 1024 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(size);
    await page.keyboard.press('KeyE');
    const place = page.getByRole('region', { name: '地点功能面板' });
    await expect(place).toBeVisible();
    const bounds = await place.boundingBox();
    await page.keyboard.press('KeyM');
    await expect(page.getByRole('dialog', { name: '校园地图' })).toHaveCount(0);
    await page.getByRole('button', { name: '返回校园', exact: true }).click();
    await expect(place).toHaveCount(0);
    await page.keyboard.press('KeyM');
    const dialog = page.getByRole('dialog', { name: '校园地图' });
    await expect(dialog).toBeVisible();
    expect(await dialog.boundingBox()).toEqual(bounds);
    expect(await dialog.evaluate(el => el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight)).toBe(false);
    if (size.width === 390) await page.screenshot({ path: testInfo.outputPath('map-overlay-mobile.png') });
    await page.keyboard.press('Escape');
  }
});

test('首页与输入框不触发地图快捷键', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('KeyM');
  await expect(page.getByRole('dialog', { name: '校园地图' })).toHaveCount(0);
  await page.getByRole('button', { name: '进入校园', exact: true }).click();
  await expect(page.getByRole('status', { name: '地图加载状态' })).toHaveText('地图已加载');
  await page.evaluate(() => {
    const input = document.createElement('input');
    input.setAttribute('aria-label', '测试文字输入');
    document.body.appendChild(input);
    input.focus();
  });
  await page.keyboard.press('KeyM');
  await expect(page.getByLabel('测试文字输入')).toHaveValue('m');
  await expect(page.getByRole('dialog', { name: '校园地图' })).toHaveCount(0);
});
