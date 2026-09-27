import { expect, test } from '@playwright/test';
import { enterCampusAt } from './helpers/campus';

const places = [
  { id: 'xiaoxiang_library', name: '图书馆', x: 600, y: 1320 },
  { id: 'xiaoxiang_teaching_group', name: '教学楼群', x: 506, y: 1234 },
  { id: 'xiaoxiang_sports_ground', name: '体育场', x: 425, y: 934 },
  { id: 'lunan_canteen_2', name: '二食堂', x: 560, y: 748 },
  { id: 'lunan_shenghua_dormitory', name: '升华公寓', x: 342, y: 615 },
];

for (const place of places) {
  test(`${place.name}：独立相册页签、上传、预览、重新进入及窄屏`, async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await enterCampusAt(page, place.x, place.y);
    const position = await page.getByTestId('character-status').textContent();
    await page.keyboard.press('KeyE');
    const gallery = page.getByRole('region', { name: '地点相册', exact: true });
    const albumTab = page.locator('.place-overlay button').filter({ hasText: /^地点相册$/ });
    await expect(gallery).not.toBeVisible();
    await albumTab.click();
    await expect(gallery).toBeVisible();
    await expect(gallery.getByRole('button', { name: '上传图片', exact: true })).toBeEnabled();
    if (place.id === 'xiaoxiang_library') {
      await page.getByRole('tab', { name: '学习', exact: true }).click();
      await expect(gallery).not.toBeVisible();
      await page.screenshot({ path: testInfo.outputPath('library-learning.png') });
      await albumTab.click();
    }
    const otherPlaces = places.filter(other => other.id !== place.id);
    const otherPhotos = await Promise.all(otherPlaces.map(async other =>
      (await (await page.request.get(`/api/v1/places/${other.id}/photos`)).json()).photos));
    const before = (await (await page.request.get(`/api/v1/places/${place.id}/photos`)).json()).photos.length;
    const photo = await page.locator('.explorer-minimap').count() ? page.locator('.explorer-minimap') : page.locator('.map-canvas canvas');
    const buffer = await photo.screenshot();
    await gallery.locator('input[type=file]').setInputFiles({ name: `${place.id}.png`, mimeType: 'image/png', buffer });
    await expect(gallery.locator('.gallery-count')).toHaveText(`${before + 1} 张图片`);
    for (const [index, other] of otherPlaces.entries()) {
      expect((await (await page.request.get(`/api/v1/places/${other.id}/photos`)).json()).photos).toEqual(otherPhotos[index]);
    }
    await gallery.locator('.gallery-thumb').last().click();
    await expect(page.getByRole('dialog', { name: '图片大图预览' })).toBeVisible();
    await page.getByRole('button', { name: '关闭大图' }).click();
    await page.getByRole('button', { name: '返回校园', exact: true }).click();
    await expect(page.getByTestId('character-status')).toHaveText(position!);
    await page.keyboard.press('KeyE');
    await expect(gallery).not.toBeVisible();
    await albumTab.click();
    await expect(gallery.locator('.gallery-count')).toHaveText(`${before + 1} 张图片`);
    await page.reload();
    await page.getByRole('button', { name: '进入校园', exact: true }).click();
    await expect(page.getByTestId('interact-prompt')).toContainText(place.name);
    await page.keyboard.press('KeyE');
    await albumTab.click();
    await expect(gallery.locator('.gallery-count')).toHaveText(`${before + 1} 张图片`);
    await page.locator('.place-overlay').evaluate(el => { el.scrollTop = 0; });
    await page.screenshot({ path: testInfo.outputPath(`${place.id}-desktop.png`) });
    await page.setViewportSize({ width: 390, height: 844 });
    await gallery.scrollIntoViewIfNeeded();
    expect(await page.locator('.place-overlay').evaluate(el => el.scrollWidth > el.clientWidth)).toBe(false);
    await expect(gallery.getByRole('button', { name: '上传图片', exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`${place.id}-mobile.png`) });
    expect(errors).toEqual([]);
  });
}

