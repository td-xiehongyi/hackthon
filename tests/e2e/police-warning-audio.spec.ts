import { expect, test, type Page } from '@playwright/test';
import { enterCampusAt } from './helpers/campus';

async function prepare(page: Page, place: 'run' | 'gate') {
  const [x, y] = place === 'run' ? [425, 934] : [335, 419];
  await enterCampusAt(page, x!, y!);
  if (place === 'run') {
    await page.keyboard.press('KeyE');
    await page.getByRole('tab', { name: '校园跑', exact: true }).click();
    await page.getByRole('button', { name: '开始校园跑', exact: true }).click();
  }
  await expect.poll(() => page.locator('audio[loop]').evaluate((el: HTMLAudioElement) => !el.paused && el.currentTime > 0)).toBe(true);
}

async function warn(page: Page, place: 'run' | 'gate') {
  await page.keyboard.down('Shift');
  if (place === 'gate') await page.keyboard.down('KeyD');
  await expect(place === 'run'
    ? page.getByRole('dialog', { name: '操场禁止骑电动车！！！' })
    : page.getByRole('button', { name: '同学停下！！！头盔！！！！', exact: true })).toBeVisible();
  await page.keyboard.up('Shift');
  await page.keyboard.up('KeyD');
}

for (const place of ['run', 'gate'] as const) {
  test(`${place}：语言框出现播放一次提示音，结束从原进度恢复原曲`, async ({ page }) => {
    await prepare(page, place);
    const background = page.locator('audio[loop]');
    const warning = page.locator('audio:not([loop])');
    await warn(page, place);
    await expect(warning).toHaveAttribute('src', /police-warning\.wav$/);
    await expect.poll(() => warning.evaluate((el: HTMLAudioElement) => !el.paused && el.currentTime > 0)).toBe(true);
    expect(await background.evaluate((el: HTMLAudioElement) => el.paused)).toBe(true);
    const stoppedAt = await background.evaluate((el: HTMLAudioElement) => el.currentTime);
    await page.keyboard.press('KeyA');
    expect(await background.evaluate((el: HTMLAudioElement) => el.paused)).toBe(true);
    expect(await background.evaluate((el: HTMLAudioElement) => el.currentTime)).toBe(stoppedAt);
    await warning.evaluate((el: HTMLAudioElement) => { el.currentTime = el.duration - 0.15; });
    await expect.poll(() => background.evaluate((el: HTMLAudioElement) => !el.paused)).toBe(true);
    expect(await background.evaluate((el: HTMLAudioElement) => el.currentTime)).toBeGreaterThanOrEqual(stoppedAt);
    await expect(background).toHaveAttribute('src', place === 'run' ? /campus-run\.mp3$/ : /campus-background\.mp3$/);
    await page.keyboard.press('KeyA');
    expect(await warning.evaluate((el: HTMLAudioElement) => el.paused)).toBe(true);
  });

  test(`${place}：提前关闭语言框停止提示音，静音和音量沿用设置`, async ({ page }) => {
    await prepare(page, place);
    await page.getByRole('button', { name: '背景音乐设置' }).click();
    await page.getByRole('slider', { name: '音乐音量' }).fill('27');
    await page.getByRole('button', { name: '静音', exact: true }).click();
    await page.getByRole('button', { name: '关闭背景音乐' }).click();
    await warn(page, place);
    const warning = page.locator('audio:not([loop])');
    await expect.poll(() => warning.evaluate((el: HTMLAudioElement) => !el.paused)).toBe(true);
    expect(await warning.evaluate((el: HTMLAudioElement) => ({ muted: el.muted, volume: el.volume }))).toEqual({ muted: true, volume: 0.27 });
    await page.getByRole('button', { name: place === 'run' ? '知道了，继续跑步' : '同学停下！！！头盔！！！！', exact: true }).click();
    expect(await warning.evaluate((el: HTMLAudioElement) => el.paused)).toBe(true);
    await expect.poll(() => page.locator('audio[loop]').evaluate((el: HTMLAudioElement) => !el.paused)).toBe(true);
  });
}

test('用户主动暂停后，警察提醒和退出都不会自动开启声音', async ({ page }) => {
  await prepare(page, 'run');
  await page.getByRole('button', { name: '背景音乐设置' }).click();
  await page.getByRole('button', { name: '暂停音乐' }).click();
  await page.getByRole('button', { name: '关闭背景音乐' }).click();
  await warn(page, 'run');
  expect(await page.locator('audio').evaluateAll(elements => elements.every(el => (el as HTMLAudioElement).paused))).toBe(true);
  await page.getByRole('button', { name: '返回校园', exact: true }).click();
  expect(await page.locator('audio').evaluateAll(elements => elements.every(el => (el as HTMLAudioElement).paused))).toBe(true);
});

test('提示音加载失败时恢复背景音乐', async ({ page }) => {
  await page.route('**/audio/police-warning.wav', route => route.fulfill({ status: 404, body: '' }));
  await prepare(page, 'gate');
  await warn(page, 'gate');
  await expect.poll(() => page.locator('audio:not([loop])').evaluate((el: HTMLAudioElement) => el.error !== null)).toBe(true);
  await expect.poll(() => page.locator('audio[loop]').evaluate((el: HTMLAudioElement) => !el.paused)).toBe(true);
});
