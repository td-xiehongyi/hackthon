import { expect, test } from '@playwright/test';

test('图书馆保留学习工具并可进入封校小游戏', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?scene=dev-playground');
  await expect(page.getByRole('status', { name: '测试场景状态' })).toHaveText('测试场景已就绪');
  await page.getByRole('button', { name: '图书馆范围', exact: true }).click();
  await page.keyboard.press('KeyE');

  const panel = page.getByRole('region', { name: '潇湘校区图书馆' });
  await expect(panel).toBeVisible();
  await panel.getByRole('tab', { name: '学习', exact: true }).click();
  await expect(panel.getByRole('tab', { name: '我的课表' })).toBeVisible();
  await expect(panel.getByRole('link', { name: /打开 Folo/ })).toBeVisible();

  await panel.getByRole('tab', { name: '发呆 · 小游戏' }).click();
  const game = panel.getByRole('region', { name: '封校倒计时小游戏' });
  await expect(game.getByRole('button', { name: '开始逃生' })).toBeVisible();
  await game.getByRole('button', { name: '开始逃生' }).click();
  await expect(game.getByText('0/3 装置')).toBeVisible();
  await page.keyboard.press('KeyH');
  await expect(game.getByRole('status')).toHaveText('找一间教室、储物柜或厕所再按 H。');
  await page.keyboard.press('ArrowRight');
  await expect(game.getByLabel('玩家')).toHaveAttribute('style', /left: 14%/);
  await panel.getByRole('button', { name: '返回校园' }).click();
  await expect(panel).toHaveCount(0);
  expect(errors).toEqual([]);
});
