import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { ApiError } from '../../server/errors.ts';
import { DataStore, sha256Hex } from '../../server/storage.ts';
import { detectMediaType, isRfc3339, validatePublicContent } from '../../server/validation.ts';
import type { PublicContent } from '../../src/shared/contracts.ts';

const tempDirs: string[] = [];

function makeRoot(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'campus-service-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function validContent(): PublicContent {
  return {
    clubs: [
      { id: 'c1', name: '计算机协会', category: '科技', summary: '简介', campusIds: ['xiaoxiang'], links: [] },
    ],
    activities: [
      {
        id: 'a1',
        name: '招新',
        organizerClubId: 'c1',
        category: '活动',
        startsAt: '2026-10-01T10:00:00+08:00',
        endsAt: '2026-10-01T12:00:00+08:00',
        campusId: null,
        venue: '体育场（副场）',
        description: '',
        links: [],
      },
    ],
  };
}

function expectInvalid(content: PublicContent, pathSubstring?: string): void {
  let thrown: unknown;
  try {
    validatePublicContent(content);
  } catch (e) {
    thrown = e;
  }
  expect(thrown).toBeInstanceOf(ApiError);
  const err = thrown as ApiError;
  expect(err.status).toBe(422);
  expect(err.code).toBe('INVALID_CONTENT');
  if (pathSubstring) {
    expect(err.fields?.some((f) => f.path.includes(pathSubstring))).toBe(true);
  }
}

describe('公共内容校验', () => {
  test('合法的空内容通过', () => {
    expect(() => validatePublicContent({ clubs: [], activities: [] })).not.toThrow();
  });

  test('合法的社团与活动通过', () => {
    expect(() => validatePublicContent(validContent())).not.toThrow();
  });

  test('活动引用了不存在的社团被拒绝', () => {
    const c = validContent();
    c.activities[0].organizerClubId = 'missing';
    expectInvalid(c, 'organizerClubId');
  });

  test('结束时间不晚于开始时间被拒绝', () => {
    const c = validContent();
    c.activities[0].endsAt = c.activities[0].startsAt;
    expectInvalid(c, 'endsAt');
  });

  test('重复的社团 id 被拒绝', () => {
    const c = validContent();
    c.clubs.push({ ...c.clubs[0] });
    expectInvalid(c, 'id');
  });

  test('未知校区与未知字段被拒绝', () => {
    const c = validContent();
    (c.clubs[0] as unknown as Record<string, unknown>).campusIds = ['beijing'];
    expectInvalid(c, 'campusIds');
    const c2 = validContent();
    (c2.clubs[0] as unknown as Record<string, unknown>).extra = true;
    expectInvalid(c2, 'extra');
  });

  test('公开链接非 http(s) 被拒绝', () => {
    const c = validContent();
    c.clubs[0].links = [{ label: 'x', url: 'javascript:alert(1)' }];
    expectInvalid(c, 'links');
  });
});

describe('数据存储', () => {
  test('首次初始化创建合法空结构，并与读失败区分', () => {
    const root = makeRoot();
    const store = new DataStore(root);
    const { initialized } = store.initialize();
    expect(initialized).toBe(true);
    expect(store.readSnapshot()).toEqual({ schemaVersion: 1, revision: 0, clubs: [], activities: [] });
    expect(store.readIndex()).toEqual({ schemaVersion: 1, photos: [], uploads: {} });
  });

  test('快照提交后可完整读回并保留 revision', () => {
    const root = makeRoot();
    const store = new DataStore(root);
    store.initialize();
    const next = { schemaVersion: 1 as const, revision: 3, clubs: [], activities: [] };
    store.commitSnapshot(next);
    expect(store.readSnapshot()).toEqual(next);
  });

  test('已有数据文件损坏时报错，不自动重置', () => {
    const root = makeRoot();
    const store = new DataStore(root);
    store.initialize();
    writeFileSync(path.join(root, 'public-content.json'), '{{{ 损坏的 JSON', 'utf8');
    let thrown: unknown;
    try {
      store.readSnapshot();
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(ApiError);
    expect((thrown as ApiError).status).toBe(503);
  });
});

describe('图片辅助函数', () => {
  test('按魔数识别 PNG / JPEG / GIF / WebP', () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    expect(detectMediaType(png)).toBe('image/png');
    expect(detectMediaType(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]))).toBe('image/jpeg');
    expect(detectMediaType(Buffer.from('GIF89a\x00\x00', 'binary'))).toBe('image/gif');
    expect(detectMediaType(Buffer.from('RIFFxxxxWEBP', 'binary'))).toBe('image/webp');
    expect(detectMediaType(Buffer.from('not-an-image'))).toBeNull();
  });

  test('RFC3339 时间校验', () => {
    expect(isRfc3339('2026-10-01T10:00:00+08:00')).toBe(true);
    expect(isRfc3339('2026-10-01T10:00:00Z')).toBe(true);
    expect(isRfc3339('2026-10-01 10:00:00')).toBe(false);
  });

  test('内容摘要稳定且对内容敏感', () => {
    const a = Buffer.from('hello');
    const b = Buffer.from('hello');
    const c = Buffer.from('world');
    expect(sha256Hex(a)).toBe(sha256Hex(b));
    expect(sha256Hex(a)).not.toBe(sha256Hex(c));
  });
});
