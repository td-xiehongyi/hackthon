import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { loadConfig } from '../../server/config.ts';

const PROJECT_ROOT = path.resolve(import.meta.dirname, '..', '..');

describe('服务配置', () => {
  test('默认开启地点照片上传，保留显式停用和容量设置', () => {
    const config = loadConfig({});
    expect(config.imagePolicy).toBe('configured');
    expect(config.acceptedMimeTypes).toEqual(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
    expect(config.maxFileBytes).toBe(10 * 1024 * 1024);
    expect(loadConfig({ CAMPUS_IMAGE_POLICY: 'pending' }).imagePolicy).toBe('pending');
    expect(loadConfig({ CAMPUS_IMAGE_POLICY: 'dev' }).imagePolicy).toBe('configured');
  });
  test('数据目录固定在项目根，不随工作目录变化', () => {
    expect(loadConfig({}).dataRoot).toBe(path.join(PROJECT_ROOT, 'data'));
    expect(loadConfig({ CAMPUS_DATA_ROOT: 'tmp-data' }).dataRoot).toBe(path.join(PROJECT_ROOT, 'tmp-data'));
  });

  test('默认允许 127.0.0.1 与 localhost 两种本机入口', () => {
    const { allowedOrigins } = loadConfig({});
    expect(allowedOrigins).toContain('http://127.0.0.1:5173');
    expect(allowedOrigins).toContain('http://localhost:5173');
  });

  test('数值环境变量非法时启动即报错', () => {
    expect(() => loadConfig({ CAMPUS_MAX_FILE_BYTES: 'abc' })).toThrow(/CAMPUS_MAX_FILE_BYTES/);
    expect(() => loadConfig({ CAMPUS_PORT: '-1' })).toThrow(/CAMPUS_PORT/);
    expect(loadConfig({ CAMPUS_MAX_ALBUM_COUNT: '' }).maxAlbumCount).toBeNull();
  });
});
