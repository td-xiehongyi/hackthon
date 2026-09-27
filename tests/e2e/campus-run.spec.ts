import { expect, test, type Page } from '@playwright/test';
import { enterCampusAt } from './helpers/campus';

async function openRun(page: Page) {
  await enterCampusAt(page, 425, 934);
  await page.keyboard.press('KeyE');
  await page.getByRole('tab', { name: '校园跑', exact: true }).click();
  await expect(page.getByRole('button', { name: '开始校园跑', exact: true })).toBeEnabled();
}

async function position(page: Page) {
  return page.getByTestId('campus-run-player').evaluate(el => ({ x: Number(el.getAttribute('data-x')), y: Number(el.getAttribute('data-y')) }));
}

async function steerTo(page: Page, x: number, y: number) {
  for (let i = 0; i < 150; i++) {
    if (await page.getByLabel('校园跑小游戏', { exact: true }).getAttribute('data-status') === 'success') return;
    const current = await position(page);
    const dx = x - current.x, dy = y - current.y;
    if (Math.hypot(dx, dy) < 9) return;
    const pressed: string[] = [];
    if (Math.abs(dx) > 4 && Math.abs(dx) >= Math.abs(dy) * .5) pressed.push(dx > 0 ? 'KeyD' : 'KeyA');
    if (Math.abs(dy) > 4 && Math.abs(dy) >= Math.abs(dx) * .5) pressed.push(dy > 0 ? 'KeyS' : 'KeyW');
    for (const key of pressed) await page.keyboard.down(key);
    await page.clock.runFor(65);
    for (const key of pressed) await page.keyboard.up(key);
  }
  throw new Error(`无法沿跑道到达 ${x}, ${y}; 当前 ${JSON.stringify(await position(page))}`);
}

test('逆时针一圈成功；持续 Shift 后角色淡入再从头顶警告，原地图暂停', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem('csu-campus-character', 'photo-gray-student'));
  await openRun(page);
  const game = page.getByLabel('校园跑小游戏', { exact: true });
  const mapPosition = await page.getByTestId('character-status').textContent();
  await expect(game).toHaveAttribute('data-character', 'photo-gray-student');
  await page.screenshot({ path: testInfo.outputPath('campus-run-ready.png') });
  await page.getByRole('button', { name: '开始校园跑', exact: true }).click();
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await steerTo(page, 720, 420);
  await expect(game.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
  const beforeWarning = await position(page);
  await page.keyboard.down('ShiftLeft');
  const warning = page.getByRole('dialog', { name: '操场禁止骑电动车！！！' });
  const guard = page.getByAltText('抱臂提醒禁止骑电动车的角色');
  await page.clock.runFor(700);
  await expect(guard).toHaveCount(0);
  await expect(warning).toHaveCount(0);
  await expect(page.getByTestId('campus-run-player')).toHaveAttribute('data-mode', 'ride');
  await page.clock.runFor(65);
  await expect(game).toHaveAttribute('data-status', 'guard-entering');
  await expect(warning).toHaveCount(0);
  await page.clock.runFor(175);
  const opacity = Number(await guard.evaluate(el => getComputedStyle(el).opacity));
  expect(opacity).toBeGreaterThan(.3);
  expect(opacity).toBeLessThan(.8);
  await expect(warning).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('campus-run-guard-fade.png') });
  await page.clock.runFor(180);
  await expect(warning).toBeVisible();
  await expect(guard).toHaveCSS('opacity', '1');
  const alpha = await guard.evaluate((el: HTMLImageElement) => {
    const canvas = document.createElement('canvas');
    canvas.width = el.naturalWidth; canvas.height = el.naturalHeight;
    const context = canvas.getContext('2d')!;
    context.drawImage(el, 0, 0);
    return [context.getImageData(0, 0, 1, 1).data[3], context.getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data[3]];
  });
  expect(alpha[0]).toBe(0);
  expect(alpha[1]).toBeGreaterThan(240);
  await expect(warning).toHaveCSS('opacity', '1');
  const sceneBox = (await page.locator('.campus-run-stage').boundingBox())!;
  const guardBox = (await guard.boundingBox())!;
  const bubbleBox = (await warning.boundingBox())!;
  expect(guardBox.x).toBeGreaterThan(sceneBox.x + sceneBox.width * .05);
  expect(guardBox.x + guardBox.width).toBeLessThan(sceneBox.x + sceneBox.width * .34);
  expect(guardBox.y).toBeGreaterThan(sceneBox.y + sceneBox.height * .45);
  expect(guardBox.y + guardBox.height).toBeLessThan(sceneBox.y + sceneBox.height);
  expect(bubbleBox.y + bubbleBox.height).toBeLessThan(guardBox.y + 5);
  await page.keyboard.down('KeyW');
  await page.clock.runFor(600);
  await page.keyboard.up('KeyW');
  expect(await position(page)).toEqual(beforeWarning);
  await page.screenshot({ path: testInfo.outputPath('campus-run-warning.png') });
  await page.getByRole('button', { name: '知道了，继续跑步' }).click();
  await page.keyboard.down('ShiftLeft');
  await page.clock.runFor(1200);
  await expect(warning).not.toBeVisible();
  await page.keyboard.up('ShiftLeft');
  await page.clock.runFor(100);
  await expect(warning).not.toBeVisible();
  expect(await position(page)).toEqual(beforeWarning);
  await expect(game.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
  for (const [x, y] of [[840, 376], [890, 270], [840, 164], [720, 120], [500, 120], [280, 120], [160, 164], [110, 270], [160, 376], [280, 420]]) {
    await steerTo(page, x!, y!);
  }
  await expect(game.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '7');
  await expect(game).toHaveAttribute('data-status', 'running');
  await steerTo(page, 500, 420);
  await expect(game.getByRole('status')).toHaveText('校园跑成功！你已完成一圈。');
  await expect(game.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '8');
  await expect(page.getByTestId('character-status')).toHaveText(mapPosition!);
  await page.screenshot({ path: testInfo.outputPath('campus-run-success.png') });
  await page.getByRole('button', { name: '再跑一圈' }).click();
  await expect(game.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  await page.keyboard.down('ShiftRight');
  await page.clock.runFor(1120);
  await page.keyboard.up('ShiftRight');
  await expect(warning).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(warning).not.toBeVisible();
  await page.getByRole('button', { name: '返回校园', exact: true }).click();
  await expect(game).toHaveCount(0);
  await expect(page.getByTestId('character-status')).toHaveText(mapPosition!);
  await page.keyboard.down('KeyA');
  await page.clock.runFor(200);
  await page.keyboard.up('KeyA');
  await expect(page.getByTestId('character-status')).not.toHaveText(mapPosition!);
  expect(errors).toEqual([]);
});

