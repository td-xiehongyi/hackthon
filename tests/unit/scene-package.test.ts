import { describe, expect, it } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { readFileSync } from 'node:fs';
import { parseSceneZip, exportSceneZip } from '../../src/features/scene-package/package';

const png = new Uint8Array(readFileSync('public/maps/campus-v20.png'));
const manifest = {
  schemaVersion: 1, name: '测试校园', map: 'map.png', style: 'pixel-art',
  points: [
    { id: 'stadium', name: '操场', position: { x: .3, y: .5 }, feature: 'clubs', clubs: [{ name: '摄影社', description: '周末拍照' }], photos: [{ path: 'assets/photo.png', caption: '活动照片' }] },
    { id: 'canteen', name: '食堂', position: { x: .5, y: .5 }, feature: 'reviews', reviews: [{ author: '同学', rating: 5, text: '很好吃' }] },
    { id: 'classroom', name: '教室', position: { x: .7, y: .5 }, feature: 'timetable', courses: [{ name: '高等数学', time: '周一 08:00', teacher: '张老师' }] },
  ],
};
function pack(value: unknown = manifest, extra: Record<string, Uint8Array> = {}, prefix = '') {
  return zipSync(Object.fromEntries(Object.entries({ 'scene.json': strToU8(JSON.stringify(value)), 'map.png': png, 'assets/photo.png': png, ...extra }).map(([key, data]) => [prefix + key, data])));
}

describe('pixel-scene ZIP import', () => {
  it('imports map, photos and all interaction data with safe defaults', () => {
    const result = parseSceneZip(pack());
    expect(result.scene.name).toBe('测试校园');
    expect(result.scene.spawn).toEqual({ x: .5, y: .5 });
    expect(result.scene.collision).toBe('boundary');
    expect(result.scene.points[0].clubs[0].name).toBe('摄影社');
    expect(result.scene.points[1].reviews[0].rating).toBe(5);
    expect(result.scene.points[2].courses[0].teacher).toBe('张老师');
    expect(result.assets['assets/photo.png'].size).toBe(png.length);
  });
  it('accepts a single enclosing directory', () => {
    expect(parseSceneZip(pack(manifest, {}, 'campus/')).scene.map).toBe('map.png');
  });
  it('accepts a single image ZIP without fabricated points', () => {
    expect(parseSceneZip(zipSync({ 'map.png': png })).scene.points).toEqual([]);
  });
  it.each([
    { ...manifest, schemaVersion: 2 },
    { ...manifest, map: '../map.png' },
    { ...manifest, map: 'missing.png' },
    { ...manifest, points: [{ ...manifest.points[0], position: { x: 1.2, y: .2 } }] },
    { ...manifest, points: [manifest.points[0], manifest.points[0]] },
    { ...manifest, points: [{ ...manifest.points[1], reviews: [{ author: 'A', rating: 6, text: 'B' }] }] },
    { ...manifest, collision: 'polygons' },
  ])('rejects invalid manifests', value => {
    expect(() => parseSceneZip(pack(value))).toThrow();
  });
  it('rejects unsafe archive paths, huge entries and disguised images', () => {
    expect(() => parseSceneZip(pack(manifest, { '../escape.png': png }))).toThrow();
    expect(() => parseSceneZip(pack(manifest, { 'huge.png': new Uint8Array(17 * 1024 * 1024) }))).toThrow();
    expect(() => parseSceneZip(pack(manifest, { 'map.png': strToU8('<script>bad</script>') }))).toThrow();
  });
  it('rejects unreadable ZIP and ambiguous image-only archives', () => {
    expect(() => parseSceneZip(strToU8('broken'))).toThrow();
    expect(() => parseSceneZip(zipSync({ 'a.png': png, 'b.png': png }))).toThrow();
  });
  it('only keeps referenced assets and never executes package content', () => {
    const result = parseSceneZip(pack(manifest, { 'index.html': strToU8('<script>alert(1)</script>') }));
    expect(Object.keys(result.assets).sort()).toEqual(['assets/photo.png', 'map.png']);
  });
  it('exports a near-limit manifest without growing it beyond the import limit', async () => {
    const clubs = Array.from({ length: 500 }, () => ({ name: 'A', description: 'B'.repeat(1330) }));
    const large = { ...manifest, points: [0, 1, 2].map(i => ({ ...manifest.points[0], id: `point${i}`, clubs })) };
    const value = parseSceneZip(pack(large));
    const exported = await exportSceneZip(value);
    expect(parseSceneZip(new Uint8Array(await exported.arrayBuffer())).scene.points[0].clubs).toHaveLength(500);
  });
  it('rejects forged stored sizes before allocating or parsing oversized content', () => {
    const data = zipSync({ 'scene.json': strToU8(JSON.stringify(manifest) + ' '.repeat(3 * 1024 * 1024)), 'map.png': png, 'assets/photo.png': png }, { level: 0 });
    const view = new DataView(data.buffer);
    const central = view.getUint32(data.length - 6, true);
    view.setUint32(central + 24, 1, true);
    expect(() => parseSceneZip(data)).toThrow();
  });
  it('rejects symlinks and encrypted ZIP entries', () => {
    for (const encrypted of [false, true]) {
      const data = pack();
      const view = new DataView(data.buffer);
      const central = view.getUint32(data.length - 6, true);
      if (encrypted) { view.setUint16(central + 8, 1, true); view.setUint16(6, 1, true); }
      else { view.setUint16(central + 4, 0x0314, true); view.setUint32(central + 38, 0xa1ff0000, true); }
      expect(() => parseSceneZip(data)).toThrow();
    }
  });
  it('rejects aliases to the same local file and mismatched local headers', () => {
    const data = pack();
    const view = new DataView(data.buffer);
    const central = view.getUint32(data.length - 6, true);
    const second = central + 46 + view.getUint16(central + 28, true) + view.getUint16(central + 30, true) + view.getUint16(central + 32, true);
    view.setUint32(second + 42, 0, true);
    expect(() => parseSceneZip(data)).toThrow();
  });
  it('rejects deflate output larger than both forged size fields', () => {
    const json = JSON.stringify({ schemaVersion: 1, name: 'N', map: 'map.png' });
    const data = zipSync({ 'scene.json': strToU8(json + ' '.repeat(3 * 1024 * 1024)), 'map.png': png });
    const view = new DataView(data.buffer);
    const central = view.getUint32(data.length - 6, true);
    view.setUint32(central + 24, strToU8(json).length, true);
    view.setUint32(22, strToU8(json).length, true);
    expect(() => parseSceneZip(data)).toThrow();
  });
});
