import { dragMap, enterCampusAt } from './helpers/campus';
import { expect, test } from '@playwright/test';
import { MAP_DISPLAY_IMAGE_PATH } from '../../src/shared/contracts';

test('地图可加载、缩放、拖动并恢复角色跟随', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: '进入校园', exact: true }).click();
  await expect(page.getByRole('heading', { name: '附近地图' })).toBeVisible();
  await expect(page.getByRole('status', { name: '地图加载状态' })).toHaveText('地图已加载');
  await expect(page.getByTestId('character-status')).toContainText('位置 600, 1320');
  await expect(page.getByTestId('interact-prompt')).toContainText('图书馆');
  await page.keyboard.press('KeyE');
  await expect(page.getByRole('heading', { name: '潇湘校区图书馆', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '返回校园', exact: true }).click();
  await expect(page.getByTestId('character-status')).toContainText('位置 600, 1320');
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();
  const zoom = page.getByLabel('当前缩放');
  const fittedZoom = await zoom.innerText();
  // Wait for Phaser's follow camera to finish its first render after onReady.
  let initialFrame = await canvas.screenshot();
  await expect.poll(async () => {
    const nextFrame = await canvas.screenshot();
    const stable = nextFrame.equals(initialFrame);
    initialFrame = nextFrame;
    return stable;
  }).toBe(true);
  const before = await canvas.screenshot();
  await page.getByRole('button', { name: '放大地图', exact: true }).click();
  await page.mouse.move(0, 0);
  await expect(zoom).not.toHaveText(fittedZoom);
  // Screenshot comparison observes actual camera rendering, not just button labels.
  await expect.poll(async () => (await canvas.screenshot()).equals(before)).toBe(false);
  const box = (await canvas.boundingBox())!;
  const zoomed = await canvas.screenshot();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 90, box.y + box.height / 2 + 50, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => (await canvas.screenshot()).equals(zoomed)).toBe(false);
  await page.getByRole('button', { name: '回到角色位置' }).click();
  // Canvas screenshots include overlaid controls; remove button hover styling.
  await page.mouse.move(0, 0);
  await expect(zoom).toHaveText(fittedZoom);
  await expect.poll(async () => (await canvas.screenshot()).equals(before)).toBe(true);
  await expect(page.locator('.explorer-map-status')).toContainText('角色跟随');
  expect(errors).toEqual([]);
});

test('图片读取失败时明确提示，不能显示加载成功', async ({ page }) => {
  await page.route(`**${MAP_DISPLAY_IMAGE_PATH}`, (route) => route.abort());
  await page.goto('/');
  await page.getByRole('button', { name: '进入校园', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('地图加载失败');
  await expect(page.getByRole('button', { name: '放大地图', exact: true })).toBeDisabled();
  await expect(page.getByRole('status', { name: '地图加载状态' })).not.toHaveText('地图已加载');
});

test('角色模式：打开即放出角色，按通行标注跑动与骑行，被障碍挡住，镜头跟随', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  // 碰撞用例固定从二食堂南侧开始，不依赖正式出生点。
  await enterCampusAt(page, 521, 756);
  await expect(page.getByRole('status', { name: '地图加载状态' })).toHaveText('地图已加载');
  const status = page.getByTestId('character-status');
  const pos = async () => {
    const m = (await status.innerText()).match(/位置 (\d+), (\d+) · (步行|骑行) · 朝向 (\w+)/);
    expect(m, '应显示角色位置').not.toBeNull();
    return { x: Number(m![1]), y: Number(m![2]), mode: m![3], facing: m![4] };
  };
  const hold = async (keys: string[], ms: number) => {
    for (const k of keys) await page.keyboard.down(k);
    await page.waitForTimeout(ms);
    for (const k of [...keys].reverse()) await page.keyboard.up(k);
  };

  await expect(page.locator('.explorer-map-status')).toContainText('角色跟随');
  await expect(status).toContainText('位置');
  const start = await pos();
  const canvas = page.locator('canvas');
  const before = await canvas.screenshot();

  await hold(['KeyA'], 250);
  const walked = await pos();
  expect(walked.x).toBeLessThan(start.x - 5);
  expect(walked).toMatchObject({ y: start.y, mode: '步行', facing: 'left' });
  expect((await canvas.screenshot()).equals(before)).toBe(false); // 镜头跟随

  // 二食堂南侧树木可穿过，继续向北到达建筑边缘才停止。
  await hold(['KeyW'], 2000);
  const blocked = await pos();
  await hold(['KeyW'], 600);
  expect(await pos()).toEqual(blocked);
  expect(blocked.facing).toBe('up');
  expect(blocked.y).toBeGreaterThanOrEqual(727);
  expect(blocked.y).toBeLessThanOrEqual(730);

  // 骑行切换与松开恢复。
  await page.keyboard.down('Shift');
  await page.keyboard.down('KeyS');
  await expect(status).toContainText('骑行');
  await page.keyboard.up('KeyS');
  await page.keyboard.up('Shift');
  await hold(['KeyS'], 50);
  await expect(status).toContainText('步行');

  // 拖动浏览后定位回到角色，位置不变。
  const last = await pos();
  await dragMap(page);
  await expect(page.locator('.explorer-map-status')).toContainText('自由浏览');
  await page.getByRole('button', { name: '回到角色位置' }).click();
  expect(await pos()).toMatchObject({ x: last.x, y: last.y });
  expect(errors).toEqual([]);
});

test('通行标注不可用时停止移动并明确提示', async ({ page }) => {
  await page.route('**/maps/campus-v20.annotations.json', (route) => route.abort());
  await page.goto('/');
  await page.getByRole('button', { name: '进入校园', exact: true }).click();
  await expect(page.getByRole('status', { name: '地图加载状态' })).toHaveText('地图已加载');
  await expect(page.getByRole('note')).toContainText('移动已停用');
  await expect(page.getByRole('note')).toContainText('通行标注文件未能加载');
  await expect(page.getByRole('button', { name: '回到角色位置' })).toBeDisabled();
});

test('角色模式下在输入框外失焦时停止移动', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '进入校园', exact: true }).click();
  await expect(page.getByRole('status', { name: '地图加载状态' })).toHaveText('地图已加载');
  const status = page.getByTestId('character-status');
  await expect(status).toContainText('位置');
  await page.keyboard.down('KeyS');
  await page.waitForTimeout(150);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  const afterBlur = await status.innerText();
  await page.waitForTimeout(300);
  expect(await status.innerText()).toBe(afterBlur);
  await page.keyboard.up('KeyS');
});
