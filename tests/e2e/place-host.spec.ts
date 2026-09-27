import { expect, test, type Page } from '@playwright/test';
import { enterCampusAt } from './helpers/campus';

/**
 * 阶段 3：E 键互动与功能页宿主（开发测试场景）。
 *
 * 互动范围为合成测试夹具，只借用三个固定 placeId；通过这些测试证明
 * “进入范围 → 按 E → 功能页 → 返回原位”的运行逻辑，不代表 v20 地图入口已标定。
 */

const PLAYGROUND = '/?scene=dev-playground';

async function open(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(PLAYGROUND);
  await expect(page.getByRole('status', { name: '测试场景状态' })).toHaveText('测试场景已就绪');
  return errors;
}

async function teleport(page: Page, label: string) {
  await page.getByRole('button', { name: label, exact: true }).click();
  await expect(page.locator('canvas')).toBeFocused();
}

async function hud(page: Page) {
  return {
    position: await page.getByTestId('hud-position').innerText(),
    facing: await page.getByTestId('hud-facing').innerText(),
  };
}

const panelHeading = (page: Page, name: string) => page.getByRole('heading', { name, exact: true });

test('范围内显示提示，按 E 进入对应功能页；返回后恢复原位置与朝向', async ({ page }) => {
  const errors = await open(page);
  await teleport(page, '图书馆范围');
  // 在范围内挪一步，改变朝向，确认返回时恢复的是按 E 那一刻的状态。
  await page.keyboard.down('KeyA');
  await page.waitForTimeout(120);
  await page.keyboard.up('KeyA');
  await expect(page.getByTestId('interact-prompt')).toHaveText('按 E 进入【潇湘校区图书馆】');
  const before = await hud(page);
  expect(before.facing).toBe('left');

  await page.keyboard.press('KeyE');
  await expect(panelHeading(page, '潇湘校区图书馆')).toBeVisible();
  await expect(page.getByText('简介内容缺失，待核验补充。')).toBeVisible();
  await expect(page.getByTestId('hud-position')).toBeHidden(); // 地图页隐藏但保持挂载

  await page.getByRole('button', { name: '返回校园' }).click();
  await expect(panelHeading(page, '潇湘校区图书馆')).toHaveCount(0);
  expect(await hud(page)).toEqual(before);
  await expect(page.getByTestId('hud-suspended')).toHaveText('可移动');
  expect(errors).toEqual([]);
});

test('范围外按 E 不打开；走入范围不会自动打开', async ({ page }) => {
  await open(page);
  await teleport(page, '范围外');
  await expect(page.getByTestId('hud-target')).toHaveText('无');
  await expect(page.getByTestId('interact-prompt')).toHaveCount(0);
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(200);
  await expect(page.getByRole('button', { name: '返回校园' })).toHaveCount(0);

  await teleport(page, '副场范围');
  await expect(page.getByTestId('hud-target')).toHaveText('潇湘校区体育场（副场）');
  await page.waitForTimeout(400);
  await expect(page.getByRole('button', { name: '返回校园' })).toHaveCount(0);
});

test('按住 E 再进入范围不会打开，必须松开后重新按下', async ({ page }) => {
  await open(page);
  await teleport(page, '范围外');
  await page.keyboard.down('KeyE');
  // 按住 E 期间进入范围；浏览器此后只会产生 repeat 事件。
  await page.evaluate(() => {
    for (let i = 0; i < 5; i++) {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', key: 'e', repeat: true, bubbles: true }));
    }
  });
  await teleport(page, '图书馆范围');
  await page.evaluate(() => {
    for (let i = 0; i < 5; i++) {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', key: 'e', repeat: true, bubbles: true }));
    }
  });
  await page.waitForTimeout(200);
  await expect(page.getByRole('button', { name: '返回校园' })).toHaveCount(0);

  await page.keyboard.up('KeyE');
  await page.keyboard.press('KeyE');
  await expect(panelHeading(page, '潇湘校区图书馆')).toBeVisible();
});

