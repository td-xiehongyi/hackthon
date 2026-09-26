import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { MapAnnotation, PlaceId } from '../../src/shared/contracts';

// 仅拦截浏览器响应的合成标注，绝不写入正式地图文件。
async function useFixture(page: Page, placeId: PlaceId) {
  const map: MapAnnotation = JSON.parse(readFileSync('docs/examples/map.pending.json', 'utf8'));
  const polygon = [{ x: 0, y: 0 }, { x: 1041, y: 0 }, { x: 1041, y: 1511 }, { x: 0, y: 1511 }];
  map.walkableAreas = [{ id: 'test-only-ground', polygon }];
  map.safePoints = [{ id: 'test-spawn', position: { x: 520, y: 756 }, usage: ['spawn'], verificationStatus: 'verified' }];
  map.safePoints.push({ id: '测试安全落点', position: { x: 600, y: 800 }, usage: ['teleport'], verificationStatus: 'verified' });
  map.interactions = map.interactions.map((item) => item.placeId === placeId ? {
    ...item, verificationStatus: 'verified', entrancePoint: { x: 520, y: 756 },
    triggerPolygon: [{ x: 490, y: 726 }, { x: 550, y: 726 }, { x: 550, y: 786 }, { x: 490, y: 786 }],
  } : item);
  await page.route('**/maps/campus-v20.annotations.json', (route) => route.fulfill({ json: map }));
}

for (const [placeId, name] of [
  ['xiaoxiang_library', '潇湘校区图书馆'],
  ['xiaoxiang_teaching_group', '潇湘校区教学楼群'],
  ['xiaoxiang_sports_ground', '潇湘校区体育场（副场）'],
] as const) {
  test(`正式场景接线（合成入口）：${name} E键进入、暂停、返回原位`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await useFixture(page, placeId);
    await page.goto('/');
    await expect(page.getByTestId('interact-prompt')).toContainText(name);
    const before = await page.getByTestId('character-status').innerText();
    await page.keyboard.press('KeyE');
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
    await page.keyboard.down('KeyD');
    await page.waitForTimeout(200);
    await page.keyboard.up('KeyD');
    await page.getByRole('button', { name: '返回校园', exact: true }).click();
    await expect(page.getByTestId('character-status')).toBeVisible();
    await expect(page.getByTestId('character-status')).toHaveText(before);
    expect(errors).toEqual([]);
  });
}

