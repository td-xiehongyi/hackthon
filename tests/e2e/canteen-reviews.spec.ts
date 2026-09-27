import { expect, test } from '@playwright/test';
import { enterCampusAt } from './helpers/campus';

test('发布两条评价后刷新及新浏览器仍可读取，并保留在对应窗口', async ({ page, browser }, testInfo) => {
  const text = `保存验证-${Date.now()}`;
  const second = `${text}-第二条`;
  await enterCampusAt(page, 560, 748);
  await page.keyboard.press('KeyE');
  await page.getByRole('button', { name: '2 楼', exact: true }).click();
  await page.getByRole('button', { name: '查看自选麻辣烫评价' }).click();
  await page.getByRole('button', { name: '写评价', exact: true }).click();
  await expect(page.getByRole('button', { name: '发布评价', exact: true })).toBeDisabled();
  await page.getByLabel('昵称（选填）').fill('测试同学');
  await page.getByRole('combobox', { name: '评分', exact: true }).selectOption('4');
  await page.getByRole('textbox', { name: '评价内容', exact: true }).fill(text);
  await page.getByRole('button', { name: '发布评价', exact: true }).click();
  await expect(page.getByText('评价已保存，下次打开仍可查看。')).toBeVisible();
  await expect(page.locator('.canteen-published')).toContainText(text);
  await page.getByRole('button', { name: '写评价', exact: true }).click();
  await page.getByRole('textbox', { name: '评价内容', exact: true }).fill(second);
  await page.getByRole('button', { name: '发布评价', exact: true }).click();
  await expect(page.locator('.canteen-published')).toContainText(second);
  await page.screenshot({ path: testInfo.outputPath('published-reviews.png') });
  await page.reload();
  await page.getByRole('button', { name: '进入校园', exact: true }).click();
  await expect(page.getByTestId('interact-prompt')).toContainText('二食堂');
  await page.keyboard.press('KeyE');
  await page.getByRole('button', { name: '2 楼', exact: true }).click();
  await page.getByRole('button', { name: '查看自选麻辣烫评价' }).click();
  await expect(page.locator('.canteen-published')).toContainText(text);
  await expect(page.locator('.canteen-published')).toContainText(second);

  const context = await browser.newContext({ baseURL: testInfo.project.use.baseURL });
  try {
    const fresh = await context.newPage();
    await enterCampusAt(fresh, 560, 748);
    await fresh.keyboard.press('KeyE');
    await fresh.getByRole('button', { name: '2 楼', exact: true }).click();
    await fresh.getByRole('button', { name: '查看自选麻辣烫评价' }).click();
    await expect(fresh.locator('.canteen-published')).toContainText(text);
    await expect(fresh.locator('.canteen-published')).toContainText(second);
    await fresh.getByRole('button', { name: '3 楼', exact: true }).click();
    await fresh.getByRole('button', { name: '查看铁板风味评价' }).click();
    await expect(fresh.getByText(text, { exact: true })).toHaveCount(0);
  } finally { await context.close(); }
});

test('窄屏写评价：读取失败可重试，保存响应丢失后保留草稿且重试不重复', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const text = `重试验证-${Date.now()}`;
  let failRead = true;
  let loseReply = true;
  await page.route('**/api/v1/canteen/reviews', async route => {
    if (route.request().method() === 'GET' && failRead) {
      failRead = false;
      await route.fulfill({ status: 503, json: { error: { message: '测试：读取暂不可用' } } });
    } else if (route.request().method() === 'POST' && loseReply) {
      loseReply = false;
      await route.fetch(); // 服务已落盘，但模拟浏览器未收到成功响应。
      await route.abort();
    } else await route.continue();
  });
  await enterCampusAt(page, 560, 748);
  await page.keyboard.press('KeyE');
  await page.getByRole('button', { name: '查看热汤米粉评价' }).click();
  await expect(page.getByRole('button', { name: '写评价', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '重新读取', exact: true }).click();
  await page.getByRole('button', { name: '写评价', exact: true }).click();
  await page.getByRole('textbox', { name: '评价内容', exact: true }).fill(text);
  await page.getByRole('button', { name: '发布评价', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('未收到保存确认');
  await expect(page.getByRole('textbox', { name: '评价内容', exact: true })).toHaveValue(text);
  await page.screenshot({ path: testInfo.outputPath('review-form-mobile.png') });
  await page.getByRole('button', { name: '发布评价', exact: true }).click();
  await expect(page.getByText('评价已保存，下次打开仍可查看。')).toBeVisible();
  await expect(page.locator('.canteen-published').getByText(text, { exact: true })).toHaveCount(1);
  await page.getByRole('button', { name: '返回校园', exact: true }).click();
  await page.keyboard.press('KeyE');
  await page.getByRole('button', { name: '查看热汤米粉评价' }).click();
  await expect(page.locator('.canteen-published').getByText(text, { exact: true })).toHaveCount(1);
});
