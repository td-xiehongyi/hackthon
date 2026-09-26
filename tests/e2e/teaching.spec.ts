import { expect, test, type Page } from '@playwright/test';

const openTeaching = async (page: Page) => {
  await page.goto('/#teaching');
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

test('教学楼深链接可以返回校园探索页', async ({ page }) => {
  await openTeaching(page);
  await expect(page).toHaveURL(/#teaching$/);
  await page.getByRole('button', { name: '返回校园', exact: true }).click();
  await expect(page.getByRole('heading', { name: '附近地图' })).toBeVisible();
});

test('教务系统辅助导入与兴趣关键词可用', async ({ page }) => {
  await openTeaching(page);
  await page.getByRole('button', { name: '课表管理' }).click();
  await page.getByRole('button', { name: '从 CSU 教务系统导入' }).click();
  await expect(page.getByRole('heading', { name: '从 CSU 教务系统带入课表' })).toBeVisible();
  await expect(page.getByText('不会读取或保存账号、密码')).toBeVisible();
  await page.getByRole('button', { name: '关闭' }).click();
  await page.getByRole('button', { name: '蹭课发现' }).click();
  await page.getByLabel('添加兴趣关键词').fill('人工智能');
  await page.getByRole('button', { name: '添加', exact: true }).click();
  await expect(page.getByRole('button', { name: '人工智能', exact: true })).toBeVisible();
});

test('从教务辅助弹窗选择下载的 HTML 课表并进入统一预览', async ({ page }) => {
  await openTeaching(page);
  await page.getByRole('button', { name: '课表管理' }).click();
  await page.getByRole('button', { name: '从 CSU 教务系统导入' }).click();
  await expect(page.getByRole('heading', { name: '从 CSU 教务系统带入课表' })).toBeVisible();

  await page.getByRole('button', { name: '选择 CSV / TSV / HTML / JSON 文件' }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: 'csu-schedule.html',
    mimeType: 'text/html',
    buffer: Buffer.from(`
      <table>
        <tr><th>课程名称</th><th>上课星期</th><th>上课时间</th><th>教师</th><th>地点</th><th>周次</th></tr>
        <tr><td>程序设计实践</td><td>周四</td><td>第7-8节</td><td>陈老师</td><td>教学楼 A203</td><td>1-16周</td></tr>
      </table>
    `),
  });

  // The helper closes before the shared preview opens, so two modal backdrops
  // cannot trap focus at the same time.
  await expect(page.getByRole('heading', { name: '从 CSU 教务系统带入课表' })).toBeHidden();
  await expect(page.getByRole('heading', { name: 'csu-schedule.html' })).toBeVisible();
  await expect(page.getByText('确认后将写入 1 条课程。')).toBeVisible();
  await page.getByRole('button', { name: '确认导入' }).click();
  await expect(page.getByText('程序设计实践')).toBeVisible();
});