test('不能抄近路；触屏控制、失焦暂停、切换页签与窄屏警告正常', async ({ page }, testInfo) => {
  await openRun(page);
  await page.getByRole('button', { name: '开始校园跑', exact: true }).click();
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.keyboard.down('KeyW');
  await page.clock.runFor(1500);
  await page.keyboard.up('KeyW');
  expect((await position(page)).y).toBeGreaterThan(390);
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  await page.getByRole('button', { name: '重新开始' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  const left = page.getByRole('button', { name: '向左跑', exact: true });
  await left.scrollIntoViewIfNeeded();
  const bounds = (await left.boundingBox())!;
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.clock.runFor(300);
  await page.mouse.up();
  expect((await position(page)).x).toBeLessThan(490);
  await page.keyboard.down('KeyA');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  const before = await position(page);
  await page.clock.runFor(300);
  expect(await position(page)).toEqual(before);
  await page.keyboard.up('KeyA');
  expect(await page.locator('.place-overlay').evaluate(el => el.scrollWidth > el.clientWidth)).toBe(false);
  await page.screenshot({ path: testInfo.outputPath('campus-run-mobile.png') });
  const ride = page.getByRole('button', { name: '按住骑电动车 · Shift' });
  await ride.scrollIntoViewIfNeeded();
  const rideBox = (await ride.boundingBox())!;
  await page.mouse.move(rideBox.x + rideBox.width / 2, rideBox.y + rideBox.height / 2);
  await page.mouse.down();
  await page.clock.runFor(1120);
  await page.mouse.up();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('campus-run-warning-mobile.png') });
  await page.getByRole('button', { name: '知道了，继续跑步' }).click();
  await page.getByRole('tab', { name: '社团目录' }).click();
  await page.keyboard.press('Shift');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('tab', { name: '校园跑', exact: true }).click();
  await expect(page.getByRole('button', { name: '开始校园跑', exact: true })).toBeEnabled();
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
});

test('社团接口失败仍可跑步；素材失败显示重试并阻止开跑', async ({ page }) => {
  let failedRequests = 0;
  await page.route('**/api/v1/public-content', route => { failedRequests++; return route.abort(); });
  await page.route('**/scenes/campus-run-guard-transparent-v2.png', route => route.abort());
  await enterCampusAt(page, 425, 934);
  await page.keyboard.press('KeyE');
  await page.getByRole('tab', { name: '校园跑', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('操场或角色图片加载失败');
  expect(failedRequests).toBeGreaterThan(0);
  await expect(page.getByRole('button', { name: '等待素材加载' })).toBeDisabled();
  await page.unroute('**/scenes/campus-run-guard-transparent-v2.png');
  await page.getByRole('button', { name: '重试加载' }).click();
  await expect(page.getByRole('button', { name: '开始校园跑', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '开始校园跑', exact: true }).click();
  await expect(page.getByLabel('校园跑小游戏', { exact: true })).toHaveAttribute('data-status', 'running');
});

test('短按与松手重新计时；失焦取消骑行；左右 Shift 重叠按住仍连续计时', async ({ page }) => {
  await openRun(page);
  await page.getByRole('button', { name: '开始校园跑', exact: true }).click();
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  const game = page.getByLabel('校园跑小游戏', { exact: true });
  const guard = page.getByAltText('抱臂提醒禁止骑电动车的角色');
  for (let i = 0; i < 2; i++) {
    await page.keyboard.down('ShiftLeft');
    await page.clock.runFor(700);
    await page.keyboard.up('ShiftLeft');
    await page.clock.runFor(100);
    await expect(guard).toHaveCount(0);
    await expect(page.getByTestId('campus-run-player')).toHaveAttribute('data-mode', 'walk');
  }
  await page.keyboard.down('ShiftRight');
  await page.clock.runFor(600);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.clock.runFor(600);
  await page.keyboard.up('ShiftRight');
  await expect(guard).toHaveCount(0);
  await page.keyboard.down('ShiftLeft');
  await page.clock.runFor(400);
  await page.keyboard.down('ShiftRight');
  await page.keyboard.up('ShiftLeft');
  await page.clock.runFor(300);
  await expect(guard).toHaveCount(0);
  await page.clock.runFor(65);
  await expect(game).toHaveAttribute('data-status', 'guard-entering');
  await page.keyboard.up('ShiftRight');
  await page.clock.runFor(360);
  await expect(page.getByRole('dialog', { name: '操场禁止骑电动车！！！' })).toBeVisible();
});
