import { randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { afterEach, expect, test } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../server/app.ts';
import { loadConfig } from '../../server/config.ts';

const roots: string[] = [];
const apps: FastifyInstance[] = [];
const origin = { origin: 'http://127.0.0.1:5173' };
const endpoint = '/api/v1/canteen/reviews';
function createApp(root = mkdtempSync(join(tmpdir(), 'canteen-reviews-'))) {
  if (!roots.includes(root)) roots.push(root);
  const app = buildApp({ ...loadConfig(), dataRoot: root });
  apps.push(app);
  return { app, root };
}
afterEach(async () => {
  for (const app of apps.splice(0)) await app.close();
  for (const root of roots.splice(0)) {
    if (!resolve(root).startsWith(resolve(tmpdir()) + sep + 'canteen-reviews-')) throw new Error('清理路径不在测试临时目录内');
    rmSync(root, { recursive: true, force: true });
  }
});
const review = (windowId = 'f1-rice') => ({ id: randomUUID(), windowId, author: '同学', rating: 4, text: '热乎好吃，下次再来。' });

test('评价落盘后新服务仍可读取，不同窗口独立且追加不覆盖', async () => {
  const { app, root } = createApp();
  const first = review();
  const second = review('f4-drink');
  for (const payload of [first, second]) {
    const result = await app.inject({ method: 'POST', url: endpoint, headers: origin, payload });
    expect(result.statusCode).toBe(201);
    expect(result.json()).toMatchObject({ ...payload, createdAt: expect.any(String) });
  }
  await app.close();
  const reopened = createApp(root).app;
  const result = await reopened.inject({ method: 'GET', url: endpoint });
  expect(result.statusCode).toBe(200);
  expect(result.json().reviews).toHaveLength(2);
  expect(result.json().reviews).toEqual(expect.arrayContaining([expect.objectContaining(first), expect.objectContaining(second)]));
});

test('重试同一评价只保存一次，复用 ID 改写内容被拒绝', async () => {
  const { app } = createApp();
  const payload = review();
  const send = (body: unknown) => app.inject({ method: 'POST', url: endpoint, headers: origin, payload: body as object });
  expect((await send(payload)).statusCode).toBe(201);
  expect((await send(payload)).statusCode).toBe(201);
  expect((await send({ ...payload, text: '另一个内容' })).statusCode).toBe(409);
  expect((await app.inject({ method: 'GET', url: endpoint })).json().reviews).toHaveLength(1);
});

test('拒绝空内容、无效评分、未知窗口与未授权来源', async () => {
  const { app } = createApp();
  for (const patch of [{ text: '   ' }, { text: '字'.repeat(1001) }, { author: '名'.repeat(31) }, { rating: 0 }, { rating: 6 }, { rating: 2.5 }, { windowId: '../other' }, { id: 'bad' }]) {
    const result = await app.inject({ method: 'POST', url: endpoint, headers: origin, payload: { ...review(), ...patch } });
    expect(result.statusCode).toBe(400);
  }
  expect((await app.inject({ method: 'POST', url: endpoint, payload: review() })).statusCode).toBe(403);
  expect((await app.inject({ method: 'GET', url: endpoint })).json().reviews).toEqual([]);
});

test('已有评价文件损坏时报告错误，不能覆盖为空', async () => {
  const { app, root } = createApp();
  const path = join(root, 'canteen-reviews.json');
  writeFileSync(path, '{broken');
  expect((await app.inject({ method: 'GET', url: endpoint })).statusCode).toBe(503);
  expect((await app.inject({ method: 'POST', url: endpoint, headers: origin, payload: review() })).statusCode).toBe(503);
  expect(readFileSync(path, 'utf8')).toBe('{broken');
});
