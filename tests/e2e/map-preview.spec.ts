import { expect, test } from '@playwright/test';

test('地图可加载、缩放、拖动并恢复全图', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '中南大学像素校园' })).toBeVisible();
  await expect(page.getByRole('status', { name: '地图加载状态' })).toHaveText('地图已加载');
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();
  // 默认进入角色模式；切到浏览模式后检查拖动与缩放。
  await page.getByRole('button', { name: '浏览', exact: true }).click();
  await expect(page.getByRole('button', { name: '浏览', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const zoom = page.getByLabel('当前缩放');
  const fittedZoom = await zoom.innerText();
  const before = await canvas.screenshot();
  await page.getByRole('button', { name: '放大地图', exact: true }).click();
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
  await page.getByRole('button', { name: '适应窗口' }).click();
  await expect(zoom).toHaveText(fittedZoom);
  await expect.poll(async () => (await canvas.screenshot()).equals(before)).toBe(true);
  await expect(page.getByText('草地、操场、桥面及建筑和道路附近的树木可通行，窄路可骑行；地点入口仍待标定。')).toBeVisible();
  await expect(page.getByTestId('character-status')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('图片读取失败时明确提示，不能显示加载成功', async ({ page }) => {
  await page.route('**/maps/campus-v20.png', (route) => route.abort());
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('地图加载失败');
  await expect(page.getByRole('button', { name: '放大地图', exact: true })).toBeDisabled();
  await expect(page.getByRole('status', { name: '地图加载状态' })).not.toHaveText('地图已加载');
});

test('角色模式：打开即放出角色，按通行标注跑动与骑行，被障碍挡住，镜头跟随', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
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

  // 打开页面即放出角色，无需点击；通行范围来自颜色提取与人工修正规则。
  await expect(page.getByRole('button', { name: '角色', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('note')).toContainText('通行规则已应用，边界待核验');
  await expect(status).toContainText('位置');
  await expect(page.getByLabel('当前缩放')).toHaveText('300%');
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

  // 通行区域叠加层可以开关。
  const overlay = page.getByRole('button', { name: '通行区域' });
  const plain = await canvas.screenshot();
  await overlay.click();
  await expect(overlay).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => (await canvas.screenshot()).equals(plain)).toBe(false);
  await overlay.click();

  // 回到浏览模式再回来，角色保留在原位置。
  const last = await pos();
  await page.getByRole('button', { name: '浏览', exact: true }).click();
  await expect(page.getByTestId('character-status')).toHaveCount(0);
  await page.getByRole('button', { name: '角色', exact: true }).click();
  expect(await pos()).toMatchObject({ x: last.x, y: last.y });
  expect(errors).toEqual([]);
});

test('通行标注不可用时停止移动并明确提示', async ({ page }) => {
  await page.route('**/maps/campus-v20.annotations.json', (route) => route.abort());
  await page.goto('/');
  await expect(page.getByRole('status', { name: '地图加载状态' })).toHaveText('地图已加载');
  await expect(page.getByRole('note')).toContainText('移动已停用');
  await expect(page.getByRole('note')).toContainText('通行标注文件未能加载');
  await expect(page.getByRole('button', { name: '通行区域' })).toBeDisabled();
  await expect(page.getByRole('button', { name: '角色', exact: true })).toBeDisabled();
});

test('角色模式下在输入框外失焦时停止移动', async ({ page }) => {
  await page.goto('/');
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
