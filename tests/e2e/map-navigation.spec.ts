import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const annotation = JSON.parse(readFileSync('public/maps/campus-v20.annotations.json', 'utf8'));

for (const scenario of [
  { name: '操场内部', x: 725, y: 590, key: 'KeyS', axis: 'y', direction: 1 },
  { name: '西侧草地', x: 180, y: 1300, key: 'KeyD', axis: 'x', direction: 1 },
  { name: '清水路边树木', x: 307, y: 535, key: 'KeyD', axis: 'x', direction: 1 },
  { name: '玉带湖东侧木桥', x: 928, y: 1365, key: 'KeyA', axis: 'x', direction: -1 },
] as const) {
  test(`正式地图碰撞：${scenario.name}可骑行`, async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    // 只为测试指定起点；碰撞区域、底图、移动与渲染全部使用正式数据和代码。
    await page.route('**/maps/campus-v20.annotations.json', (route) => route.fulfill({ json: {
      ...annotation,
      safePoints: [{ id: 'test-spawn', position: { x: scenario.x, y: scenario.y }, usage: ['spawn'], verificationStatus: 'verified' }],
    } }));
    await page.goto('/');
    const status = page.getByTestId('character-status');
    await expect(status).toContainText(`位置 ${scenario.x}, ${scenario.y}`);
    await page.keyboard.down('Shift');
    await page.keyboard.down(scenario.key);
    await expect(status).toContainText('骑行');
    await page.waitForTimeout(350);
    await page.keyboard.up(scenario.key);
    await page.keyboard.up('Shift');
    const match = (await status.innerText()).match(/位置 (\d+), (\d+)/)!;
    const after = { x: Number(match[1]), y: Number(match[2]) };
    expect((after[scenario.axis] - scenario[scenario.axis]) * scenario.direction).toBeGreaterThan(25);
    expect(after[scenario.axis === 'x' ? 'y' : 'x']).toBe(scenario[scenario.axis === 'x' ? 'y' : 'x']);
    await page.screenshot({ path: testInfo.outputPath('navigation.png'), fullPage: true });
    expect(errors).toEqual([]);
  });
}
