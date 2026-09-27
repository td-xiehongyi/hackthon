import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { enterCampusAt } from './helpers/campus';

// Reuse the repository PNG reader to compare actual rendered pixels.
const pngModule = '../../tools/map/png.mjs';
const { decodePng, encodePng } = await import(pngModule);

for (const scenario of [
  { name: '门柱后面遮住人物', x: 305, y: 398, covered: true, sample: { x: 301, y: 382, w: 8, h: 13 } },
  { name: '横梁后面遮住人物', x: 335, y: 380, covered: true, sample: { x: 331, y: 362, w: 8, h: 9 } },
  { name: '门洞保留人物', x: 335, y: 398, covered: false, sample: { x: 331, y: 382, w: 8, h: 13 } },
  { name: '走到门前显示人物', x: 305, y: 419, covered: false, sample: { x: 301, y: 402, w: 8, h: 8 } },
]) {
  test(scenario.name, async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await enterCampusAt(page, scenario.x, scenario.y);
    await expect(page.getByTestId('character-status')).toContainText(`位置 ${scenario.x}, ${scenario.y}`);
    await page.waitForTimeout(400);
    const canvas = page.locator('.map-canvas canvas');
    const normal = decodePng(await canvas.screenshot());
    await page.screenshot({ path: testInfo.outputPath('character.png') });

    // Same scene and camera, with only the character artwork made transparent.
    await page.route('**/characters/**/*.png', async route => {
      const pathname = new URL(route.request().url()).pathname;
      const sheet = decodePng(readFileSync(`public${pathname}`));
      await route.fulfill({ contentType: 'image/png', body: encodePng({
        width: sheet.width, height: sheet.height, channels: 4,
        data: Buffer.alloc(sheet.width * sheet.height * 4),
      }) });
    });
    await enterCampusAt(page, scenario.x, scenario.y);
    await page.waitForTimeout(400);
    const empty = decodePng(await canvas.screenshot());
    const zoom = 2.33;
    const left = Math.ceil(normal.width / 2 + (scenario.sample.x - scenario.x) * zoom);
    const top = Math.ceil(normal.height / 2 + (scenario.sample.y - scenario.y) * zoom);
    let changed = 0;
    for (let y = top; y < top + Math.floor(scenario.sample.h * zoom); y++) {
      for (let x = left; x < left + Math.floor(scenario.sample.w * zoom); x++) {
        const offset = (y * normal.width + x) * normal.channels;
        if (!normal.data.subarray(offset, offset + 3).equals(empty.data.subarray(offset, offset + 3))) changed++;
      }
    }
    if (scenario.covered) expect(changed, '门柱像素应与没有人物时完全一致').toBe(0);
    else expect(changed, '门洞或门前应能看见人物').toBeGreaterThan(30);
    expect(errors).toEqual([]);
  });
}
