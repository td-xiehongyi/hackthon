import { readFileSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';

/** 只调整测试出生点；碰撞、建筑交互和渲染使用正式地图。 */
export async function enterCampusAt(page: Page, x: number, y: number) {
  const map = JSON.parse(readFileSync('public/maps/campus-v20.annotations.json', 'utf8'));
  map.safePoints = [{ id: 'test-spawn', position: { x, y }, usage: ['spawn'], verificationStatus: 'verified' }];
  await page.route('**/maps/campus-v20.annotations.json', route => route.fulfill({ json: map }));
  await page.goto('/');
  await page.getByRole('button', { name: '进入校园', exact: true }).click();
  await expect(page.getByRole('status', { name: '地图加载状态' })).toHaveText('地图已加载');
}

export async function dragMap(page: Page) {
  const box = (await page.locator('.map-canvas canvas').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 70, box.y + box.height / 2 + 50, { steps: 8 });
  await page.mouse.up();
}
