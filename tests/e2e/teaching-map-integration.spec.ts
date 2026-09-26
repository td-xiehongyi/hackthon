import { expect, test } from '@playwright/test';

test('快速录入保留未保存提示、保存课程并在刷新后恢复，录入时地图暂停', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('status', { name: '地图加载状态' })).toHaveText('地图已加载');
  const status = page.getByTestId('character-status');
  await expect(status).toContainText('位置');
  const before = await status.textContent();
  await page.getByRole('button', { name: '快速录入课表', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '学习 · 我的课表' });
  await expect(dialog.getByText(/0 门课程/)).toBeVisible();
  await page.keyboard.down('KeyS');
  await page.waitForTimeout(300);
  await page.keyboard.up('KeyS');
  await expect(status).toHaveText(before!);
  await dialog.getByRole('gridcell').first().click();
  await dialog.getByLabel('课程名称', { exact: true }).fill('合并验证课程');
  page.once('dialog', (prompt) => prompt.dismiss());
  await dialog.getByRole('button', { name: '关闭课表录入' }).click();
  await expect(dialog.getByLabel('课程名称', { exact: true })).toHaveValue('合并验证课程');
  await dialog.getByRole('button', { name: '保存课程' }).click();
  await expect(dialog.getByRole('gridcell', { name: /合并验证课程/ })).toBeVisible();
  await dialog.getByRole('button', { name: '关闭课表录入' }).click();
  await expect(dialog).toBeHidden();
  await page.reload();
  await page.getByRole('button', { name: '快速录入课表', exact: true }).click();
  await expect(dialog.getByRole('gridcell', { name: /合并验证课程/ })).toBeVisible();
});

test('进入教学页暂停地图，返回后保留角色位置并恢复移动', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('status', { name: '地图加载状态' })).toHaveText('地图已加载');
  const status = page.getByTestId('character-status');
  await expect(status).toContainText('位置');
  const before = await status.textContent();
  await page.getByRole('button', { name: '进入教学楼群', exact: true }).click();
  await expect(page.getByRole('heading', { name: '课表与蹭课中心' })).toBeVisible();
  await page.keyboard.down('KeyS');
  await page.waitForTimeout(300);
  await page.keyboard.up('KeyS');
  expect(await status.textContent()).toBe(before);
  await page.goBack();
  await expect(status).toBeVisible();
  await expect(status).toHaveText(before!);
  const position = before!.match(/位置 \d+, \d+/)![0];
  await page.keyboard.down('KeyS');
  try {
    await expect(status).not.toContainText(position);
  } finally {
    await page.keyboard.up('KeyS');
  }
});
