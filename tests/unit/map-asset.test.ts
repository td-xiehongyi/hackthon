import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

test('运行底图保持用户指定原图的字节、尺寸与身份', () => {
  const runtimePath = 'public/maps/campus-final-v9.png';
  expect(existsSync(runtimePath), '应已接入地图运行副本').toBe(true);
  const image = readFileSync(runtimePath);
  expect(image.equals(readFileSync('output/中南大学像素校园-最终地图.png'))).toBe(true);
  expect(createHash('sha256').update(image).digest('hex')).toBe(
    '7c47e74e4002fbe12c998f838ae7d8a1dff937863412380d6101b6f7b8eec745',
  );
  expect([image.readUInt32BE(16), image.readUInt32BE(20)]).toEqual([1041, 1511]);
});
