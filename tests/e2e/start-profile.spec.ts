import { expect, test } from '@playwright/test';

test('首页精简信息，填写资料后同步左栏并在刷新后保留', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page.getByRole('region', { name: '三个校区', exact: true })).toHaveCount(0);
  await expect(page.getByText('v0.1 · 本机运行', { exact: true })).toHaveCount(0);
  await expect(page.getByText('校园漫游，从这里开始。')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '操作说明', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '打开校园全图', exact: true })).toHaveCount(0);
  await expect(page.getByText('CSU PIXEL CAMPUS', { exact: true })).toHaveCount(0);
  await expect(page.locator('.start-description')).toHaveCount(0);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '校园登录', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('姓名', { exact: true }).fill('  测试同学  ');
  await dialog.getByLabel('学院', { exact: true }).fill('测试学院');
  await dialog.getByLabel('学号（选填）', { exact: true }).fill('TEST001');
  await dialog.getByRole('button', { name: '保存并登录', exact: true }).click();
  await expect(dialog).toBeHidden();
  await page.reload();
  await expect(page.getByRole('button', { name: '编辑个人信息', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '进入校园', exact: true }).click();
  const info = page.getByRole('region', { name: '个人信息', exact: true });
  await expect(info).toContainText('测试同学');
  await expect(info).toContainText('测试学院');
  await expect(info).toContainText('TEST001');
  await page.screenshot({ path: testInfo.outputPath('profile-sidebar.png') });
  await page.getByRole('button', { name: '返回首页', exact: true }).click();
  await page.getByRole('button', { name: '编辑个人信息', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '退出登录', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: '登录', exact: true })).toBeVisible();
});

test('音乐入口保留待添加状态，个人资料可取消，窄屏可操作', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.getByRole('button', { name: '背景音乐', exact: true }).click();
  const music = page.getByRole('dialog', { name: '背景音乐', exact: true });
  await expect(music.getByText('背景音乐尚未添加', { exact: true })).toBeVisible();
  await expect(music.getByRole('button', { name: '播放背景音乐', exact: true })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(music).toBeHidden();
  await page.screenshot({ path: testInfo.outputPath('home-desktop.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: '登录', exact: true }).click();
  const login = page.getByRole('dialog', { name: '校园登录', exact: true });
  await login.getByLabel('姓名', { exact: true }).fill('未保存');
  await page.screenshot({ path: testInfo.outputPath('login-mobile.png') });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(login).toBeHidden();
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(login.getByLabel('姓名', { exact: true })).toHaveValue('');
});

test('本机保存失败时不误报登录成功', async ({ page }) => {
  await page.addInitScript(() => { Storage.prototype.setItem = () => { throw new Error('blocked'); }; });
  await page.goto('/');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  const login = page.getByRole('dialog', { name: '校园登录', exact: true });
  await login.getByLabel('姓名', { exact: true }).fill('测试同学');
  await login.getByLabel('学院', { exact: true }).fill('测试学院');
  await login.getByRole('button', { name: '保存并登录', exact: true }).click();
  await expect(login.getByRole('alert')).toContainText('无法保存');
  await expect(login.getByLabel('姓名', { exact: true })).toHaveValue('测试同学');
});
