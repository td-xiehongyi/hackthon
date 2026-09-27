import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { zipSync, strToU8 } from 'fflate';

const png = new Uint8Array(readFileSync('public/maps/campus-v20.png'));
const scene = {
  schemaVersion: 1, name: 'ZIP 验收校园', map: 'map.png', style: 'pixel-art',
  points: [
    { id: 'stadium', name: '包内操场', position: { x: .5, y: .5 }, feature: 'clubs', clubs: [{ name: '摄影社', description: '每周拍照' }], photos: [{ path: 'assets/photo.png', caption: '操场照片' }] },
    { id: 'canteen', name: '包内食堂', position: { x: .7, y: .5 }, feature: 'reviews', reviews: [{ author: '小林', rating: 5, text: '米饭很好吃' }] },
    { id: 'classroom', name: '包内教室', position: { x: .3, y: .5 }, feature: 'timetable', courses: [{ name: '高等数学', time: '周一 08:00', teacher: '张老师' }] },
  ],
};
const zip = Buffer.from(zipSync({ 'scene.json': strToU8(JSON.stringify(scene)), 'map.png': png, 'assets/photo.png': png }));

test('homepage imports a Skill-compatible ZIP and retains scene interactions', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '导入场景 ZIP', exact: true }).click({ timeout: 5000 });
  await page.getByLabel('选择场景 ZIP').setInputFiles({ name: 'campus.scene.zip', mimeType: 'application/zip', buffer: zip });
  await expect(page.getByRole('heading', { name: 'ZIP 验收校园' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'ZIP 验收校园地图' })).toBeVisible();
  await page.getByRole('region', { name: '场景地图' }).focus();
  await page.keyboard.press('e');
  await expect(page.getByRole('heading', { name: '包内操场' })).toBeVisible();
  await expect(page.getByText('每周拍照', { exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: '操场照片' })).toBeVisible();
  await page.getByLabel('社团名称').fill('读书社');
  await page.getByLabel('社团介绍').fill('一起读书');
  await page.getByRole('button', { name: '添加社团', exact: true }).click();
  await expect(page.getByText('一起读书', { exact: true })).toBeVisible();
  await page.evaluate(() => {
    const decode = window.createImageBitmap.bind(window);
    window.createImageBitmap = (source: ImageBitmapSource) => new Promise<ImageBitmap>((resolve, reject) => {
      setTimeout(() => { decode(source).then(resolve, reject); }, 800);
    });
  });
  await page.getByLabel('上传地点照片').setInputFiles({ name: 'new.png', mimeType: 'image/png', buffer: Buffer.from(png) });
  await expect(page.getByRole('button', { name: '添加社团', exact: true })).toBeDisabled();
  await expect(page.getByLabel('选择场景 ZIP')).toBeDisabled();
  await expect(page.getByText('已保存到当前浏览器', { exact: true })).toBeVisible();
  await expect(page.locator('.scene-photos img')).toHaveCount(2);
  await page.getByRole('button', { name: '地点：包内食堂', exact: true }).click();
  await expect(page.getByText('米饭很好吃', { exact: true })).toBeVisible();
  await page.getByLabel('点评昵称').fill('小周');
  await page.getByLabel('点评内容').fill('面条也好吃');
  await page.getByRole('button', { name: '提交点评' }).click();
  await expect(page.getByText('面条也好吃', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '地点：包内教室', exact: true }).click();
  await page.getByLabel('搜索课表').fill('张老师');
  await expect(page.getByText('高等数学', { exact: true })).toBeVisible();
  await page.getByLabel('搜索课表').fill('不存在的课');
  await expect(page.getByText('没有匹配的课程。')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'ZIP 验收校园' })).toBeVisible();
  await page.getByRole('button', { name: '地点：包内操场', exact: true }).click();
  await expect(page.getByText('一起读书', { exact: true })).toBeVisible();
  await expect(page.locator('.scene-photos img')).toHaveCount(2);
  await page.getByLabel('选择场景 ZIP').setInputFiles({ name: 'broken.zip', mimeType: 'application/zip', buffer: Buffer.from('broken') });
  await expect(page.getByRole('alert')).toContainText('无法读取 ZIP');
  await expect(page.getByRole('heading', { name: 'ZIP 验收校园' })).toBeVisible();
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出场景 ZIP' }).click();
  const download = await downloadEvent;
  await page.getByLabel('选择场景 ZIP').setInputFiles((await download.path())!);
  await expect(page.getByRole('status')).toContainText('导入完成');
  await page.getByRole('button', { name: '地点：包内操场', exact: true }).click();
  await expect(page.getByText('一起读书', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '返回校园首页' }).click();
  await expect(page.getByRole('button', { name: '进入校园', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '进入校园', exact: true }).click();
  await expect(page.getByRole('status', { name: '地图加载状态' })).toHaveText('地图已加载');
});

test('empty-point scene works on mobile and movement stays in bounds', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#scenes');
  await page.getByLabel('选择场景 ZIP').setInputFiles({ name: 'image.zip', mimeType: 'application/zip', buffer: Buffer.from(zipSync({ 'map.png': png })) });
  await expect(page.getByText('这个包还没有交互点。')).toBeVisible();
  const map = page.getByRole('region', { name: '场景地图' });
  await map.focus();
  await page.keyboard.down('d');
  await page.waitForTimeout(350);
  await page.keyboard.up('d');
  const x = Number(await page.getByLabel('场景角色').getAttribute('data-x'));
  expect(x).toBeGreaterThan(.5);
  expect(x).toBeLessThanOrEqual(1);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('another tab cannot silently overwrite newer scene content', async ({ page, context }) => {
  await page.goto('/#scenes');
  await page.getByLabel('选择场景 ZIP').setInputFiles({ name: 'campus.zip', mimeType: 'application/zip', buffer: zip });
  await expect(page.getByRole('heading', { name: 'ZIP 验收校园' })).toBeVisible();
  const other = await context.newPage();
  await other.goto('/#scenes');
  await other.getByRole('button', { name: '地点：包内操场', exact: true }).click();
  await page.getByRole('button', { name: '地点：包内操场', exact: true }).click();
  await page.getByLabel('社团名称').fill('先保存的社团');
  await page.getByRole('button', { name: '添加社团', exact: true }).click();
  await expect(page.getByText('已保存到当前浏览器', { exact: true })).toBeVisible();
  await other.getByLabel('社团名称').fill('过期页面的社团');
  await other.getByRole('button', { name: '添加社团', exact: true }).click();
  await expect(other.getByRole('alert')).toContainText('另一个页面');
  await other.reload();
  await other.getByRole('button', { name: '地点：包内操场', exact: true }).click();
  await expect(other.getByRole('heading', { name: '先保存的社团' })).toBeVisible();
  await expect(other.getByRole('heading', { name: '过期页面的社团' })).toHaveCount(0);
});
