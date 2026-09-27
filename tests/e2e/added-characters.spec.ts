import { expect, test } from '@playwright/test';

test('男生修订版、猫与奶蛙可选择、记忆、切换进入地图并步行骑行', async ({ page }, testInfo) => {
  const errors: string[] = [];
  const failedAssets: string[] = [];
  const loadedAssets = new Set<string>();
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if (!response.url().includes('/characters/')) return;
    if (response.status() >= 400) failedAssets.push(response.url());
    else loadedAssets.add(new URL(response.url()).pathname);
  });
  await page.goto('/');
  for (const [id, name] of [['photo-olive-student', '小黄鸭'], ['photo-point-cat', 'Loopy'], ['yellow-belly-creature', '奶蛙']]) {
    const button = page.getByRole('button', { name: `选择${name}`, exact: true });
    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.start-character-stage .character-preview')).toHaveCSS('background-image', new RegExp(id));
    if (id === 'photo-olive-student') {
      await page.reload();
      await expect(button).toHaveAttribute('aria-pressed', 'true');
    }
    await page.screenshot({ path: testInfo.outputPath(`${id}-home.png`), fullPage: true });
    await page.getByRole('button', { name: '进入校园', exact: true }).click();
    await expect(page.getByRole('status', { name: '地图加载状态' })).toHaveText('地图已加载');
    const status = page.getByTestId('character-status');
    await expect(status).toContainText(name);
    await expect(page.locator('.explorer-portrait .character-preview')).toHaveCSS('background-image', new RegExp(id));
    const position = async () => (await status.innerText()).match(/位置 \d+, \d+/)![0];
    await page.locator('.map-canvas canvas').focus();
    for (const [key, facing] of [['KeyA', 'left'], ['KeyD', 'right']]) {
      const before = await position();
      await page.keyboard.down(key);
      try {
        await expect(status).toContainText(`朝向 ${facing}`);
        await expect.poll(position).not.toBe(before);
      } finally { await page.keyboard.up(key); }
      // Wait for Phaser's key-up update and React's status render before reading the stopped position.
      await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
      await expect(status).toContainText(`朝向 ${facing}`);
    }
    const beforeRide = await position();
    await page.keyboard.down('Shift');
    await expect(status).toContainText('骑行');
    expect(await position()).toBe(beforeRide);
    await page.screenshot({ path: testInfo.outputPath(`${id}-ride.png`) });
    await page.keyboard.up('Shift');
    await expect(status).toContainText('步行');
    await page.screenshot({ path: testInfo.outputPath(`${id}-walk.png`) });
    expect(loadedAssets.has(`/characters/${id}/manifest.json`)).toBe(true);
    if (id === 'photo-olive-student') expect(loadedAssets.has(`/characters/${id}/walk-sides-v2.png`)).toBe(true);
    await page.getByRole('button', { name: '返回首页', exact: true }).click();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
  }
  await page.reload();
  await expect(page.getByRole('button', { name: '选择奶蛙', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(failedAssets).toEqual([]);
  expect(errors).toEqual([]);
});

test('窄屏七个角色可点选及箭头切换，没有重复猫卡或横向溢出', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('group', { name: '可选角色' }).getByRole('button')).toHaveCount(7);
  await expect(page.locator('.start-character-pending')).toHaveCount(0);
  await page.getByRole('button', { name: '选择小黄鸭', exact: true }).click();
  await page.getByRole('button', { name: '下一个角色', exact: true }).click();
  await expect(page.getByRole('button', { name: '选择Loopy', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '上一个角色', exact: true }).click();
  await expect(page.getByRole('button', { name: '选择小黄鸭', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '选择奶蛙', exact: true }).click();
  await page.getByRole('button', { name: '上一个角色', exact: true }).click();
  await expect(page.getByRole('button', { name: '选择Loopy', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '下一个角色', exact: true }).click();
  await expect(page.getByRole('button', { name: '选择奶蛙', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('home-mobile.png'), fullPage: true });
});