test('返回后持续按住 E 不会立刻重新进入', async ({ page }) => {
  await open(page);
  await teleport(page, '教学楼群范围');
  await page.keyboard.down('KeyE');
  await expect(panelHeading(page, '潇湘校区教学楼群')).toBeVisible();
  await page.getByRole('button', { name: '返回校园' }).click();
  await expect(panelHeading(page, '潇湘校区教学楼群')).toHaveCount(0);
  await page.evaluate(() => {
    for (let i = 0; i < 5; i++) {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', key: 'e', repeat: true, bubbles: true }));
    }
  });
  await page.waitForTimeout(200);
  await expect(page.getByRole('button', { name: '返回校园' })).toHaveCount(0);
  await page.keyboard.up('KeyE');
});

test('重叠范围：提示对象与打开对象一致', async ({ page }) => {
  await open(page);
  await teleport(page, '重叠区');
  await expect(page.getByTestId('interact-prompt')).toHaveText('按 E 进入【潇湘校区教学楼群】');
  await page.keyboard.press('KeyE');
  await expect(panelHeading(page, '潇湘校区教学楼群')).toBeVisible();
  await expect(panelHeading(page, '潇湘校区体育场（副场）')).toHaveCount(0);
});

test('输入框内的 E 不触发地图互动；功能页内按 E 也不叠加页面', async ({ page }) => {
  await open(page);
  await teleport(page, '教学楼群范围');
  const input = page.getByPlaceholder('在这里打字');
  await input.click();
  await page.keyboard.press('KeyE');
  await expect(input).toHaveValue('e');
  await expect(page.getByRole('button', { name: '返回校园' })).toHaveCount(0);

  await page.locator('canvas').click();
  await page.keyboard.press('KeyE');
  await expect(panelHeading(page, '潇湘校区教学楼群')).toBeVisible();
  const field = page.getByPlaceholder('在此输入内容，E 键不触发地图互动');
  await field.fill('ab');
  await page.keyboard.press('KeyE');
  // 输入框正常收到 e，地图不响应，也不会叠加第二个功能页。
  await expect(field).toHaveValue('abe');
  await expect(page.getByRole('region', { name: /功能页面$/ })).toHaveCount(1);
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('KeyE');
  await expect(page.getByRole('region', { name: /功能页面$/ })).toHaveCount(1);
});

test('功能页打开期间角色不移动；关闭检查未通过时保留页面', async ({ page }) => {
  await open(page);
  await teleport(page, '教学楼群范围');
  const before = await hud(page);
  await page.keyboard.press('KeyE');
  await expect(panelHeading(page, '潇湘校区教学楼群')).toBeVisible();

  await page.keyboard.down('KeyD');
  await page.waitForTimeout(300);
  await page.keyboard.up('KeyD');

  await page.getByPlaceholder('在此输入内容，E 键不触发地图互动').fill('草稿');
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: '返回校园' }).click();
  await expect(panelHeading(page, '潇湘校区教学楼群')).toBeVisible();

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '返回校园' }).click();
  await expect(panelHeading(page, '潇湘校区教学楼群')).toHaveCount(0);
  expect(await hud(page)).toEqual(before);
});

test('定位回调区分 unmapped / unknown-target，不放置虚假标记', async ({ page }) => {
  await open(page);
  await teleport(page, '教学楼群范围');
  await page.keyboard.press('KeyE');
  await page.getByRole('button', { name: '定位本地点' }).click();
  const result = page.getByRole('status').filter({ hasText: '定位结果' });
  await expect(result).toContainText('unmapped');
  await page.getByRole('button', { name: '定位未登记楼座' }).click();
  await expect(result).toContainText('unknown-target');
});

test('首页：出生位置远离互动区时，按 E 不打开地点', async ({ page }) => {
  await enterCampusAt(page, 180, 1300);
  await expect(page.getByRole('button', { name: '潇湘校区图书馆' })).toHaveCount(0);
  await expect(page.getByTestId('character-status')).toContainText('位置 180, 1300');
  await expect(page.getByTestId('interact-prompt')).toHaveCount(0);
  await page.keyboard.press('KeyE');
  await expect(page.getByRole('button', { name: '返回校园' })).toHaveCount(0);
});

