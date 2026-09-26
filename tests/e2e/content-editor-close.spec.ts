import { expect, test, type Page } from '@playwright/test';

async function openEditor(page: Page) {
  await page.goto('/stadium-preview.html');
  await page.getByRole('button', { name: '内容编辑器（维护视角）' }).click();
  await expect(page.getByRole('button', { name: '+ 新增社团', exact: true })).toBeVisible();
}

test.beforeEach(async ({ page }) => openEditor(page));

test('未提交的社团输入关闭时提醒，取消保留输入，确认后离开', async ({ page }) => {
  await page.getByRole('button', { name: '+ 新增社团', exact: true }).click();
  await page.getByLabel('名称', { exact: true }).fill('尚未提交的社团');
  await page.getByLabel('简介', { exact: true }).fill('关闭后仍应保留的输入');
  const dialogs: string[] = [];
  page.once('dialog', async (dialog) => {
    dialogs.push(dialog.type());
    await dialog.dismiss();
  });
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  expect(dialogs).toEqual(['confirm']);
  await expect(page.getByLabel('名称', { exact: true })).toHaveValue('尚未提交的社团');
  await expect(page.locator('.ce-form textarea')).toHaveValue('关闭后仍应保留的输入');

  page.once('dialog', async (dialog) => dialog.accept());
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await expect(page.getByRole('heading', { name: '社团与活动编辑器' })).toBeHidden();
});

test('空白新表单和恢复原值的表单关闭时不提醒', async ({ page }) => {
  const dialogs: string[] = [];
  page.on('dialog', async (dialog) => { dialogs.push(dialog.type()); await dialog.dismiss(); });
  for (const revert of [false, true]) {
    await page.getByRole('button', { name: '+ 新增社团', exact: true }).click();
    if (revert) {
      await page.getByLabel('名称', { exact: true }).fill('临时输入');
      await page.getByLabel('名称', { exact: true }).fill('');
    }
    await page.getByRole('button', { name: '关闭', exact: true }).click();
    await expect(page.getByRole('heading', { name: '社团与活动编辑器' })).toBeHidden();
    await openEditor(page);
  }
  expect(dialogs).toEqual([]);
});

test('只添加链接也属于未保存输入', async ({ page }) => {
  await page.getByRole('button', { name: '+ 新增社团', exact: true }).click();
  await page.getByRole('button', { name: '+ 添加链接', exact: true }).click();
  const dialogs: string[] = [];
  page.once('dialog', async (dialog) => { dialogs.push(dialog.type()); await dialog.dismiss(); });
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  expect(dialogs).toEqual(['confirm']);
  await expect(page.getByPlaceholder('https://…')).toBeVisible();
});

test('取消社团表单后清除未提交输入状态', async ({ page }) => {
  await page.getByRole('button', { name: '+ 新增社团', exact: true }).click();
  await page.getByLabel('名称', { exact: true }).fill('取消的社团');
  await page.getByRole('button', { name: '取消', exact: true }).click();
  const dialogs: string[] = [];
  page.on('dialog', async (dialog) => { dialogs.push(dialog.type()); await dialog.dismiss(); });
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await expect(page.getByRole('heading', { name: '社团与活动编辑器' })).toBeHidden();
  expect(dialogs).toEqual([]);
});

test('提交社团后仍需提醒，保存整份内容后可以直接关闭', async ({ page }) => {
  await page.getByRole('button', { name: '+ 新增社团', exact: true }).click();
  await page.getByLabel('名称', { exact: true }).fill('等待保存的社团');
  await page.getByRole('button', { name: '保存社团', exact: true }).click();
  const dialogs: string[] = [];
  page.on('dialog', async (dialog) => { dialogs.push(dialog.type()); await dialog.dismiss(); });
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  expect(dialogs).toEqual(['confirm']);
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByText('保存成功', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await expect(page.getByRole('heading', { name: '社团与活动编辑器' })).toBeHidden();
  expect(dialogs).toEqual(['confirm']);
});

test('未提交的活动输入也参与宿主关闭检查', async ({ page }) => {
  await page.getByRole('button', { name: '+ 新增活动', exact: true }).click();
  await page.getByLabel('名称', { exact: true }).fill('未提交活动');
  const dialogs: string[] = [];
  page.once('dialog', async (dialog) => { dialogs.push(dialog.type()); await dialog.dismiss(); });
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  expect(dialogs).toEqual(['confirm']);
  await expect(page.getByLabel('名称', { exact: true })).toHaveValue('未提交活动');
});
