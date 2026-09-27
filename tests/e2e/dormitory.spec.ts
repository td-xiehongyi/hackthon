import { expect, test } from '@playwright/test';
import { enterCampusAt } from './helpers/campus';

test('校园群聊入口暂停角色，浏览器后退恢复原位，地点内禁止绕过返回流程', async ({ page }) => {
  await enterCampusAt(page, 600, 1320);
  const position = await page.getByTestId('character-status').textContent();
  const entry = page.getByRole('button', { name: '升华公寓群聊', exact: true });
  await expect(entry).toBeVisible();
  await entry.click();
  await expect(page.getByRole('heading', { name: '升华公寓 · 楼栋群聊' })).toBeVisible();
  await page.keyboard.press('KeyD');
  await page.goBack();
  await expect(page.getByTestId('character-status')).toHaveText(position!);
  await expect(entry).toBeVisible();
  await page.keyboard.press('KeyE');
  await expect(page.getByRole('button', { name: '返回校园', exact: true })).toBeVisible();
  await expect(entry).toBeDisabled();
  await page.getByRole('button', { name: '返回校园', exact: true }).click();
  await expect(entry).toBeEnabled();
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
