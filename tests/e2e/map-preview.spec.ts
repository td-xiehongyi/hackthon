import { expect, test } from '@playwright/test';

test('地图可加载、缩放、拖动并恢复全图', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '中南大学像素校园' })).toBeVisible();
  await page.getByRole('button', { name: '进入校园' }).click();
  await expect(page.getByRole('status', { name: '地图加载状态' })).toHaveText('地图已加载');
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();
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
  await expect(page.getByText('角色移动与地点交互待接入')).toBeVisible();
  expect(errors).toEqual([]);
});

test('图片读取失败时明确提示，不能显示加载成功', async ({ page }) => {
  await page.route('**/maps/campus-final-v9.png', (route) => route.abort());
  await page.goto('/');
  await page.getByRole('button', { name: '进入校园' }).click();
  await expect(page.getByRole('alert')).toContainText('地图加载失败');
  await expect(page.getByRole('button', { name: '放大地图', exact: true })).toBeDisabled();
  await expect(page.getByRole('status', { name: '地图加载状态' })).not.toHaveText('地图已加载');
});

test('启动界面显示像素标题、操作提示与三校区，并可进入地图后返回', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '中南大学像素校园' })).toBeVisible();
  await expect(page.getByRole('button', { name: '进入校园' })).toBeVisible();
  await expect(page.getByLabel('操作方式')).toContainText('Shift');
  await expect(page.getByLabel('校区一览')).toContainText('潇湘校区');
  await expect(page.getByText('当前版本仅支持地图浏览')).toBeVisible();
  const fontReady = await page.evaluate(() => document.fonts.check('16px "Fusion Pixel 12px"'));
  expect(fontReady).toBe(true);
  await page.getByRole('button', { name: '进入校园' }).click();
  await expect(page.getByRole('status', { name: '地图加载状态' })).toHaveText('地图已加载');
  await page.getByRole('button', { name: '返回首页' }).click();
  await expect(page.getByRole('button', { name: '进入校园' })).toBeVisible();
});

test('启动界面每个入口都能进入对应页面并返回', async ({ page }) => {
  await page.goto('/');

  // 完整地图页
  await page.getByRole('button', { name: '查看完整地图' }).click();
  await expect(page).toHaveURL(/#\/map\/full$/);
  await expect(page.getByRole('heading', { name: '完整地图' })).toBeVisible();
  await expect(page.getByRole('img', { name: /完整地图/ })).toBeVisible();
  await page.getByRole('button', { name: '交互浏览' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await expect(page.getByRole('status', { name: '地图加载状态' })).toHaveText('地图已加载');

  // 地图页左侧校区索引 → 校区页 → 相邻校区
  await page.getByRole('button', { name: /麓南校区/ }).click();
  await expect(page).toHaveURL(/#\/campus\/lunan$/);
  await expect(page.getByRole('heading', { name: '麓南校区', level: 1 })).toBeVisible();
  await expect(page.getByText('首版只在潇湘校区提供功能地点')).toBeVisible();
  await page.getByRole('button', { name: /^潇湘校区$/ }).click();
  await expect(page).toHaveURL(/#\/campus\/xiaoxiang$/);

  // 校区页地点卡片 → 地点页占位 → 其他地点
  await page.getByRole('button', { name: /潇湘图书馆/ }).first().click();
  await expect(page).toHaveURL(/#\/place\/xiaoxiang_library$/);
  await expect(page.getByRole('heading', { name: '潇湘图书馆', level: 1 })).toBeVisible();
  await expect(page.getByText(/尚未接入/)).toBeVisible();
  await page.getByRole('button', { name: /体育场（副场）/ }).click();
  await expect(page).toHaveURL(/#\/place\/xiaoxiang_sports_ground$/);

  // Esc 请求关闭 → 回到上一页；浏览器后退也可用
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/#\/place\/xiaoxiang_library$/);
  await page.goBack();
  await expect(page).toHaveURL(/#\/campus\/xiaoxiang$/);

  // 首页校区卡片与地点标签
  await page.getByRole('button', { name: '回到首页' }).click();
  await expect(page.getByRole('button', { name: '进入校园' })).toBeVisible();
  await page.getByRole('button', { name: /岳麓山校区/ }).click();
  await expect(page).toHaveURL(/#\/campus\/yuelushan$/);
  await page.getByRole('button', { name: '回到首页' }).click();
  await page.getByLabel('潇湘校区可互动地点').getByRole('button', { name: /教学楼群/ }).click();
  await expect(page).toHaveURL(/#\/place\/xiaoxiang_teaching_group$/);

  // 取景框整体可点
  await page.getByRole('button', { name: '回到首页' }).click();
  await page.getByRole('button', { name: '打开地图浏览' }).click();
  await expect(page.getByRole('status', { name: '地图加载状态' })).toHaveText('地图已加载');

  // 直接打开深链接可用
  await page.goto('/#/place/xiaoxiang_sports_ground');
  await expect(page.getByRole('heading', { name: '体育场（副场）', level: 1 })).toBeVisible();
  await page.goto('/#/nonsense');
  await expect(page.getByRole('button', { name: '进入校园' })).toBeVisible();
});
