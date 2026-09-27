import { expect, test } from '@playwright/test';
import { enterCampusAt } from './helpers/campus';

test('二食堂：四层窗口、对应评价、切层重置与返回原位', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await enterCampusAt(page, 560, 748);
  await expect(page.getByTestId('interact-prompt')).toContainText('麓南校区二食堂');
  const before = await page.getByTestId('character-status').textContent();
  await page.keyboard.press('KeyE');
  await expect(page.getByRole('heading', { name: '二食堂', exact: true })).toBeVisible();
  await expect(page.getByText('示例体验：', { exact: false })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('canteen-floor-1.png') });

  const floors = [
    { level: 1, name: '家常小炒', review: '青椒肉丝很下饭，想吃清淡一点可以提前说。' },
    { level: 2, name: '暖心砂锅', review: '砂锅端上来还冒着热气，适合慢慢吃。' },
    { level: 3, name: '铁板风味', review: '酱汁拌饭很香，铁板刚出锅有点烫。' },
    { level: 4, name: '缤纷轻食', review: '蔬菜搭配很丰富，酱汁单独放更合口味。' },
  ];
  for (const floor of floors) {
    await page.getByRole('button', { name: `${floor.level} 楼`, exact: true }).click();
    await expect(page.getByRole('heading', { name: `${floor.level} 楼窗口`, exact: true })).toBeVisible();
    await expect(page.locator('.canteen-window')).toHaveCount(2);
    for (const image of await page.locator('.canteen-window img').all()) {
      await expect(image).toBeVisible();
      await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0);
    }
    const card = page.getByRole('button', { name: `查看${floor.name}评价` });
    await card.click();
    await expect(page.getByRole('heading', { name: floor.name, exact: true })).toBeFocused();
    await expect(page.getByText(floor.review, { exact: true })).toBeVisible();
    for (const other of floors.filter(item => item.level !== floor.level)) {
      await expect(page.getByText(other.review, { exact: true })).toHaveCount(0);
    }
    if (floor.level === 1) await page.screenshot({ path: testInfo.outputPath('canteen-window-reviews.png') });
    await page.getByRole('button', { name: `返回 ${floor.level} 楼窗口` }).click();
    await expect(card).toBeFocused();
  }
  await page.getByRole('button', { name: '查看饮品小站评价' }).click();
  await expect(page.getByText('暂无评价，等你发现这个窗口的味道。')).toBeVisible();
  await expect(page.getByText('暂无评分', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '2 楼', exact: true }).click();
  await expect(page.getByRole('heading', { name: '2 楼窗口', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '饮品小站', exact: true })).toHaveCount(0);
  await page.keyboard.press('KeyD');
  await page.getByRole('button', { name: '返回校园', exact: true }).click();
  await expect(page.getByTestId('character-status')).toHaveText(before!);
  await expect(page.getByTestId('interact-prompt')).toContainText('麓南校区二食堂');
  await page.keyboard.press('KeyE');
  await expect(page.getByRole('heading', { name: '1 楼窗口', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('窄屏可切楼层、查看评价；图片失效有替代内容', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/canteen/f1-rice.svg', route => route.abort());
  await enterCampusAt(page, 560, 748);
  await page.keyboard.press('KeyE');
  await expect(page.getByRole('img', { name: '家常小炒图片待补充' })).toBeVisible();
  const panel = page.getByRole('region', { name: '地点功能面板' });
  const bounds = (await panel.boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
  expect(await panel.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.getByRole('button', { name: '3 楼', exact: true }).click();
  await page.getByRole('button', { name: '查看手作水饺评价' }).click();
  await expect(page.getByText('饺子配热汤很舒服，希望以后有更多馅料。')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('canteen-mobile.png') });
  await page.getByRole('button', { name: '返回校园', exact: true }).click();
  await expect(panel).toHaveCount(0);
});
