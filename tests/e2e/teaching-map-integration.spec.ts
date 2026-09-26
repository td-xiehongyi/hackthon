import { expect, test } from '@playwright/test';
import { enterCampusAt } from './helpers/campus';

test('图书馆课表保留未保存内容、保存后刷新恢复，录入时地图暂停', async ({ page }) => {
  await enterCampusAt(page, 600, 1320);
  await expect(page.getByTestId('interact-prompt')).toContainText('图书馆');
  const status = page.getByTestId('character-status');
  const before = await status.textContent();
  await page.keyboard.press('KeyE');
  await page.getByRole('tab', { name: '学习', exact: true }).click();
  await page.getByRole('tab', { name: '我的课表', exact: true }).click();
  const panel = page.getByRole('region', { name: '潇湘校区图书馆' });
  await page.keyboard.down('KeyS');
  await page.waitForTimeout(200);
  await page.keyboard.up('KeyS');
  await expect(status).toHaveText(before!);
  await panel.getByRole('gridcell').first().click();
  await panel.getByLabel('课程名称', { exact: true }).fill('合并验证课程');
  await page.getByRole('button', { name: '返回校园', exact: true }).click();
  await expect(panel.getByLabel('课程名称', { exact: true })).toHaveValue('合并验证课程');
  await expect(page.getByRole('alert')).toContainText('未保存修改');
  await panel.getByRole('button', { name: '保存课程' }).click();
  await page.getByRole('button', { name: '返回校园', exact: true }).click();
  await expect(page.getByRole('heading', { name: '附近地图' })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: '进入校园', exact: true }).click();
  await expect(page.getByTestId('interact-prompt')).toContainText('图书馆');
  await page.keyboard.press('KeyE');
  await page.getByRole('tab', { name: '学习', exact: true }).click();
  await page.getByRole('tab', { name: '我的课表', exact: true }).click();
  await expect(panel.getByRole('gridcell', { name: /合并验证课程/ })).toBeVisible();
});

test('从建筑进入教学页暂停地图，返回后保留角色位置并恢复移动', async ({ page }) => {
  await enterCampusAt(page, 506, 1234);
  await expect(page.getByTestId('interact-prompt')).toContainText('教学楼群');
  const status = page.getByTestId('character-status');
  const before = await status.textContent();
  await page.keyboard.press('KeyE');
  await expect(page.getByRole('heading', { name: '课表与蹭课中心' })).toBeVisible();
  await page.keyboard.down('KeyS');
  await page.waitForTimeout(200);
  await page.keyboard.up('KeyS');
  await expect(status).toHaveText(before!);
  await page.getByRole('button', { name: '返回校园', exact: true }).click();
  await expect(page.getByRole('heading', { name: '附近地图' })).toBeVisible();
  await expect(status).toHaveText(before!);
  const position = before!.match(/位置 \d+, \d+/)![0];
  await page.keyboard.down('KeyS');
  try { await expect(status).not.toContainText(position); }
  finally { await page.keyboard.up('KeyS'); }
});
