import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, test } from 'vitest';
import { buildApp } from '../../server/app.ts';
import type { ServerConfig } from '../../server/config.ts';

const tempDirs: string[] = [];
const apps: FastifyInstance[] = [];

function makeConfig(imagePolicy: 'pending' | 'configured' = 'configured'): ServerConfig {
  const dataRoot = mkdtempSync(path.join(tmpdir(), 'campus-api-'));
  tempDirs.push(dataRoot);
  return {
    host: '127.0.0.1',
    port: 0,
    dataRoot,
    allowedOrigins: ['http://127.0.0.1:5173'],
    imagePolicy,
    acceptedMimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
    maxFileBytes: 1024 * 1024,
    maxAlbumBytes: null,
    maxAlbumCount: null,
  };
}

function makeApp(config?: ServerConfig): FastifyInstance {
  const app = buildApp(config ?? makeConfig());
  apps.push(app);
  return app;
}

afterEach(async () => {
  for (const app of apps.splice(0)) {
    await app.close();
  }
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

const ORIGIN = { origin: 'http://127.0.0.1:5173' };

function multipartFile(fieldName: string, filename: string, contentType: string, buf: Buffer) {
  const boundary = '----campusTestBoundary';
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`,
    'utf8',
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');
  return { boundary, payload: Buffer.concat([head, buf, tail]) };
}

function upload(app: FastifyInstance, placeId: string, buf: Buffer, key: string) {
  const { boundary, payload } = multipartFile('file', 'test.png', 'image/png', buf);
  return app.inject({
    method: 'POST',
    url: `/api/v1/places/${placeId}/photos`,
    headers: {
      'content-type': `multipart/form-data; boundary=${boundary}`,
      'idempotency-key': key,
      ...ORIGIN,
    },
    payload,
  });
}

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
const PNG2 = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 9, 9, 9, 9]);
const UUID_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const UUID_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

describe('能力接口', () => {
  test('返回四个注册地点与图片政策', async () => {
    const app = makeApp();
    const res = await app.inject({ method: 'GET', url: '/api/v1/capabilities' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.apiVersion).toBe('v1');
    expect(body.contractVersion).toBe('1.0.0');
    expect(body.placeIds).toEqual([
      'xiaoxiang_library',
      'xiaoxiang_teaching_group',
      'xiaoxiang_sports_ground',
      'lunan_canteen_2',
      'lunan_shenghua_dormitory',
    ]);
    expect(body.features).toEqual({
      photoUpload: 'single',
      photoDelete: false,
      photoCaption: false,
      photoReorder: false,
    });
    expect(body.imagePolicy.status).toBe('configured');
  });

  test('图片政策未配置时返回 pending', async () => {
    const app = makeApp(makeConfig('pending'));
    const res = await app.inject({ method: 'GET', url: '/api/v1/capabilities' });
    expect(res.json().imagePolicy).toEqual({ status: 'pending' });
  });
});

describe('公共内容读写', () => {
  test('初始为空快照，保存后版本递增', async () => {
    const app = makeApp();
    const empty = await app.inject({ method: 'GET', url: '/api/v1/public-content' });
    expect(empty.json()).toEqual({ schemaVersion: 1, revision: 0, clubs: [], activities: [] });

    const put = await app.inject({
      method: 'PUT',
      url: '/api/v1/public-content',
      headers: { 'content-type': 'application/json', ...ORIGIN },
      payload: JSON.stringify({ expectedRevision: 0, content: { clubs: [], activities: [] } }),
    });
    expect(put.statusCode).toBe(200);
    expect(put.json().revision).toBe(1);
  });

  test('版本冲突返回 409 且不覆盖', async () => {
    const app = makeApp();
    const first = await app.inject({
      method: 'PUT',
      url: '/api/v1/public-content',
      headers: { 'content-type': 'application/json', ...ORIGIN },
      payload: JSON.stringify({ expectedRevision: 0, content: { clubs: [], activities: [] } }),
    });
    expect(first.statusCode).toBe(200);

    const conflict = await app.inject({
      method: 'PUT',
      url: '/api/v1/public-content',
      headers: { 'content-type': 'application/json', ...ORIGIN },
      payload: JSON.stringify({ expectedRevision: 0, content: { clubs: [], activities: [] } }),
    });
    expect(conflict.statusCode).toBe(409);
    expect(conflict.json().error.code).toBe('REVISION_CONFLICT');
  });

  test('非法内容返回 422 并保留旧快照', async () => {
    const app = makeApp();
    const invalid = await app.inject({
      method: 'PUT',
      url: '/api/v1/public-content',
      headers: { 'content-type': 'application/json', ...ORIGIN },
      payload: JSON.stringify({
        expectedRevision: 0,
        content: {
          clubs: [],
          activities: [{
            id: 'a1', name: 'x', organizerClubId: 'nope', category: 'c',
            startsAt: '2026-10-01T10:00:00+08:00', endsAt: '2026-10-01T12:00:00+08:00',
            campusId: null, venue: '', description: '', links: [],
          }],
        },
      }),
    });
    expect(invalid.statusCode).toBe(422);
    expect(invalid.json().error.code).toBe('INVALID_CONTENT');

    const stillEmpty = await app.inject({ method: 'GET', url: '/api/v1/public-content' });
    expect(stillEmpty.json().revision).toBe(0);
  });

  test('非允许来源的写请求被拒绝', async () => {
    const app = makeApp();
    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/public-content',
      headers: { 'content-type': 'application/json', origin: 'http://evil.example' },
      payload: JSON.stringify({ expectedRevision: 0, content: { clubs: [], activities: [] } }),
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('REQUEST_ORIGIN_REJECTED');
  });
});

describe('相册上传与读取', () => {
  test('政策待配置时上传返回 503', async () => {
    const app = makeApp(makeConfig('pending'));
    const res = await upload(app, 'xiaoxiang_library', PNG, UUID_A);
    expect(res.statusCode).toBe(503);
    expect(res.json().error.code).toBe('IMAGE_POLICY_PENDING');
  });

  test('上传成功后可列表、可读取文件，且三个相册隔离', async () => {
    const app = makeApp();
    const up = await upload(app, 'xiaoxiang_library', PNG, UUID_A);
    expect(up.statusCode).toBe(201);
    const meta = up.json();
    expect(meta.placeId).toBe('xiaoxiang_library');
    expect(meta.mediaType).toBe('image/png');
    expect(meta.fileUrl).toBe(`/api/v1/photos/${meta.id}/file`);

    const list = await app.inject({ method: 'GET', url: '/api/v1/places/xiaoxiang_library/photos' });
    expect(list.statusCode).toBe(200);
    expect(list.json().photos).toHaveLength(1);

    const other = await app.inject({ method: 'GET', url: '/api/v1/places/xiaoxiang_sports_ground/photos' });
    expect(other.json().photos).toHaveLength(0);

    const file = await app.inject({ method: 'GET', url: `/api/v1/photos/${meta.id}/file` });
    expect(file.statusCode).toBe(200);
    expect(file.headers['content-type']).toBe('image/png');
    expect(file.headers['x-content-type-options']).toBe('nosniff');
    expect(Buffer.from(file.rawPayload)).toEqual(PNG);
  });

  test('相同幂等键与内容重放返回已有结果，不新增条目', async () => {
    const app = makeApp();
    const first = await upload(app, 'xiaoxiang_library', PNG, UUID_A);
    const replay = await upload(app, 'xiaoxiang_library', PNG, UUID_A);
    expect(first.statusCode).toBe(201);
    expect(replay.statusCode).toBe(201);
    expect(replay.json().id).toBe(first.json().id);

    const list = await app.inject({ method: 'GET', url: '/api/v1/places/xiaoxiang_library/photos' });
    expect(list.json().photos).toHaveLength(1);
  });

  test('相同幂等键用于不同内容返回冲突', async () => {
    const app = makeApp();
    await upload(app, 'xiaoxiang_library', PNG, UUID_A);
    const conflict = await upload(app, 'xiaoxiang_library', PNG2, UUID_A);
    expect(conflict.statusCode).toBe(409);
    expect(conflict.json().error.code).toBe('IDEMPOTENCY_CONFLICT');
  });

  test('未知地点与未知图片返回 404', async () => {
    const app = makeApp();
    const badPlace = await upload(app, 'nope', PNG, UUID_B);
    expect(badPlace.statusCode).toBe(404);
    expect(badPlace.json().error.code).toBe('PLACE_NOT_FOUND');

    const badPhoto = await app.inject({ method: 'GET', url: '/api/v1/photos/does-not-exist/file' });
    expect(badPhoto.statusCode).toBe(404);
    expect(badPhoto.json().error.code).toBe('PHOTO_NOT_FOUND');
  });
});

describe('请求错误映射', () => {
  test('非法 JSON 返回 400，超大请求体返回 413', async () => {
    const app = makeApp();
    const bad = await app.inject({
      method: 'PUT',
      url: '/api/v1/public-content',
      headers: { 'content-type': 'application/json', ...ORIGIN },
      payload: '{not json',
    });
    expect(bad.statusCode).toBe(400);
    expect(bad.json().error.code).toBe('INVALID_REQUEST');

    const huge = await app.inject({
      method: 'PUT',
      url: '/api/v1/public-content',
      headers: { 'content-type': 'application/json', ...ORIGIN },
      payload: JSON.stringify({ expectedRevision: 0, content: { clubs: [], activities: [], pad: 'x'.repeat(3 * 1024 * 1024) } }),
    });
    expect(huge.statusCode).toBe(413);
  });

  test('损坏的 multipart 返回 400 而非 FILE_TOO_LARGE', async () => {
    const app = makeApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/places/xiaoxiang_library/photos',
      headers: {
        'content-type': 'multipart/form-data; boundary=----campusTestBoundary',
        'idempotency-key': UUID_A,
        ...ORIGIN,
      },
      // 截断的 multipart：缺少结束边界，模拟连接中断
      payload:
        '------campusTestBoundary\r\nContent-Disposition: form-data; name="file"; filename="a.png"\r\n' +
        'Content-Type: image/png\r\n\r\nPNGDATA',
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('INVALID_REQUEST');
  });
});
