import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { MAP_HEIGHT_PX, MAP_IMAGE_PATH, MAP_IMAGE_SHA256, MAP_WIDTH_PX } from '@/shared/contracts';

/**
 * 用户于 2026-09-26 指定 v20 为背景。运行底图采用原生尺寸版；8K 版是它的 8 倍最近邻放大
 * （每个 8×8 块为单一颜色，缩回后与原生版逐像素一致），在 pixelArt 渲染下显示效果相同。
 */
const SOURCE = 'output/concepts/沿线地标图-清水路北端接通-v20-步道拓宽与避让.png';

test('运行底图与用户指定的 v20 源图字节、哈希、尺寸一致', () => {
  const runtimePath = `public${MAP_IMAGE_PATH}`;
  expect(existsSync(runtimePath), '应已接入地图运行副本').toBe(true);
  const image = readFileSync(runtimePath);
  expect(image.equals(readFileSync(SOURCE))).toBe(true);
  expect(createHash('sha256').update(image).digest('hex')).toBe(MAP_IMAGE_SHA256);
  expect([image.readUInt32BE(16), image.readUInt32BE(20)]).toEqual([MAP_WIDTH_PX, MAP_HEIGHT_PX]);
});

test('待标定模板与契约使用同一地图身份，且仍为 pending', () => {
  const pending = JSON.parse(readFileSync('docs/examples/map.pending.json', 'utf-8'));
  expect(pending.imagePath).toBe(MAP_IMAGE_PATH);
  expect(pending.imageSha256).toBe(MAP_IMAGE_SHA256);
  expect(pending.annotationStatus).toBe('pending');
  expect(pending.geographyStatus).toBe('pending');
  expect(pending.walkableAreas).toEqual([]);
  for (const record of pending.interactions) {
    expect(record.entrancePoint).toBeNull();
    expect(record.triggerPolygon).toBeNull();
  }
});
