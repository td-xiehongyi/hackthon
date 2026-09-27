# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: map-overlay.spec.ts >> 大地图可缩放、拖动和回到当前位置，标记保持醒目
- Location: tests\e2e\map-overlay.spec.ts:4:1

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:5175/
Call log:
  - navigating to "http://127.0.0.1:5175/", waiting until "load"

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e6]:
    - heading "无法访问此网站" [level=1] [ref=e7]
    - paragraph [ref=e8]:
      - strong [ref=e9]: 127.0.0.1
      - text: 拒绝了我们的连接请求。
    - generic [ref=e10]:
      - paragraph [ref=e11]: 请试试以下办法：
      - list [ref=e12]:
        - listitem [ref=e13]: 检查网络连接
        - listitem [ref=e14]:
          - link "检查代理服务器和防火墙" [ref=e15] [cursor=pointer]:
            - /url: "#buttons"
    - generic [ref=e16]: ERR_CONNECTION_REFUSED
  - generic [ref=e17]:
    - button "重新加载" [ref=e19] [cursor=pointer]
    - button "详情" [ref=e20] [cursor=pointer]
```

# Test source

```ts
  1  | import { readFileSync } from 'node:fs';
  2  | import { expect, type Page } from '@playwright/test';
  3  | 
  4  | /** 只调整测试出生点；碰撞、建筑交互和渲染使用正式地图。 */
  5  | export async function enterCampusAt(page: Page, x: number, y: number) {
  6  |   const map = JSON.parse(readFileSync('public/maps/campus-v20.annotations.json', 'utf8'));
  7  |   map.safePoints = [{ id: 'test-spawn', position: { x, y }, usage: ['spawn'], verificationStatus: 'verified' }];
  8  |   await page.route('**/maps/campus-v20.annotations.json', route => route.fulfill({ json: map }));
> 9  |   await page.goto('/');
     |              ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:5175/
  10 |   await page.getByRole('button', { name: '进入校园', exact: true }).click();
  11 |   await expect(page.getByRole('status', { name: '地图加载状态' })).toHaveText('地图已加载');
  12 | }
  13 | 
  14 | export async function dragMap(page: Page) {
  15 |   const box = (await page.locator('.map-canvas canvas').boundingBox())!;
  16 |   await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  17 |   await page.mouse.down();
  18 |   await page.mouse.move(box.x + box.width / 2 + 70, box.y + box.height / 2 + 50, { steps: 8 });
  19 |   await page.mouse.up();
  20 | }
  21 | 
```