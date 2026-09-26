import { dragMap } from './helpers/campus';
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

const places = [
  { name: '潇湘校区教学楼群', x: 506, y: 1234, heading: '课表与蹭课中心' },
  { name: '潇湘校区图书馆', x: 600, y: 1320, heading: '潇湘校区图书馆' },
  { name: '潇湘校区体育场（副场）', x: 425, y: 934, heading: '潇湘校区体育场（副场）' },
];

for (const place of places) {
  test(`${place.name}：靠近高亮、按 E 进入、返回原位`, async ({ page }, testInfo) => {
    const map = JSON.parse(readFileSync('public/maps/campus-v20.annotations.json', 'utf8'));
    // 仅改出生点，使用真实地图的通行与互动范围。
    map.safePoints = [{ id: 'test-spawn', position: { x: place.x, y: place.y }, usage: ['spawn'], verificationStatus: 'verified' }];
    await page.route('**/maps/campus-v20.annotations.json', (route) => route.fulfill({ json: map }));
    await page.goto('/');
  await page.getByRole('button', { name: '进入校园', exact: true }).click();
    await expect(page.getByRole('status', { name: '地图加载状态' })).toHaveText('地图已加载');
    const prompt = page.getByTestId('interact-prompt');
    await expect(prompt).toContainText(place.name, { timeout: 2500 });
    await expect(page.getByRole('button', { name: '返回校园', exact: true })).toHaveCount(0);
    const before = await page.getByTestId('character-status').textContent();
    const canvas = page.locator('.map-canvas canvas');
    await canvas.screenshot({ path: testInfo.outputPath('building-highlight.png') });
    await page.keyboard.press('KeyE');
    await expect(page.getByRole('heading', { name: place.heading, exact: true })).toBeVisible();
    await page.getByRole('button', { name: '返回校园', exact: true }).click();
    await expect(prompt).toContainText(place.name);
    await expect(page.getByTestId('character-status')).toHaveText(before!);
    await page.waitForTimeout(250);
    await expect(page.getByRole('button', { name: '返回校园', exact: true })).toHaveCount(0);
    // 打开其他面板时撤下互动提示；关闭后恢复当前目标。
    await page.getByRole('button', { name: '返回首页', exact: true }).click();
    await expect(prompt).toHaveCount(0);
    await page.getByRole('button', { name: '进入校园', exact: true }).click();
    await expect(prompt).toContainText(place.name);
    await page.keyboard.down('KeyW');
    try { await expect(prompt).toHaveCount(0); } finally { await page.keyboard.up('KeyW'); }
    await page.keyboard.press('KeyE');
    await expect(page.getByRole('button', { name: '返回校园', exact: true })).toHaveCount(0);
  });
}

test('按住 E 走入范围不触发；松开重按才打开，切换浏览模式取消提示', async ({ page }) => {
  const map = JSON.parse(readFileSync('public/maps/campus-v20.annotations.json', 'utf8'));
  map.safePoints = [{ id: 'test-spawn', position: { x: 506, y: 1215 }, usage: ['spawn'], verificationStatus: 'verified' }];
  await page.route('**/maps/campus-v20.annotations.json', (route) => route.fulfill({ json: map }));
  await page.goto('/');
  await page.getByRole('button', { name: '进入校园', exact: true }).click();
  await expect(page.getByRole('status', { name: '地图加载状态' })).toHaveText('地图已加载');
  const prompt = page.getByTestId('interact-prompt');
  await expect(prompt).toHaveCount(0);
  await page.keyboard.down('KeyE');
  await page.keyboard.down('KeyS');
  try { await expect(prompt).toContainText('教学楼群'); } finally { await page.keyboard.up('KeyS'); }
  await page.keyboard.down('KeyE'); // 已按住：repeat 为 true。
  await expect(page.getByRole('button', { name: '返回校园', exact: true })).toHaveCount(0);
  await page.keyboard.up('KeyE');
  await dragMap(page);
  await expect(prompt).toHaveCount(0);
  await page.keyboard.press('KeyE');
  await expect(page.getByRole('button', { name: '返回校园', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '回到角色位置' }).click();
  await expect(prompt).toContainText('教学楼群');
  await page.keyboard.press('KeyE');
  await expect(page.getByRole('heading', { name: '课表与蹭课中心', exact: true })).toBeVisible();
});
