import { expect, test, type Page } from '@playwright/test';

const openTeaching = async (page: Page) => {
  await page.goto('/');
  await expect(page.getByRole('status', { name: '地图加载状态' })).toHaveText('地图已加载');
  await page.getByRole('button', { name: '进入教学楼群', exact: true }).click();
  await expect(page.getByRole('heading', { name: '课表与蹭课中心' })).toBeVisible();
};

test('课程录入后生成周表并在刷新后保留', async ({ page }) => {
  await openTeaching(page);
  await expect(page.getByText('这学期的课表还是空的')).toBeVisible();

  await page.getByRole('button', { name: '添加课程', exact: true }).first().click();
  await page.getByLabel('课程名称 *').fill('高等数学');
  await page.getByLabel('任课教师').fill('林老师');
  await page.getByLabel('星期 *').selectOption('2');
  await page.getByLabel('开始节次 *').selectOption('3');
  await page.getByLabel('结束节次 *').selectOption('4');
  await page.getByLabel('周次 *').fill('1-16');
  await page.getByLabel('教学楼 / 楼座原文').fill('新校区教学楼');
  await page.getByLabel('教室 / 详细地点').fill('A201');
  await page.getByRole('button', { name: '添加课程', exact: true }).last().click();
  await expect(page.getByText('高等数学').first()).toBeVisible();

  await page.reload();
  await openTeaching(page);
  await expect(page.getByText('高等数学').first()).toBeVisible();
});

test('WakeUp CSV 先预览再导入', async ({ page }) => {
  await openTeaching(page);
  await page.getByRole('button', { name: '课表管理' }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: 'wakeup.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('课程名称,星期,开始节数,结束节数,老师,地点,周数\n大学物理,3,1,2,王老师,科教楼301,1-8单'),
  });
  await expect(page.getByRole('heading', { name: 'wakeup.csv' })).toBeVisible();
  await page.getByRole('button', { name: '确认导入' }).click();
  await expect(page.getByText('大学物理')).toBeVisible();
});

test('蹭课只展示本人空闲时段的社区课程', async ({ page, request }) => {
  await openTeaching(page);
  await page.getByRole('button', { name: '添加课程', exact: true }).first().click();
  await page.getByLabel('课程名称 *').fill('高等数学');
  await page.getByLabel('星期 *').selectOption('2');
  await page.getByLabel('开始节次 *').selectOption('3');
  await page.getByLabel('结束节次 *').selectOption('4');
  await page.getByRole('button', { name: '添加课程', exact: true }).last().click();

  const response = await request.put('/api/community-schedules/e2e-user-0002', {
    data: {
      termId: 'current-term',
      courses: [{
        id: 'art-course', name: '视觉文化导论', teacher: '周老师', weekday: 4,
        startPeriod: 5, endPeriod: 6, weeks: Array.from({ length: 16 }, (_, index) => index + 1),
        weekParity: 'all', location: 'B203', buildingId: null, buildingName: '新校区教学楼', tags: ['艺术'],
      }],
    },
  });
  expect(response.ok()).toBe(true);

  await page.reload();
  await openTeaching(page);
  await page.getByRole('button', { name: '蹭课发现' }).click();
  await expect(page.getByText('视觉文化导论')).toBeVisible();
  await expect(page.getByText('你此时没课').first()).toBeVisible();
});

test('教学楼页支持小屏、横屏与减少动效', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#teaching');
  await expect(page.getByRole('heading', { name: '课表与蹭课中心' })).toBeVisible();
  await expect(page.getByRole('button', { name: '课表管理' })).toBeVisible();
  await expect(page.getByLabel('当前教学周')).toBeVisible();

  await page.setViewportSize({ width: 812, height: 375 });
  await expect(page.getByRole('button', { name: '添加课程', exact: true }).first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('从教学楼页使用浏览器后退可返回原地图', async ({ page }) => {
  await openTeaching(page);
  await expect(page).toHaveURL(/#teaching$/);
  await page.goBack();
  await expect(page.getByRole('heading', { name: '中南大学像素校园' })).toBeVisible();
});