test('页面中定位只打开地图总览，关闭总览后回到页面且角色保持原位', async ({ page }) => {
  await useFixture(page, 'xiaoxiang_teaching_group');
  await page.goto('/');
  await expect(page.getByTestId('interact-prompt')).toBeVisible();
  const before = await page.getByTestId('character-status').innerText();
  await page.keyboard.press('KeyE');
  await page.getByRole('button', { name: '定位本地点' }).click();
  await expect(page.getByRole('dialog', { name: '地图定位总览' })).toBeVisible();
  await expect(page.getByTestId('navigation-marker')).toHaveAttribute('cx', '520');
  await page.keyboard.press('KeyD');
  await page.getByRole('button', { name: '返回地点页面' }).click();
  await expect(page.getByRole('heading', { name: '潇湘校区教学楼群', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '返回校园', exact: true }).click();
  await expect(page.getByTestId('character-status')).toHaveText(before);
});

test('缺少或损坏标注时禁止移动，保留浏览并说明原因', async ({ page }) => {
  await page.route('**/maps/campus-v20.annotations.json', (route) => route.fulfill({ json: { schemaVersion: 1 } }));
  await page.goto('/');
  await expect(page.getByRole('status', { name: '地图加载状态' })).toHaveText('地图已加载');
  await expect(page.getByRole('button', { name: '角色', exact: true })).toBeDisabled();
  await expect(page.getByText(/移动已停用/)).toBeVisible();
  await page.keyboard.press('KeyE');
  await expect(page.getByRole('button', { name: '返回校园', exact: true })).toHaveCount(0);
});

test('地图总览搜索显示缺失状态，只能快速移动到已核验安全点', async ({ page }) => {
  await useFixture(page, 'xiaoxiang_library');
  await page.goto('/');
  await expect(page.getByTestId('interact-prompt')).toBeVisible();
  await page.getByRole('button', { name: '地图总览与搜索' }).click();
  await page.getByLabel('搜索地点或地标').fill('教学');
  await page.getByRole('button', { name: '潇湘校区教学楼群', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('status')).toContainText('尚未完成地图标定');
  await page.getByRole('button', { name: '前往 测试安全落点' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByTestId('character-status')).toContainText('位置 600, 800');
  await page.keyboard.press('KeyE');
  await expect(page.getByRole('button', { name: '返回校园', exact: true })).toHaveCount(0);
});

test('真实服务：图书馆上传跨页面刷新和新浏览器上下文可见，副场相册隔离', async ({ page, browser }) => {
  await page.goto('/?scene=dev-playground');
  await expect(page.getByText('测试场景已就绪')).toBeVisible();
  await page.getByRole('button', { name: '图书馆范围', exact: true }).click();
  await page.keyboard.press('KeyE');
  await expect(page.getByText('还没有图片，上传第一张吧。')).toBeVisible();
  await page.locator('input[type=file]').setInputFiles('public/characters/temp-prototype/character-sheet.png');
  await expect(page.getByRole('button', { name: '上传成功' })).toBeVisible();
  await expect(page.locator('.gallery-thumb')).toHaveCount(1);
  await page.reload();
  await expect(page.getByText('测试场景已就绪')).toBeVisible();
  await page.getByRole('button', { name: '图书馆范围', exact: true }).click();
  await page.keyboard.press('KeyE');
  await expect(page.locator('.gallery-thumb')).toHaveCount(1);
  const context = await browser.newContext();
  try {
    const other = await context.newPage();
    await other.goto('http://127.0.0.1:5175/?scene=dev-playground');
    await expect(other.getByText('测试场景已就绪')).toBeVisible();
    await other.getByRole('button', { name: '图书馆范围', exact: true }).click();
    await other.keyboard.press('KeyE');
    await expect(other.locator('.gallery-thumb')).toHaveCount(1);
  } finally { await context.close(); }
  await page.getByRole('button', { name: '返回校园', exact: true }).click();
  await page.getByRole('button', { name: '副场范围', exact: true }).click();
  await page.keyboard.press('KeyE');
  await page.getByRole('tab', { name: '地点相册' }).click();
  await expect(page.getByText('还没有图片，上传第一张吧。')).toBeVisible();
  await expect(page.locator('.gallery-thumb')).toHaveCount(0);
});

test('体育场编辑器使用真实API保存，重回查询立即可见；冲突保留草稿', async ({ page }) => {
  await useFixture(page, 'xiaoxiang_sports_ground');
  await page.goto('/');
  await expect(page.getByTestId('interact-prompt')).toBeVisible();
  await page.keyboard.press('KeyE');
  await page.getByRole('button', { name: '维护社团与活动' }).click();
  await page.getByRole('button', { name: '+ 新增社团', exact: true }).click();
  await page.getByLabel('名称', { exact: true }).fill('A联调测试社团');
  await page.getByRole('button', { name: '保存社团', exact: true }).click();
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByText('保存成功', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'A联调测试社团', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '维护社团与活动' }).click();
  await page.getByRole('button', { name: '+ 新增社团', exact: true }).click();
  await page.getByLabel('名称', { exact: true }).fill('冲突草稿社团');
  await page.getByRole('button', { name: '保存社团', exact: true }).click();
  const snapshot = await (await page.request.get('/api/v1/public-content')).json();
  const external = await page.request.put('/api/v1/public-content', {
    headers: { Origin: 'http://127.0.0.1:5175' },
    data: { expectedRevision: snapshot.revision, content: { clubs: snapshot.clubs, activities: snapshot.activities } },
  });
  expect(external.ok()).toBe(true);
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByText(/版本冲突：内容已被其他会话更新/)).toBeVisible();
  await expect(page.getByText('冲突草稿社团', { exact: true })).toBeVisible();
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await expect(page.getByRole('heading', { name: '社团与活动编辑器' })).toBeVisible();
});