test('社团内容读取失败仍能上传体育场照片', async ({ page }) => {
  await page.route('**/api/v1/public-content', route => route.fulfill({ status: 503, json: { error: { code: 'UNAVAILABLE', message: 'test' } } }));
  await enterCampusAt(page, 425, 934);
  await page.keyboard.press('KeyE');
  await page.getByRole('tab', { name: '地点相册', exact: true }).click();
  await expect(page.getByRole('region', { name: '地点相册' }).getByRole('button', { name: '上传图片' })).toBeEnabled();
});

for (const place of places.filter(place => ['canteen', 'dormitory'].some(kind => place.id.includes(kind)))) {
  test(`${place.name}上传期间保留面板与地图锁`, async ({ page }) => {
    let release!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    await page.route(`**/api/v1/places/${place.id}/photos`, async route => {
      if (route.request().method() === 'POST') await pending;
      await route.continue();
    });
    await enterCampusAt(page, place.x, place.y);
    const buffer = await page.locator('.map-canvas canvas').screenshot();
    const position = await page.getByTestId('character-status').textContent();
    await page.keyboard.press('KeyE');
    await page.locator('.place-overlay button').filter({ hasText: /^地点相册$/ }).click();
    const gallery = page.getByRole('region', { name: '地点相册', exact: true });
    try {
      await gallery.locator('input[type=file]').setInputFiles({ name: 'guard.png', mimeType: 'image/png', buffer });
      await expect(gallery.getByRole('button', { name: '上传中…' })).toBeDisabled();
      await page.getByRole('tab', { name: place.id.includes('canteen') ? '楼层与评价' : '楼栋群聊', exact: true }).click();
      await expect(gallery).not.toBeVisible();
      await page.getByRole('button', { name: '返回校园', exact: true }).click();
      await expect(page.getByRole('alert')).toContainText('页面暂不能关闭');
      await page.keyboard.press('KeyD');
      await expect(page.getByTestId('character-status')).toHaveText(position!);
    } finally { release(); }
    await page.getByRole('tab', { name: '地点相册', exact: true }).click();
    await expect(gallery.getByRole('button', { name: '上传成功' })).toBeEnabled();
    await page.getByRole('button', { name: '返回校园', exact: true }).click();
    await expect(page.locator('.place-overlay')).toHaveCount(0);
  });
}

test('食堂切换相册保留未发布的评价草稿', async ({ page }) => {
  await enterCampusAt(page, 560, 748);
  await page.keyboard.press('KeyE');
  await page.getByRole('button', { name: '查看家常小炒评价' }).click();
  await page.getByRole('button', { name: '写评价', exact: true }).click();
  const draft = page.getByRole('textbox', { name: '评价内容', exact: true });
  await draft.fill('看完照片再继续写这条评价');
  await page.getByRole('tab', { name: '地点相册', exact: true }).click();
  await expect(draft).not.toBeVisible();
  await page.getByRole('tab', { name: '楼层与评价', exact: true }).click();
  await expect(draft).toHaveValue('看完照片再继续写这条评价');
  await expect(page.getByRole('region', { name: '地点相册', exact: true })).not.toBeVisible();
});

test('公寓切换相册保留聊天输入', async ({ page }) => {
  await enterCampusAt(page, 342, 615);
  await page.keyboard.press('KeyE');
  await page.getByRole('button', { name: '加入 1 栋 群聊' }).click();
  const draft = page.getByLabel('发送消息');
  await draft.fill('稍后继续发送');
  await page.getByRole('tab', { name: '地点相册', exact: true }).click();
  await expect(draft).not.toBeVisible();
  await page.getByRole('tab', { name: '楼栋群聊', exact: true }).click();
  await expect(draft).toHaveValue('稍后继续发送');
  await expect(page.getByRole('region', { name: '地点相册', exact: true })).not.toBeVisible();
});
