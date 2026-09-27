import { expect, test } from '@playwright/test';
import { enterCampusAt } from './helpers/campus';

test('和平楼：范围提示、图文介绍、暂停移动与原位返回', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await enterCampusAt(page, 413, 210);
  const prompt = page.getByTestId('interact-prompt');
  await expect(prompt).toContainText('和平楼');
  const position = await page.getByTestId('character-status').textContent();
  await page.keyboard.press('KeyE');
  const panel = page.getByRole('region', { name: '岳麓山校区和平楼', exact: true });
  await expect(panel.getByRole('heading', { name: '和平楼', exact: true })).toBeVisible();
  await expect(panel).toContainText('1936');
  await expect(panel.getByRole('img', { name: '和平楼外观' })).toBeVisible();
  expect(await panel.getByRole('img').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(200);
  await page.keyboard.up('KeyD');
  await expect(page.getByTestId('character-status')).toHaveText(position!);
  await page.screenshot({ path: testInfo.outputPath('heping-desktop.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.locator('.place-overlay').evaluate(el => el.scrollWidth > el.clientWidth)).toBe(false);
  await page.screenshot({ path: testInfo.outputPath('heping-mobile.png') });
  await panel.getByRole('button', { name: '返回校园' }).click();
  await expect(panel).toHaveCount(0);
  await expect(page.getByTestId('character-status')).toHaveText(position!);
  await page.keyboard.down('KeyS');
  try { await expect(page.getByTestId('character-status')).not.toHaveText(position!); }
  finally { await page.keyboard.up('KeyS'); }
  expect(errors).toEqual([]);
});

test('图书馆：馆内介绍完整且不显示来源备注，原有功能可切换', async ({ page }, testInfo) => {
  await enterCampusAt(page, 600, 1320);
  await page.keyboard.press('KeyE');
  const panel = page.getByRole('region', { name: '潇湘校区图书馆', exact: true });
  await expect(panel).toContainText('阅读与学习');
  await expect(panel).not.toContainText('待核验补充');
  await expect(panel).not.toContainText('信息来源');
  await page.screenshot({ path: testInfo.outputPath('library-introduction.png') });
  await panel.getByRole('tab', { name: '学习', exact: true }).click();
  await expect(panel.getByRole('link', { name: /打开 Folo/ })).toBeVisible();
  await panel.getByRole('tab', { name: '地点相册', exact: true }).click();
  await expect(panel.getByRole('region', { name: '地点相册', exact: true })).toBeVisible();
  await panel.getByRole('tab', { name: '馆内信息', exact: true }).click();
  await expect(panel).toContainText('阅读与学习');
});
