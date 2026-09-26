import { mkdtempSync, readFileSync, rmSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { ImagePolicy, PublicContent } from '@/shared/contracts';
import { buildServer } from '../../server/app.ts';
import { Storage } from '../../server/storage.ts';

/**
 * 集成测试：真实 Fastify 服务 + 临时数据目录。每个用例独立目录，不触碰项目 data/。
 * 图片政策使用测试配置，与用户确认的正式政策无关。
 */

const ORIGIN = 'http://127.0.0.1:5173';
const HOST = '127.0.0.1:5173';
const TEST_POLICY: ImagePolicy = {
  status: 'configured', acceptedMimeTypes: ['image/png', 'image/jpeg'], maxFileBytes: 4096, maxAlbumBytes: null, maxAlbumCount: 3,
};

/** 1×1 PNG（真实可解析的文件头）。variant 改变像素字节，得到不同内容。 */
function png(variant = 0) {
  const buf = Buffer.from(
    '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360f8cf00000301010018dd8db40000000049454e44ae426082',
    'hex',
  );
  return Buffer.concat([buf, Buffer.from([variant])]);
}
const GIF = Buffer.from('474946383961010001000000002c00000000010001000002024401003b', 'hex');

let dir: string;
let storage: Storage;
let app: FastifyInstance;

async function start(policy: ImagePolicy = TEST_POLICY) {
  storage = new Storage(dir);
  await storage.open();
  app = await buildServer({ storage, imagePolicy: policy, allowedOrigins: [ORIGIN], allowedHosts: [HOST] });
}

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'csu-data-'));
  await new Storage(dir).init();
  await start();
});
afterEach(async () => {
  await app?.close();
  rmSync(dir, { recursive: true, force: true });
});

