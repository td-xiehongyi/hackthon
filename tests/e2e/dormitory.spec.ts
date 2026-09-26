import { expect, test } from '@playwright/test';

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
  await page.getByRole('button', { name: /发送/ }).click();
  await expect(page.getByText('今晚一起去二食堂吗？')).toBeVisible();
  expect(errors).toEqual([]);
});

