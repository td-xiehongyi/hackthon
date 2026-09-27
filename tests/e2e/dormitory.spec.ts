import { expect, test } from '@playwright/test';
import { enterCampusAt } from './helpers/campus';

test('宿舍靠近高亮，点击不进入，按 E 打开并原位返回，离开取消交互', async ({ page }, testInfo) => {
  await enterCampusAt(page, 342, 615);
  const prompt = page.getByTestId('interact-prompt');
  await expect(prompt).toContainText('升华公寓');
  await expect(page.getByRole('button', { name: '升华公寓群聊', exact: true })).toHaveCount(0);
  const canvas = page.locator('.map-canvas canvas');
  await canvas.screenshot({ path: testInfo.outputPath('dormitory-highlight.png') });
  const box = (await canvas.boundingBox())!;
  await canvas.click({ position: { x: box.width / 2 + 130, y: box.height / 2 } });
  await expect(page.getByRole('heading', { name: '升华公寓 · 楼栋群聊' })).toHaveCount(0);
  const position = await page.getByTestId('character-status').textContent();
  await page.keyboard.press('KeyE');
  await expect(page.getByRole('heading', { name: '升华公寓 · 楼栋群聊' })).toBeVisible();
  await expect(page.getByRole('button', { name: '返回首页', exact: true })).toBeDisabled();
  await page.keyboard.press('KeyD');
  await expect(page.getByTestId('character-status')).toHaveText(position!);
  for (const size of [{ width: 1440, height: 900 }, { width: 768, height: 1024 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(size);
    expect(await page.locator('.place-overlay').evaluate(el => el.scrollWidth > el.clientWidth)).toBe(false);
    await expect(page.getByRole('button', { name: '返回校园', exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('dormitory-panel-' + size.width + '.png') });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('button', { name: '返回校园', exact: true }).click();
  await expect(page.getByTestId('character-status')).toHaveText(position!);
  await expect(prompt).toContainText('升华公寓');
  await page.keyboard.down('KeyA');
  try { await expect(prompt).toHaveCount(0); } finally { await page.keyboard.up('KeyA'); }
  await page.keyboard.press('KeyE');
  await expect(page.locator('.place-overlay')).toHaveCount(0);
  await page.keyboard.down('KeyE');
  await page.keyboard.down('KeyD');
  try { await expect(prompt).toContainText('升华公寓'); } finally { await page.keyboard.up('KeyD'); }
  await expect(page.locator('.place-overlay')).toHaveCount(0);
  await page.keyboard.up('KeyE');
  await page.keyboard.press('KeyE');
  await expect(page.getByRole('heading', { name: '升华公寓 · 楼栋群聊' })).toBeVisible();
});

test('可以选择升华公寓楼栋并加入对应群聊发送消息', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/#dormitory');

  await expect(page.getByRole('heading', { name: '升华公寓 · 楼栋群聊' })).toBeVisible();
  await expect(page.locator('.dorm-building-card')).toHaveCount(8);

  await page.locator('.dorm-building-card').nth(2).click();
  await expect(page.getByRole('heading', { name: '升华公寓 · 3 栋群' })).toBeVisible();
  await page.getByRole('button', { name: '加入 3 栋 群聊' }).click();

  const composer = page.getByLabel('发送消息');
  await expect(composer).toBeVisible();
  await composer.fill('今晚一起去二食堂吗？');
  const savedResponse = page.waitForResponse(response => response.url().endsWith('/api/dorm-chat/shenghua-3/messages') && response.request().method() === 'POST');
  await page.getByRole('button', { name: /发送/ }).click();
  expect((await savedResponse).status()).toBe(201);
  await expect(page.getByText('今晚一起去二食堂吗？')).toBeVisible();
  const stored = await page.request.get('/api/dorm-chat/shenghua-3/messages');
  expect(stored.ok()).toBe(true);
  expect((await stored.json()).messages).toEqual(expect.arrayContaining([expect.objectContaining({ text: '今晚一起去二食堂吗？' })]));
  await page.reload();
  await expect(page.getByText('今晚一起去二食堂吗？')).toBeVisible();
  await page.getByRole('button', { name: '返回校园', exact: true }).click();
  await expect(page.getByRole('status', { name: '地图加载状态' })).toHaveText('地图已加载');
  expect(errors).toEqual([]);
});
