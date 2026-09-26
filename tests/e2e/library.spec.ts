import { expect, test, type Page } from '@playwright/test';

/**
 * 图书馆最短完整链路（docs/01 P1）：
 * 进入（测试场景中的临时）互动范围 → 按 E → 图书馆页面 → 真实上传图片（落盘到测试数据目录）
 * → 刷新后仍在 → 另一个浏览器上下文看到同一相册 → 其他地点相册看不到 → 返回原位置。
 *
 * 数据服务由 playwright.config.ts 用独立测试目录与开发测试图片政策启动。
 */

/** 最小但真实可识别的 PNG；追加一个字节使每次上传的内容不同。 */
function png(tag: number) {
  return Buffer.concat([
    Buffer.from(
      '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360f8cf00000301010018dd8db40000000049454e44ae426082',
      'hex',
    ),
    Buffer.from([tag]),
  ]);
}

async function enterLibrary(page: Page) {
  await page.goto('/?scene=dev-playground');
  await expect(page.getByRole('status', { name: '测试场景状态' })).toHaveText('测试场景已就绪');
  await page.getByRole('button', { name: '图书馆范围', exact: true }).click();
  await expect(page.getByTestId('interact-prompt')).toHaveText('按 E 进入【潇湘校区图书馆】');
  const position = await page.getByTestId('hud-position').innerText();
  await page.keyboard.press('KeyE');
  await expect(page.getByRole('heading', { level: 2, name: '潇湘校区图书馆' })).toBeVisible();
  return position;
}

async function photoCount(page: Page) {
  const grid = page.getByRole('list', { name: '图片列表' });
  return (await grid.count()) === 0 ? 0 : grid.getByRole('listitem').count();
}

test('图书馆：按 E 进入、上传真实图片、刷新与另一浏览器可见、返回原位', async ({ page, browser }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const position = await enterLibrary(page);

  // 介绍缺失时显示缺失状态，不编造内容。
  await expect(page.getByText('介绍内容尚未核验，暂不显示。')).toBeVisible();
  await expect(page.getByText('暂无已核验来源。')).toBeVisible();
  await expect(page.getByText('支持 JPEG、PNG、WEBP，单张不超过 10 MB。')).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: '正在读取相册' })).toHaveCount(0);
  const before = await photoCount(page);

  await page.getByLabel('选择要上传的图片').setInputFiles({ name: 'library.png', mimeType: 'image/png', buffer: png(before) });
  await expect(page.getByText('library.png 已保存到本地点相册。')).toBeVisible();
  await expect(page.getByRole('list', { name: '图片列表' }).getByRole('listitem')).toHaveCount(before + 1);

  // 图片确实可以从服务读回，并能放大查看后返回。
  const thumb = page.getByRole('button', { name: `查看第 ${before + 1} 张图片` });
  await expect(thumb.locator('img')).toHaveJSProperty('naturalWidth', 1);
  await thumb.click();
  await expect(page.getByRole('dialog', { name: '查看大图' })).toBeVisible();
  await page.getByRole('button', { name: '返回相册' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // 地图输入在功能页期间保持暂停。
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(200);
  await page.keyboard.up('KeyD');

  await page.getByRole('button', { name: '返回校园' }).click();
  await expect(page.getByTestId('hud-position')).toHaveText(position);

  // 刷新后重新进入，相册仍在。
  await enterLibrary(page);
  await expect(page.getByRole('list', { name: '图片列表' }).getByRole('listitem')).toHaveCount(before + 1);

  // 另一个浏览器上下文（独立存储）看到同一相册。
  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await enterLibrary(otherPage);
  await expect(otherPage.getByRole('list', { name: '图片列表' }).getByRole('listitem')).toHaveCount(before + 1);
  await other.close();

  // 体育场副场的相册看不到图书馆的图片（副场功能页尚未交付，直接查询接口）。
  const stadium = await page.request.get('/api/v1/places/xiaoxiang_sports_ground/photos');
  expect((await stadium.json()).photos).toEqual([]);
  expect(errors).toEqual([]);
});

test('上传不支持的格式时明确失败，相册不变', async ({ page }) => {
  await enterLibrary(page);
  await expect(page.getByRole('status').filter({ hasText: '正在读取相册' })).toHaveCount(0);
  const before = await photoCount(page);
  const gif = Buffer.from('474946383961010001000000002c00000000010001000002024401003b', 'hex');
  await page.getByLabel('选择要上传的图片').setInputFiles({ name: 'x.gif', mimeType: 'image/png', buffer: gif });
  await expect(page.getByRole('alert')).toContainText('上传失败：不支持该图片格式');
  await expect(page.getByText('已保存到本地点相册')).toHaveCount(0);
  expect(await photoCount(page)).toBe(before);
});

test('服务不可达时显示“结果未确认”，恢复后用同一请求重试成功', async ({ page }) => {
  await enterLibrary(page);
  await expect(page.getByRole('status').filter({ hasText: '正在读取相册' })).toHaveCount(0);
  const before = await photoCount(page);

  let key = '';
  await page.route('**/api/v1/places/xiaoxiang_library/photos', async (route) => {
    if (route.request().method() === 'POST') {
      key = route.request().headers()['idempotency-key'] ?? '';
      return route.abort('connectionreset');
    }
    return route.continue();
  });
  await page.getByLabel('选择要上传的图片').setInputFiles({ name: 'lost.png', mimeType: 'image/png', buffer: png(200) });
  await expect(page.getByRole('alert')).toContainText('保存结果未确认');
  await expect(page.getByText('已保存到本地点相册')).toHaveCount(0);
  expect(key).toMatch(/^[0-9a-f-]{36}$/);

  await page.unroute('**/api/v1/places/xiaoxiang_library/photos');
  let retryKey = '';
  page.on('request', (r) => {
    if (r.method() === 'POST' && r.url().includes('/photos')) retryKey = r.headers()['idempotency-key'] ?? '';
  });
  await page.getByRole('button', { name: '用同一请求重试' }).click();
  await expect(page.getByText('lost.png 已保存到本地点相册。')).toBeVisible();
  expect(retryKey).toBe(key);
  await expect(page.getByRole('list', { name: '图片列表' }).getByRole('listitem')).toHaveCount(before + 1);
});
