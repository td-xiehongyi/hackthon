# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: map-overlay.spec.ts >> 大地图可缩放、拖动和回到当前位置，标记保持醒目
- Location: tests\e2e\map-overlay.spec.ts:4:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('dialog', { name: '校园地图' }).getByText('你在这里', { exact: true })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('dialog', { name: '校园地图' }).getByText('你在这里', { exact: true }) with timeout 5000ms
  - waiting for getByRole('dialog', { name: '校园地图' }).getByText('你在这里', { exact: true })

```

```yaml
- main:
  - complementary "校园信息":
    - region "小地图":
      - heading "附近地图" [level=1]
      - text: 北 ↑
      - img "角色附近的校园小地图"
    - region "个人信息":
      - heading "个人信息" [level=2]
      - img "当前角色头像"
      - text: 姓名
      - strong: 待填写
      - term: 学院
      - definition: 待填写
      - term: 学号
      - definition: 待填写
    - button "返回首页" [disabled]
  - region "校园探索地图":
    - img "校园地图：浏览模式可拖动与缩放；角色模式用 WASD 移动、按住 Shift 骑行"
    - status "地图加载状态": 地图已加载
    - text: N ↑ 粉白开衫女生 · 位置 600, 1320 · 步行 · 朝向 down
  - dialog "校园地图":
    - heading "校园地图" [level=2]
    - button "关闭地图": 关闭 ×
    - img "完整校园地图与当前位置"
    - text: ● 当前位置 M / Esc 关闭