function upload(placeId: string, body: Buffer, key: string = randomUUID(), headers: Record<string, string> = {}) {
  const boundary = 'x' + randomUUID();
  const payload = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="a.png"\r\nContent-Type: image/png\r\n\r\n`),
    body,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  return app.inject({
    method: 'POST', url: `/api/v1/places/${placeId}/photos`, payload,
    headers: { host: HOST, origin: ORIGIN, 'content-type': `multipart/form-data; boundary=${boundary}`, 'idempotency-key': key, ...headers },
  });
}
const get = (url: string) => app.inject({ method: 'GET', url, headers: { host: HOST } });
const put = (payload: unknown, headers: Record<string, string> = {}) =>
  app.inject({ method: 'PUT', url: '/api/v1/public-content', payload: payload as object, headers: { host: HOST, origin: ORIGIN, ...headers } });

const CLUB = { id: 'club-a', name: '测试社团', category: '体育', summary: '', campusIds: ['xiaoxiang'], links: [] };
const ACTIVITY = {
  id: 'act-a', name: '测试活动', organizerClubId: 'club-a', category: '比赛',
  startsAt: '2026-10-01T09:00:00+08:00', endsAt: '2026-10-01T11:00:00+08:00',
  campusId: null, venue: '体育馆', description: '', links: [{ label: '说明', url: 'https://example.com' }],
};

describe('初始化与读取', () => {
  test('初始化后返回空快照与空相册；重复初始化不覆盖', async () => {
    expect((await get('/api/v1/public-content')).json()).toEqual({ schemaVersion: 1, revision: 0, clubs: [], activities: [] });
    expect((await get('/api/v1/places/xiaoxiang_library/photos')).json()).toEqual({ placeId: 'xiaoxiang_library', photos: [] });
    expect(await new Storage(dir).init()).toBe('already-initialized');
  });

  test('能力声明：三个地点、单张上传、无删除/说明/排序', async () => {
    const caps = (await get('/api/v1/capabilities')).json();
    expect(caps.placeIds).toEqual(['xiaoxiang_library', 'xiaoxiang_teaching_group', 'xiaoxiang_sports_ground']);
    expect(caps.features).toEqual({ photoUpload: 'single', photoDelete: false, photoCaption: false, photoReorder: false });
    expect(caps.contractVersion).toBe('1.0.0');
  });

  test('有文件但无初始化标记的目录拒绝初始化', async () => {
    const other = mkdtempSync(join(tmpdir(), 'csu-data-'));
    writeFileSync(join(other, 'public-content.json'), '{}');
    await expect(new Storage(other).init()).rejects.toThrow(/已有文件/);
    rmSync(other, { recursive: true, force: true });
  });

  test('损坏的 JSON 不被自动重置，服务拒绝启动并保留原文件', async () => {
    await app.close();
    writeFileSync(join(dir, 'public-content.json'), '{ broken');
    await expect(new Storage(dir).open()).rejects.toMatchObject({ code: 'STORAGE_DATA_INVALID' });
    expect(readFileSync(join(dir, 'public-content.json'), 'utf-8')).toBe('{ broken');
  });

  test('未初始化的目录不会被当成首次运行', async () => {
    const empty = mkdtempSync(join(tmpdir(), 'csu-data-'));
    await expect(new Storage(empty).open()).rejects.toMatchObject({ code: 'STORAGE_UNAVAILABLE' });
    expect(readdirSync(empty)).toEqual([]);
    rmSync(empty, { recursive: true, force: true });
  });

  test('响应禁止缓存', async () => {
    expect((await get('/api/v1/public-content')).headers['cache-control']).toBe('no-store');
  });
});

describe('来源校验', () => {
  test('非本机 Host 被拒绝', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/capabilities', headers: { host: 'evil.example:5173' } });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('REQUEST_ORIGIN_REJECTED');
  });

  test('写请求缺少或来自其他 Origin 被拒绝', async () => {
    expect((await upload('xiaoxiang_library', png(), randomUUID(), { origin: 'http://localhost:5173' })).statusCode).toBe(403);
    const res = await app.inject({ method: 'PUT', url: '/api/v1/public-content', payload: {}, headers: { host: HOST } });
    expect(res.json().error.code).toBe('REQUEST_ORIGIN_REJECTED');
  });

  test('不设置允许任意来源的 CORS 头', async () => {
    expect((await get('/api/v1/capabilities')).headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('公共内容', () => {
  test('保存成功返回新快照，revision 递增，重启后仍在', async () => {
    const res = await put({ expectedRevision: 0, content: { clubs: [CLUB], activities: [ACTIVITY] } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ revision: 1, clubs: [CLUB], activities: [ACTIVITY] });
    await app.close();
    await start();
    expect((await get('/api/v1/public-content')).json().revision).toBe(1);
  });

  test('版本冲突返回 409 且不覆盖', async () => {
    await put({ expectedRevision: 0, content: { clubs: [CLUB], activities: [] } });
    const res = await put({ expectedRevision: 0, content: { clubs: [], activities: [] } });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('REVISION_CONFLICT');
    expect((await get('/api/v1/public-content')).json().clubs).toEqual([CLUB]);
  });

  test('无效内容 422 带字段路径，旧快照不变', async () => {
    const bad: PublicContent = {
      clubs: [CLUB as never],
      activities: [{ ...ACTIVITY, organizerClubId: 'nope', endsAt: '2026-10-01T08:00:00+08:00' } as never],
    };
    const res = await put({ expectedRevision: 0, content: bad });
    expect(res.statusCode).toBe(422);
    const paths = res.json().error.fields.map((f: { path: string }) => f.path);
    expect(paths).toContain('activities[0].organizerClubId');
    expect(paths).toContain('activities[0].endsAt');
    expect((await get('/api/v1/public-content')).json().revision).toBe(0);
  });

  test('未知字段、非 http 链接、无时区时间均被拒绝', async () => {
    expect((await put({ expectedRevision: 0, content: { clubs: [], activities: [] }, revision: 5 })).statusCode).toBe(400);
    expect((await put({ expectedRevision: 0, content: { clubs: [{ ...CLUB, extra: 1 }], activities: [] } })).statusCode).toBe(422);
    const js = { ...CLUB, links: [{ label: 'x', url: 'javascript:alert(1)' }] };
    expect((await put({ expectedRevision: 0, content: { clubs: [js], activities: [] } })).statusCode).toBe(422);
    const tz = { ...ACTIVITY, startsAt: '2026-10-01T09:00:00' };
    expect((await put({ expectedRevision: 0, content: { clubs: [CLUB], activities: [tz] } })).statusCode).toBe(422);
  });
});

describe('相册', () => {
  test('上传后出现在本地点相册，另两个地点看不到；图片可读取且类型正确', async () => {
    const res = await upload('xiaoxiang_library', png());
    expect(res.statusCode).toBe(201);
    const photo = res.json();
    expect(photo).toMatchObject({ placeId: 'xiaoxiang_library', mediaType: 'image/png', byteSize: png().length });
    expect(photo.fileUrl).toBe(`/api/v1/photos/${photo.id}/file`);
    expect(photo).not.toHaveProperty('sha256');
    expect(photo).not.toHaveProperty('fileName');

    expect((await get('/api/v1/places/xiaoxiang_library/photos')).json().photos).toHaveLength(1);
    expect((await get('/api/v1/places/xiaoxiang_sports_ground/photos')).json().photos).toEqual([]);
    expect((await get('/api/v1/places/xiaoxiang_teaching_group/photos')).json().photos).toEqual([]);

    const file = await get(photo.fileUrl);
    expect(file.statusCode).toBe(200);
    expect(file.headers['content-type']).toBe('image/png');
    expect(file.headers['x-content-type-options']).toBe('nosniff');
    expect(file.rawPayload.equals(png())).toBe(true);
  });

  test('新上传不覆盖旧图片；重启后相册仍在', async () => {
    await upload('xiaoxiang_library', png(1));
    await upload('xiaoxiang_library', png(2));
    await app.close();
    await start();
    expect((await get('/api/v1/places/xiaoxiang_library/photos')).json().photos).toHaveLength(2);
  });

  test('同键同图重放返回原结果不新增；同键不同图或不同地点返回冲突', async () => {
    const key = randomUUID();
    const first = (await upload('xiaoxiang_library', png(), key)).json();
    const replay = await upload('xiaoxiang_library', png(), key);
    expect(replay.statusCode).toBe(201);
    expect(replay.json()).toEqual(first);
    expect((await get('/api/v1/places/xiaoxiang_library/photos')).json().photos).toHaveLength(1);
    expect((await upload('xiaoxiang_library', png(9), key)).json().error.code).toBe('IDEMPOTENCY_CONFLICT');
    expect((await upload('xiaoxiang_sports_ground', png(), key)).json().error.code).toBe('IDEMPOTENCY_CONFLICT');
  });

  test('并发同键请求只提交一次', async () => {
    const key = randomUUID();
    const results = await Promise.all(Array.from({ length: 5 }, () => upload('xiaoxiang_library', png(), key)));
    expect(results.every((r) => r.statusCode === 201)).toBe(true);
    expect(new Set(results.map((r) => r.json().id)).size).toBe(1);
    expect((await get('/api/v1/places/xiaoxiang_library/photos')).json().photos).toHaveLength(1);
  });

  test('重放已提交请求不受后来的政策或容量影响', async () => {
    const key = randomUUID();
    const first = (await upload('xiaoxiang_library', png(), key)).json();
    await app.close();
    await start({ status: 'pending' });
    const replay = await upload('xiaoxiang_library', png(), key);
    expect(replay.statusCode).toBe(201);
    expect(replay.json().id).toBe(first.id);
  });

  test('政策待配置时新上传返回 503，读取正常', async () => {
    await app.close();
    await start({ status: 'pending' });
    const res = await upload('xiaoxiang_library', png());
    expect(res.statusCode).toBe(503);
    expect(res.json().error.code).toBe('IMAGE_POLICY_PENDING');
    expect((await get('/api/v1/places/xiaoxiang_library/photos')).statusCode).toBe(200);
  });

  test('按实际内容判定类型：不在允许列表 415、非图片 422、超限 413、数量上限 409', async () => {
    expect((await upload('xiaoxiang_library', GIF)).json().error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
    expect((await upload('xiaoxiang_library', Buffer.from('not an image at all, just text'))).json().error.code).toBe('INVALID_IMAGE');
    expect((await upload('xiaoxiang_library', Buffer.concat([png(), Buffer.alloc(5000)]))).json().error.code).toBe('FILE_TOO_LARGE');
    for (let i = 0; i < 3; i++) expect((await upload('xiaoxiang_library', png(i))).statusCode).toBe(201);
    expect((await upload('xiaoxiang_library', png(7))).json().error.code).toBe('ALBUM_LIMIT_REACHED');
    // 容量按地点计算：其他地点不受影响。
    expect((await upload('xiaoxiang_sports_ground', png(7))).statusCode).toBe(201);
  });

  test('失败的上传不留下文件，已有图片不受影响', async () => {
    await upload('xiaoxiang_library', png(1));
    await upload('xiaoxiang_library', GIF);
    await upload('xiaoxiang_library', Buffer.from('garbage'));
    expect(readdirSync(join(dir, 'photos', 'files'))).toHaveLength(1);
  });

  test('请求格式错误：缺键、非 UUID、未注册地点、多文件', async () => {
    expect((await upload('xiaoxiang_library', png(), 'not-a-uuid')).json().error.code).toBe('INVALID_REQUEST');
    expect((await upload('xiaoxiang_main_stadium', png())).json().error.code).toBe('PLACE_NOT_FOUND');
    expect((await get('/api/v1/places/..%2F..%2Fetc/photos')).statusCode).toBe(404);
    const boundary = 'b' + randomUUID();
    const part = (name: string) => Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"; filename="a.png"\r\nContent-Type: image/png\r\n\r\n`), png(), Buffer.from('\r\n'),
    ]);
    const two = await app.inject({
      method: 'POST', url: '/api/v1/places/xiaoxiang_library/photos',
      payload: Buffer.concat([part('file'), part('file'), Buffer.from(`--${boundary}--\r\n`)]),
      headers: { host: HOST, origin: ORIGIN, 'content-type': `multipart/form-data; boundary=${boundary}`, 'idempotency-key': randomUUID() },
    });
    expect(two.statusCode).toBe(400);
    expect((await get('/api/v1/places/xiaoxiang_library/photos')).json().photos).toEqual([]);
  });

  test('未知图片 404；索引存在但文件缺失时报存储异常，不谎报不存在', async () => {
    expect((await get(`/api/v1/photos/${randomUUID()}/file`)).json().error.code).toBe('PHOTO_NOT_FOUND');
    expect((await get('/api/v1/photos/..%2F..%2Fpackage.json/file')).statusCode).toBe(404);
    const photo = (await upload('xiaoxiang_library', png())).json();
    for (const f of readdirSync(join(dir, 'photos', 'files'))) rmSync(join(dir, 'photos', 'files', f));
    const res = await get(photo.fileUrl);
    expect(res.statusCode).toBe(503);
    expect(res.json().error.code).toBe('STORAGE_DATA_INVALID');
    expect(res.body).not.toContain(dir);
  });

  test('相册与公共内容互不影响', async () => {
    await upload('xiaoxiang_library', png());
    await put({ expectedRevision: 0, content: { clubs: [], activities: [] } });
    expect((await get('/api/v1/places/xiaoxiang_library/photos')).json().photos).toHaveLength(1);
    mkdirSync(join(dir, 'unused'), { recursive: true });
  });
});
