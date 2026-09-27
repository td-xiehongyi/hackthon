import { expect, test, type Page } from '@playwright/test';

/**
 * 开发测试场景（临时）：验证角色加载、移动、碰撞、骑行切换、输入中断。
 * 地形为合成测试数据，角色为队友原型占位造型——通过这些测试只证明运行逻辑，
 * 不代表 v20 地图标定、正式角色美术或移动参数已验收。
 */

const PLAYGROUND = '/?scene=dev-playground';

async function position(page: Page) {
  const [x, y] = (await page.getByTestId('hud-position').innerText()).split(',').map(Number);
  return { x: x!, y: y! };
}

async function hold(page: Page, keys: string[], ms: number) {
  for (const key of keys) await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  for (const key of [...keys].reverse()) await page.keyboard.up(key);
}

async function open(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(PLAYGROUND);
  await expect(page.getByRole('status', { name: '测试场景状态' })).toHaveText('测试场景已就绪');
  await expect(page.getByRole('note')).toContainText('非正式验收');
  await page.locator('canvas').click();
  return errors;
}

test('临时角色加载并用 WASD 移动，朝向随按键变化，停下后保留朝向', async ({ page }) => {
  const errors = await open(page);
  const start = await position(page);
  await expect(page.getByTestId('hud-facing')).toHaveText('down');

  await hold(page, ['KeyD'], 400);
  const moved = await position(page);
  expect(moved.x).toBeGreaterThan(start.x + 10);
  expect(moved.y).toBe(start.y);
  await expect(page.getByTestId('hud-facing')).toHaveText('right');
  await expect(page.getByTestId('hud-action')).toHaveText('idle');

  await hold(page, ['KeyW'], 200);
  await expect(page.getByTestId('hud-facing')).toHaveText('up');
  expect(errors).toEqual([]);
});

test('按住 Shift 骑行更快，松开恢复步行', async ({ page }) => {
  await open(page);
  const a = await position(page);
  await hold(page, ['KeyA'], 400);
  const walked = a.x - (await position(page)).x;

  await page.keyboard.down('Shift');
  await page.keyboard.down('KeyD');
  await expect(page.getByTestId('hud-mode')).toHaveText('ride');
  const b = await position(page);
  await page.waitForTimeout(400);
  const rode = (await position(page)).x - b.x;
  await page.keyboard.up('KeyD');
  await page.keyboard.up('Shift');

  expect(rode).toBeGreaterThan(walked * 1.4);
  await hold(page, ['KeyS'], 100);
  await expect(page.getByTestId('hud-mode')).toHaveText('walk');
});

test('不能穿越建筑与广场边界', async ({ page }) => {
  await open(page);
  // 出生点 (150,130) 正北是广场上边界 y=20，建筑在 x 60–120，不在正北方向。
  await hold(page, ['KeyW'], 2500);
  const top = await position(page);
  expect(top.y).toBeGreaterThanOrEqual(24); // 碰撞体高 4，顶边停在 y=20
  expect(top.y).toBeLessThan(30);
  // 向西走会撞到建筑东墙（x=120），碰撞体半宽 4。
  await hold(page, ['KeyS'], 700);
  await hold(page, ['KeyA'], 2000);
  expect((await position(page)).x).toBeGreaterThanOrEqual(124);
});

test('在输入框内打字、窗口失焦、模拟功能页打开时角色都不移动', async ({ page }) => {
  await open(page);
  const start = await position(page);

  const input = page.getByPlaceholder('在这里打字');
  await input.click();
  await hold(page, ['KeyD'], 400);
  await expect(input).toHaveValue('d');
  expect(await position(page)).toEqual(start);

  // 画布聚焦后按住 D，途中窗口失焦：失焦后停止并清键。
  await page.locator('canvas').click();
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(150);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  const afterBlur = await position(page);
  await page.waitForTimeout(300);
  expect(await position(page)).toEqual(afterBlur);
  await page.keyboard.up('KeyD');

  await page.getByLabel('模拟功能页打开（暂停移动并清键）').check();
  await expect(page.getByTestId('hud-suspended')).toHaveText('已暂停');
  await page.locator('canvas').click();
  const suspended = await position(page);
  await hold(page, ['KeyA'], 300);
  expect(await position(page)).toEqual(suspended);

  await page.getByLabel('模拟功能页打开（暂停移动并清键）').uncheck();
  await page.locator('canvas').click();
  await hold(page, ['KeyA'], 300);
  expect((await position(page)).x).toBeLessThan(suspended.x);
});

test('生产入口不暴露测试场景：无参数时仍为地图预览', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '中南大学像素校园' })).toBeVisible();
  await expect(page.getByText('测试场景已就绪')).toHaveCount(0);
});

test('按住移动键时把焦点移到输入框，立即清键且重复按键不会恢复移动', async ({ page }) => {
  await open(page);
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(120);
  await page.getByPlaceholder('在这里打字').focus();
  await expect(page.getByTestId('hud-action')).toHaveText('idle');
  const stopped = await position(page);
  await page.waitForTimeout(200);
  expect(await position(page)).toEqual(stopped);
  await page.locator('canvas').focus();
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD', repeat: true })));
  await page.waitForTimeout(200);
  expect(await position(page)).toEqual(stopped);
  await page.keyboard.up('KeyD');
});