```

# Test source

```ts
  1   | import { expect, test } from '@playwright/test';
  2   | import { enterCampusAt } from './helpers/campus';
  3   | 
  4   | test('大地图可缩放、拖动和回到当前位置，标记保持醒目', async ({ page }, testInfo) => {
  5   |   await enterCampusAt(page, 600, 1320);
  6   |   await page.keyboard.press('KeyM');
  7   |   const dialog = page.getByRole('dialog', { name: '校园地图' });
  8   |   const map = dialog.getByRole('img', { name: '完整校园地图与当前位置' });
  9   |   const marker = dialog.getByTestId('map-player-marker');
> 10  |   await expect(dialog.getByText('你在这里', { exact: true })).toBeVisible();
      |                                                           ^ Error: expect(locator).toBeVisible() failed
  11  |   const original = await map.getAttribute('viewBox');
  12  |   const markerSize = (await marker.boundingBox())!.width;
  13  |   await dialog.getByRole('button', { name: '放大地图', exact: true }).click();
  14  |   await expect(dialog.getByLabel('大地图缩放比例')).toHaveText('125%');
  15  |   await expect(map).not.toHaveAttribute('viewBox', original!);
  16  |   expect((await marker.boundingBox())!.width).toBeCloseTo(markerSize, 0);
  17  |   await dialog.getByRole('button', { name: '缩小地图', exact: true }).click();
  18  |   await expect(map).toHaveAttribute('viewBox', original!);
  19  |   const box = (await map.boundingBox())!;
  20  |   await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  21  |   await page.mouse.wheel(0, -500);
  22  |   await expect(dialog.getByLabel('大地图缩放比例')).not.toHaveText('100%');
  23  |   const zoomed = await map.getAttribute('viewBox');
  24  |   await page.mouse.down();
  25  |   await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2 + 80, { steps: 8 });
  26  |   await page.mouse.up();
  27  |   await expect(map).not.toHaveAttribute('viewBox', zoomed!);
  28  |   await dialog.getByRole('button', { name: '定位当前位置' }).click();
  29  |   const located = (await marker.boundingBox())!;
  30  |   expect(located.x + located.width / 2).toBeGreaterThan(box.x);
  31  |   expect(located.x + located.width / 2).toBeLessThan(box.x + box.width);
  32  |   expect(located.y + located.height / 2).toBeGreaterThan(box.y);
  33  |   expect(located.y + located.height / 2).toBeLessThan(box.y + box.height);
  34  |   await page.screenshot({ path: testInfo.outputPath('map-location-zoom.png') });
  35  |   await dialog.getByRole('button', { name: '查看全图' }).click();
  36  |   await expect(dialog.getByLabel('大地图缩放比例')).toHaveText('100%');
  37  |   await expect(map).toHaveAttribute('viewBox', original!);
  38  |   await expect(dialog.getByRole('button', { name: '缩小地图', exact: true })).toBeDisabled();
  39  |   for (let i = 0; i < 9; i++) await dialog.getByRole('button', { name: '放大地图', exact: true }).click();
  40  |   await expect(dialog.getByLabel('大地图缩放比例')).toHaveText('600%');
  41  |   await expect(dialog.getByRole('button', { name: '放大地图', exact: true })).toBeDisabled();
  42  | });
  43  | 
  44  | test('M 打开完整地图，暂停移动，关闭后继续游玩', async ({ page }, testInfo) => {
  45  |   const errors: string[] = [];
  46  |   page.on('pageerror', error => errors.push(error.message));
  47  |   await enterCampusAt(page, 600, 1320);
  48  |   const position = page.getByTestId('character-status');
  49  |   const before = await position.textContent();
  50  |   const dialog = page.getByRole('dialog', { name: '校园地图' });
  51  |   await page.keyboard.down('KeyM');
  52  |   await expect(dialog).toBeVisible();
  53  |   await page.keyboard.down('KeyM'); // 自动重复不应关掉地图。
  54  |   await page.keyboard.up('KeyM');
  55  |   await expect(dialog).toBeVisible();
  56  |   await expect(dialog.getByRole('img', { name: '完整校园地图与当前位置' })).toBeVisible();
  57  |   await expect(dialog.getByTestId('map-player-marker')).toHaveAttribute('cx', '600');
  58  |   await expect(dialog.getByTestId('map-player-marker')).toHaveAttribute('cy', '1320');
  59  |   await page.keyboard.down('KeyA');
  60  |   await page.waitForTimeout(300);
  61  |   await expect(position).toHaveText(before!);
  62  |   await page.keyboard.press('KeyE');
  63  |   await expect(page.getByRole('region', { name: '地点功能面板' })).toHaveCount(0);
  64  |   await page.keyboard.press('KeyM');
  65  |   await expect(dialog).toHaveCount(0);
  66  |   await page.waitForTimeout(200); // 关闭清键，不延续打开前/弹窗内按住的移动键。
  67  |   await expect(position).toHaveText(before!);
  68  |   await page.keyboard.up('KeyA');
  69  |   await page.keyboard.press('KeyM');
  70  |   await page.screenshot({ path: testInfo.outputPath('map-overlay-desktop.png') });
  71  |   await page.keyboard.press('Escape');
  72  |   await expect(dialog).toHaveCount(0);
  73  |   await page.keyboard.press('KeyM');
  74  |   await dialog.getByRole('button', { name: '关闭地图' }).click();
  75  |   await expect(page.locator('.map-canvas canvas')).toBeFocused();
  76  |   await page.keyboard.down('KeyA');
  77  |   try { await expect(position).not.toHaveText(before!); }
  78  |   finally { await page.keyboard.up('KeyA'); }
  79  |   expect(errors).toEqual([]);
  80  | });
  81  | 
  82  | test('地图和地点交互面板尺寸一致，地点交互中不响应 M', async ({ page }, testInfo) => {
  83  |   await enterCampusAt(page, 600, 1320);
  84  |   for (const size of [{ width: 1440, height: 900 }, { width: 768, height: 1024 }, { width: 390, height: 844 }]) {
  85  |     await page.setViewportSize(size);
  86  |     await page.keyboard.press('KeyE');
  87  |     const place = page.getByRole('region', { name: '地点功能面板' });
  88  |     await expect(place).toBeVisible();
  89  |     const bounds = await place.boundingBox();
  90  |     await page.keyboard.press('KeyM');
  91  |     await expect(page.getByRole('dialog', { name: '校园地图' })).toHaveCount(0);
  92  |     await page.getByRole('button', { name: '返回校园', exact: true }).click();
  93  |     await expect(place).toHaveCount(0);
  94  |     await page.keyboard.press('KeyM');
  95  |     const dialog = page.getByRole('dialog', { name: '校园地图' });
  96  |     await expect(dialog).toBeVisible();
  97  |     expect(await dialog.boundingBox()).toEqual(bounds);
  98  |     expect(await dialog.evaluate(el => el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight)).toBe(false);
  99  |     if (size.width === 390) await page.screenshot({ path: testInfo.outputPath('map-overlay-mobile.png') });
  100 |     await page.keyboard.press('Escape');
  101 |   }
  102 | });
  103 | 
  104 | test('首页与输入框不触发地图快捷键', async ({ page }) => {
  105 |   await page.goto('/');
  106 |   await page.keyboard.press('KeyM');
  107 |   await expect(page.getByRole('dialog', { name: '校园地图' })).toHaveCount(0);
  108 |   await page.getByRole('button', { name: '进入校园', exact: true }).click();
  109 |   await expect(page.getByRole('status', { name: '地图加载状态' })).toHaveText('地图已加载');
  110 |   await page.evaluate(() => {
```